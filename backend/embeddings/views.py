import os
import joblib
import numpy as np
import faiss
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from sentence_transformers import SentenceTransformer
from tickets.models import Ticket

# ── LAZY LOADING ──────────────────────────────────────────────────
# All heavy resources loaded once on first request, not per-request
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
            return False, "FAISS index not found. Run: python manage.py generate_embeddings"

        _faiss_index    = faiss.read_index(faiss_path)
        _ticket_mapping = joblib.load(mapping_path)

    return True, None


class SimilarTicketsView(APIView):
    """
    POST /api/embeddings/similar/

    Body (JSON):
        query  : str   — description of the new incident
        top_k  : int   — number of similar tickets to return (default: 5)

    Returns:
        results: list of {
            ticket_id, title, domain, true_category,
            resolution_steps, similarity_score
        }
    """

    def post(self, request):

        # ── Load resources (first request only) ───────────────────
        ok, err = _load_resources()
        if not ok:
            return Response({"error": err},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        query_text = request.data.get('query', '').strip()
        top_k      = int(request.data.get('top_k', 5))

        if not query_text:
            return Response(
                {"error": "Provide a 'query' string."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # ── Embed and normalise query ─────────────────────────
            # Must normalise query vector too — same as index vectors
            query_vector = _embedding_model.encode(
                [query_text], convert_to_numpy=True)
            faiss.normalize_L2(query_vector)

            # ── FAISS search ──────────────────────────────────────
            # scores = cosine similarity (0.0 – 1.0), higher = more similar
            scores, indices = _faiss_index.search(query_vector, top_k)

            # ── Bulk fetch matched tickets (single DB query) ───────
            matched_ids = [
                _ticket_mapping[idx]
                for idx in indices[0]
                if idx != -1
            ]
            ticket_map = {
                t.ticket_id: t
                for t in Ticket.objects.filter(ticket_id__in=matched_ids)
            }

            # ── Build response ────────────────────────────────────
            results = []
            for i, idx in enumerate(indices[0]):
                if idx == -1:
                    continue
                tid    = _ticket_mapping[idx]
                ticket = ticket_map.get(tid)
                if not ticket:
                    continue

                results.append({
                    "ticket_id":        ticket.ticket_id,
                    "title":            ticket.title,
                    "domain":           ticket.domain,
                    "true_category":    ticket.true_category,
                    "resolution_steps": ticket.resolution_steps,
                    "similarity_score": round(float(scores[0][i]), 4)
                    # cosine similarity: 1.0 = identical, 0.0 = unrelated
                })

            return Response({"results": results}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )