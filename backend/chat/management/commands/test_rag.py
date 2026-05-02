"""
Phase 7 — RAG Pipeline Test
Run from backend/ with venv active:
    python manage.py test_rag --query "Dashboard is timing out for all users"

This tests the full RAG pipeline end to end:
  1. Embed query
  2. Retrieve similar tickets from FAISS
  3. Retrieve runbooks and postmortems
  4. Build prompt
  5. Call Gemini
  6. Print response
"""

import os
import joblib
import faiss
import numpy as np
from django.core.management.base import BaseCommand
from django.conf import settings
from sentence_transformers import SentenceTransformer
from tickets.models import Ticket, Runbook, Postmortem
from google import genai


class Command(BaseCommand):
    help = 'Tests the full RAG pipeline for Phase 7.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--query',
            type=str,
            default='Dashboard is timing out for all users',
            help='The query to test the RAG pipeline with'
        )
        parser.add_argument(
            '--top_k',
            type=int,
            default=5,
            help='Number of similar tickets to retrieve'
        )
        parser.add_argument(
            '--no-llm',
            action='store_true',
            help='Skip the LLM call and only test retrieval'
        )

    def handle(self, *args, **kwargs):
        query  = kwargs['query']
        top_k  = kwargs['top_k']
        no_llm = kwargs['no_llm']

        self.stdout.write(f'\nQuery: "{query}"\n')

        # ── STEP 1: LOAD RESOURCES ─────────────────────────────────
        self.stdout.write("Loading embedding model...")
        model = SentenceTransformer('all-MiniLM-L6-v2')

        models_dir   = os.path.join(settings.BASE_DIR, 'ml_models')
        faiss_path   = os.path.join(models_dir, 'ticket_vectors.faiss')
        mapping_path = os.path.join(models_dir, 'faiss_ticket_mapping.pkl')

        if not os.path.exists(faiss_path):
            self.stdout.write(self.style.ERROR(
                "FAISS index not found. Run generate_embeddings first."))
            return

        index          = faiss.read_index(faiss_path)
        ticket_mapping = joblib.load(mapping_path)
        self.stdout.write(f"FAISS index loaded: {index.ntotal} vectors.")

        # ── STEP 2: EMBED AND RETRIEVE ─────────────────────────────
        self.stdout.write("\nEmbedding query and searching FAISS...")
        query_vector = model.encode([query], convert_to_numpy=True)
        faiss.normalize_L2(query_vector)
        scores, indices = index.search(query_vector, top_k)

        matched_ids = [
            ticket_mapping[idx]
            for idx in indices[0]
            if idx != -1
        ]
        ticket_map = {
            t.ticket_id: t
            for t in Ticket.objects.filter(ticket_id__in=matched_ids)
        }

        similar_tickets = []
        self.stdout.write(
            f"\n{'='*60}\nTop-{top_k} Similar Tickets\n{'='*60}")
        for i, idx in enumerate(indices[0]):
            if idx == -1:
                continue
            tid    = ticket_mapping[idx]
            ticket = ticket_map.get(tid)
            if ticket:
                score = round(float(scores[0][i]), 4)
                similar_tickets.append({'ticket': ticket, 'similarity': score})
                self.stdout.write(
                    f"\n{i+1}. [{score}] {ticket.ticket_id} — {ticket.title}\n"
                    f"   Domain  : {ticket.domain}\n"
                    f"   Severity: {ticket.severity}\n"
                    f"   Root    : {ticket.root_cause[:80]}...\n"
                    f"   Fix     : {ticket.resolution_steps[:80]}..."
                )

        # ── STEP 3: RETRIEVE RUNBOOKS ──────────────────────────────
        runbook_ids_seen = set()
        runbooks         = []
        for item in similar_tickets:
            t = item['ticket']
            for tc in t.ticket_clusters.select_related('cluster').all():
                rb = Runbook.objects.filter(
                    cluster=tc.cluster).order_by('-version').first()
                if rb and rb.id not in runbook_ids_seen:
                    runbook_ids_seen.add(rb.id)
                    runbooks.append(rb)

        self.stdout.write(
            f"\n{'='*60}\nRunbooks Retrieved: {len(runbooks)}\n{'='*60}")
        for rb in runbooks:
            self.stdout.write(f"  [{rb.id}] {rb.title}")

        # ── STEP 4: RETRIEVE POSTMORTEMS ───────────────────────────
        ticket_objs = [item['ticket'] for item in similar_tickets]
        postmortems = list(
            Postmortem.objects
            .filter(ticket__in=ticket_objs)
            .select_related('ticket')
        )
        self.stdout.write(
            f"\n{'='*60}\nPostmortems Retrieved: {len(postmortems)}\n{'='*60}")
        for pm in postmortems:
            self.stdout.write(
                f"  [{pm.id}] Postmortem for {pm.ticket.ticket_id} "
                f"({pm.ticket.title})")

        if no_llm:
            self.stdout.write(self.style.WARNING(
                "\n--no-llm flag set. Skipping LLM call."))
            return

        # ── STEP 5: BUILD PROMPT ───────────────────────────────────
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self.stdout.write(self.style.ERROR(
                "\nGEMINI_API_KEY not set. Use --no-llm to test retrieval only."))
            return

        # Build context
        context_lines = ["=== SIMILAR HISTORICAL INCIDENTS ==="]
        for i, item in enumerate(similar_tickets, 1):
            t = item['ticket']
            context_lines.append(
                f"\n[Incident {i}] (similarity: {item['similarity']})\n"
                f"Title      : {t.title}\n"
                f"Domain     : {t.domain}\n"
                f"Severity   : {t.severity}\n"
                f"Symptoms   : {t.symptoms}\n"
                f"Root Cause : {t.root_cause}\n"
                f"Resolution : {t.resolution_steps}\n"
            )
        if runbooks:
            context_lines.append("\n=== RELEVANT RUNBOOKS ===")
            for rb in runbooks:
                context_lines.append(
                    f"\n[Runbook] {rb.title}\n{rb.content[:800]}...\n")
        if postmortems:
            context_lines.append("\n=== RELEVANT POSTMORTEMS ===")
            for pm in postmortems:
                context_lines.append(
                    f"\n[Postmortem for {pm.ticket.ticket_id}]\n"
                    f"{pm.content[:600]}...\n")

        context = "\n".join(context_lines)
        prompt  = f"""You are an expert IT operations assistant for an incident management platform.
Your role is to help engineers diagnose and resolve incidents quickly.

You have been provided with relevant historical incidents, runbooks, and postmortems retrieved from the knowledge base.
Answer the engineer's question using ONLY the provided context.
If the context does not contain enough information to answer confidently, say so clearly.
Do not invent information that is not present in the context.

=== KNOWLEDGE BASE CONTEXT ===
{context}

=== ENGINEER'S QUESTION ===
{query}

=== YOUR RESPONSE ===
Provide a clear, structured, actionable response. Use Markdown formatting.
Include:
1. Direct answer to the question
2. Relevant resolution steps from the context
3. Any applicable runbook guidance
4. Preventative recommendations if available"""

        # ── STEP 6: CALL LLM ───────────────────────────────────────
        self.stdout.write(f"\n{'='*60}\nCalling Gemini...\n{'='*60}")
        client   = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )

        self.stdout.write(f"\n{'='*60}\nRAG RESPONSE\n{'='*60}")
        self.stdout.write(response.text)
        self.stdout.write(self.style.SUCCESS("\n✅ RAG pipeline test complete."))