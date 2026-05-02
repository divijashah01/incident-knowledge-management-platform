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
# All heavy resources loaded once on first request, reused for all
# subsequent requests — never loaded inside the request handler.
_embedding_model = None
_faiss_index     = None
_ticket_mapping  = None
MODEL_NAME       = 'all-MiniLM-L6-v2'


def _load_resources():
    """Load sentence transformer, FAISS index, and ticket mapping once."""
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
            return False, (
                "FAISS index not found. "
                "Run: python manage.py generate_embeddings")

        _faiss_index    = faiss.read_index(faiss_path)
        _ticket_mapping = joblib.load(mapping_path)

    return True, None


def _retrieve_similar_tickets(query_text, top_k=5):
    """
    Embed the query and retrieve the top-k most semantically
    similar tickets from the FAISS index.
    Returns a list of Ticket objects and their similarity scores.
    """
    query_vector = _embedding_model.encode(
        [query_text], convert_to_numpy=True)
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


def _retrieve_runbooks(tickets):
    """
    For each retrieved ticket, check if its cluster has a runbook.
    Returns a deduplicated list of Runbook objects.
    """
    runbook_ids_seen = set()
    runbooks         = []

    for t in tickets:
        # A ticket can belong to multiple clusters
        for tc in t.ticket_clusters.select_related('cluster').all():
            cluster = tc.cluster
            rb = Runbook.objects.filter(cluster=cluster).order_by('-version').first()
            if rb and rb.id not in runbook_ids_seen:
                runbook_ids_seen.add(rb.id)
                runbooks.append(rb)

    return runbooks


def _retrieve_postmortems(tickets):
    """
    For each retrieved ticket, check if it has a postmortem.
    Returns a list of Postmortem objects.
    """
    ticket_objs = [t['ticket'] for t in tickets]
    return list(
        Postmortem.objects
        .filter(ticket__in=ticket_objs)
        .select_related('ticket')
    )


def _build_context(similar_tickets, runbooks, postmortems):
    """
    Assembles the retrieved knowledge into a structured context
    block for the LLM prompt.
    """
    lines = []

    # ── Similar tickets ────────────────────────────────────────
    lines.append("=== SIMILAR HISTORICAL INCIDENTS ===")
    for i, item in enumerate(similar_tickets, 1):
        t = item['ticket']
        lines.append(
            f"\n[Incident {i}] (similarity: {item['similarity']})\n"
            f"Title        : {t.title}\n"
            f"Domain       : {t.domain}\n"
            f"Severity     : {t.severity}\n"
            f"Symptoms     : {t.symptoms}\n"
            f"Root Cause   : {t.root_cause}\n"
            f"Resolution   : {t.resolution_steps}\n"
        )

    # ── Runbooks ───────────────────────────────────────────────
    if runbooks:
        lines.append("\n=== RELEVANT RUNBOOKS ===")
        for rb in runbooks:
            lines.append(
                f"\n[Runbook] {rb.title}\n"
                f"{rb.content[:800]}...\n"   # truncate to keep prompt size manageable
            )

    # ── Postmortems ────────────────────────────────────────────
    if postmortems:
        lines.append("\n=== RELEVANT POSTMORTEMS ===")
        for pm in postmortems:
            lines.append(
                f"\n[Postmortem for {pm.ticket.ticket_id}]\n"
                f"{pm.content[:600]}...\n"   # truncate to keep prompt size manageable
            )

    return "\n".join(lines)


def _build_prompt(user_query, context):
    """
    Constructs the full augmented prompt sent to the LLM.
    The prompt explicitly instructs the model to use ONLY the
    provided context and not hallucinate from general knowledge.
    """
    return f"""You are an expert IT operations assistant for an incident management platform.
Your role is to help engineers diagnose and resolve incidents quickly.

You have been provided with relevant historical incidents, runbooks, and postmortems retrieved from the knowledge base.
Answer the engineer's question using ONLY the provided context.
If the context does not contain enough information to answer confidently, say so clearly.
Do not invent information that is not present in the context.

=== KNOWLEDGE BASE CONTEXT ===
{context}

=== ENGINEER'S QUESTION ===
{user_query}

=== YOUR RESPONSE ===
Provide a clear, structured, actionable response. Use Markdown formatting.
Include:
1. Direct answer to the question
2. Relevant resolution steps from the context
3. Any applicable runbook guidance
4. Preventative recommendations if available"""


class RAGChatView(APIView):
    """
    POST /api/chat/query/

    Accepts a natural language question from an engineer and returns
    a contextual answer grounded in the historical incident knowledge base.

    Body (JSON):
        query      : str   — the engineer's question
        top_k      : int   — number of similar tickets to retrieve (default: 5)

    Response:
        answer              : str   — LLM-generated response in Markdown
        sources             : list  — tickets used as context
        runbooks_used       : list  — runbooks included in context
        postmortems_used    : list  — postmortems included in context
    """

    def post(self, request):

        # ── Load resources (first request only) ───────────────────
        ok, err = _load_resources()
        if not ok:
            return Response(
                {"error": err},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        user_query = request.data.get('query', '').strip()
        top_k      = int(request.data.get('top_k', 5))

        if not user_query:
            return Response(
                {"error": "Provide a 'query' string."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # ── Step 1 & 2: Embed query + retrieve similar tickets ─
            similar_tickets = _retrieve_similar_tickets(user_query, top_k)

            if not similar_tickets:
                return Response({
                    "answer":  "No relevant incidents found in the knowledge base for your query.",
                    "sources": [],
                    "runbooks_used":    [],
                    "postmortems_used": []
                }, status=status.HTTP_200_OK)

            # ── Step 2 (cont): Retrieve runbooks and postmortems ───
            runbooks    = _retrieve_runbooks(similar_tickets)
            postmortems = _retrieve_postmortems(similar_tickets)

            # ── Step 3: Build context block ────────────────────────
            context = _build_context(similar_tickets, runbooks, postmortems)

            # ── Step 4: Build augmented prompt and call LLM ────────
            from google import genai
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                return Response(
                    {"error": "GEMINI_API_KEY not set in environment."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            client = genai.Client(api_key=api_key)
            prompt = _build_prompt(user_query, context)

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            answer = response.text

            # ── Step 5: Build structured response ──────────────────
            sources = [{
                "ticket_id":        item['ticket'].ticket_id,
                "title":            item['ticket'].title,
                "domain":           item['ticket'].domain,
                "severity":         item['ticket'].severity,
                "similarity_score": item['similarity'],
                "resolution_steps": item['ticket'].resolution_steps
            } for item in similar_tickets]

            runbooks_used = [{
                "runbook_id": rb.id,
                "title":      rb.title,
                "cluster_id": rb.cluster_id
            } for rb in runbooks]

            postmortems_used = [{
                "postmortem_id": pm.id,
                "ticket_id":     pm.ticket.ticket_id
            } for pm in postmortems]

            return Response({
                "answer":           answer,
                "sources":          sources,
                "runbooks_used":    runbooks_used,
                "postmortems_used": postmortems_used
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )