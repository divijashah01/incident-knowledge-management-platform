import os
import joblib
import faiss
import numpy as np
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from sentence_transformers import SentenceTransformer
from tickets.models import Ticket, Runbook, Postmortem

# ── LAZY LOADING ──────────────────────────────────────────────────
_embedding_model = None
_faiss_index     = None
_ticket_mapping  = None
MODEL_NAME       = 'all-MiniLM-L6-v2'

# Minimum cosine similarity to consider a ticket relevant.
# Below this threshold the retrieval is too weak to ground an answer —
# the LLM is instructed to refuse rather than hallucinate.
SIMILARITY_THRESHOLD = 0.40


def _load_resources():
    global _embedding_model, _faiss_index, _ticket_mapping

    if _embedding_model is None:
        try:
            _embedding_model = SentenceTransformer(MODEL_NAME)
        except Exception as e:
            return False, f"Failed to load embedding model: {e}"

    if _faiss_index is None or _ticket_mapping is None:
        models_dir   = os.path.join(settings.BASE_DIR, 'ml_models')
        faiss_path   = os.path.join(models_dir, 'ticket_vectors.faiss')
        mapping_path = os.path.join(models_dir, 'faiss_ticket_mapping.pkl')

        if not os.path.exists(faiss_path) or not os.path.exists(mapping_path):
            return False, "FAISS index not found. Run: python manage.py generate_embeddings"

        _faiss_index    = faiss.read_index(faiss_path)
        _ticket_mapping = joblib.load(mapping_path)

    return True, None


def _retrieve_similar_tickets(query_text, top_k=5):
    query_vector = _embedding_model.encode([query_text], convert_to_numpy=True)
    faiss.normalize_L2(query_vector)
    scores, indices = _faiss_index.search(query_vector, top_k)

    matched_ids = [
        _ticket_mapping[idx]
        for idx in indices[0]
        if idx != -1
    ]
    ticket_map = {
        t.ticket_id: t
        for t in Ticket.objects.filter(ticket_id__in=matched_ids)
    }

    results = []
    for i, idx in enumerate(indices[0]):
        if idx == -1:
            continue
        tid    = _ticket_mapping[idx]
        ticket = ticket_map.get(tid)
        if ticket:
            results.append({
                'ticket':     ticket,
                'similarity': round(float(scores[0][i]), 4)
            })
    return results


def _retrieve_runbooks(similar_tickets):
    runbook_ids_seen = set()
    runbooks         = []
    for item in similar_tickets:
        for tc in item['ticket'].ticket_clusters.select_related('cluster').all():
            rb = Runbook.objects.filter(
                cluster=tc.cluster).order_by('-version').first()
            if rb and rb.id not in runbook_ids_seen:
                runbook_ids_seen.add(rb.id)
                runbooks.append(rb)
    return runbooks


def _retrieve_postmortems(similar_tickets):
    ticket_objs = [item['ticket'] for item in similar_tickets]
    return list(
        Postmortem.objects
        .filter(ticket__in=ticket_objs)
        .select_related('ticket')
    )


def _build_context(similar_tickets, runbooks, postmortems):
    lines = ["=== SIMILAR HISTORICAL INCIDENTS ==="]
    for i, item in enumerate(similar_tickets, 1):
        t = item['ticket']
        lines.append(
            f"\n[Incident {i}] (similarity: {item['similarity']})\n"
            f"Title      : {t.title}\n"
            f"Domain     : {t.domain}\n"
            f"Severity   : {t.severity}\n"
            f"Symptoms   : {t.symptoms}\n"
            f"Root Cause : {t.root_cause}\n"
            f"Resolution : {t.resolution_steps}\n"
        )
    if runbooks:
        lines.append("\n=== RELEVANT RUNBOOKS ===")
        for rb in runbooks:
            lines.append(f"\n[Runbook] {rb.title}\n{rb.content[:800]}...\n")
    if postmortems:
        lines.append("\n=== RELEVANT POSTMORTEMS ===")
        for pm in postmortems:
            lines.append(
                f"\n[Postmortem for {pm.ticket.ticket_id}]\n"
                f"{pm.content[:600]}...\n"
            )
    return "\n".join(lines)


def _build_prompt(user_query, context):
    """
    Feature 2 (RAG grounding enforcement):
    Explicit instructions prevent the LLM from answering outside
    the provided context. The refusal message is standardised so
    the frontend can detect it and show a helpful fallback UI.
    """
    return f"""You are an expert IT operations assistant for an incident management platform.
Your ONLY job is to answer questions using the provided knowledge base context below.

STRICT RULES:
- Answer using ONLY information from the context provided.
- Do NOT use any general knowledge, training data, or external information.
- If the context does not contain enough information to answer, respond with EXACTLY this text:
  "INSUFFICIENT_CONTEXT: I don't have enough information in the knowledge base to answer this question confidently. Try rephrasing your query or browse the runbooks directly."
- Do not guess, infer beyond the context, or fill gaps with general knowledge.

=== KNOWLEDGE BASE CONTEXT ===
{context}

=== ENGINEER'S QUESTION ===
{user_query}

=== YOUR RESPONSE ===
Provide a clear, structured, actionable response in Markdown.
Include:
1. Direct answer grounded in the context
2. Relevant resolution steps from the matched incidents
3. Applicable runbook guidance if available
4. Preventative recommendations if mentioned in the context"""


class RAGChatView(APIView):
    """
    POST /api/chat/query/

    Body:
        query  : str  — engineer's question
        top_k  : int  — tickets to retrieve (default 5)

    Response:
        answer              : str   (Markdown or INSUFFICIENT_CONTEXT message)
        sources             : list
        runbooks_used       : list
        postmortems_used    : list
        retrieval_quality   : str   ("good" | "low" | "none")
        max_similarity      : float
    """

    def post(self, request):
        ok, err = _load_resources()
        if not ok:
            return Response({"error": err}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        user_query = request.data.get('query', '').strip()
        top_k      = int(request.data.get('top_k', 5))

        if not user_query:
            return Response(
                {"error": "Provide a 'query' string."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # ── Retrieve ───────────────────────────────────────────
            similar_tickets = _retrieve_similar_tickets(user_query, top_k)

            if not similar_tickets:
                return Response({
                    "answer":            "INSUFFICIENT_CONTEXT: No relevant incidents found in the knowledge base.",
                    "sources":           [],
                    "runbooks_used":     [],
                    "postmortems_used":  [],
                    "retrieval_quality": "none",
                    "max_similarity":    0.0,
                }, status=status.HTTP_200_OK)

            # ── Feature 2: Retrieval quality gate ──────────────────
            # If best match is below threshold, warn the LLM explicitly.
            # The LLM will still try but is flagged to be conservative.
            max_similarity = similar_tickets[0]['similarity']

            if max_similarity < SIMILARITY_THRESHOLD:
                retrieval_quality = "low"
            elif max_similarity >= 0.65:
                retrieval_quality = "good"
            else:
                retrieval_quality = "moderate"

            # Filter out tickets below threshold entirely from context
            # so the LLM doesn't get weak signals as if they were relevant
            filtered_tickets = [
                t for t in similar_tickets
                if t['similarity'] >= SIMILARITY_THRESHOLD
            ]

            if not filtered_tickets:
                return Response({
                    "answer":            "INSUFFICIENT_CONTEXT: The closest matches in the knowledge base are not similar enough to your query to give a reliable answer. Try rephrasing or use more specific technical terms.",
                    "sources":           [],
                    "runbooks_used":     [],
                    "postmortems_used":  [],
                    "retrieval_quality": "low",
                    "max_similarity":    round(max_similarity, 4),
                }, status=status.HTTP_200_OK)

            runbooks    = _retrieve_runbooks(filtered_tickets)
            postmortems = _retrieve_postmortems(filtered_tickets)
            context     = _build_context(filtered_tickets, runbooks, postmortems)
            prompt      = _build_prompt(user_query, context)

            # ── Call LLM ───────────────────────────────────────────
            from google import genai
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                return Response(
                    {"error": "GEMINI_API_KEY not set."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            client   = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            answer = response.text

            # ── Build response ─────────────────────────────────────
            sources = [{
                "ticket_id":        item['ticket'].ticket_id,
                "title":            item['ticket'].title,
                "domain":           item['ticket'].domain,
                "severity":         item['ticket'].severity,
                "similarity_score": item['similarity'],
                "resolution_steps": item['ticket'].resolution_steps
            } for item in filtered_tickets]

            return Response({
                "answer":            answer,
                "sources":           sources,
                "runbooks_used":     [{"runbook_id": rb.id, "title": rb.title, "cluster_id": rb.cluster_id} for rb in runbooks],
                "postmortems_used":  [{"postmortem_id": pm.id, "ticket_id": pm.ticket.ticket_id} for pm in postmortems],
                "retrieval_quality": retrieval_quality,
                "max_similarity":    round(max_similarity, 4),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)