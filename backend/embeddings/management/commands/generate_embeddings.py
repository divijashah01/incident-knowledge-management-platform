import os
import joblib
import numpy as np
import faiss
from django.core.management.base import BaseCommand
from django.conf import settings
from tickets.models import Ticket, Embedding
from sentence_transformers import SentenceTransformer


class Command(BaseCommand):
    help = 'Generates vector embeddings for all tickets, saves to DB, builds FAISS index.'

    def handle(self, *args, **kwargs):

        # ── 1. LOAD MODEL ─────────────────────────────────────────
        model_name = 'all-MiniLM-L6-v2'
        self.stdout.write(f"Loading embedding model: {model_name}...")
        model = SentenceTransformer(model_name)
        vector_dimension = model.get_sentence_embedding_dimension()
        self.stdout.write(f"Vector dimension: {vector_dimension}")

        # ── 2. FETCH TICKETS (single query, no N+1) ───────────────
        tickets = Ticket.objects.all()
        if not tickets.exists():
            self.stdout.write(self.style.ERROR(
                "No tickets found. Run load_tickets first."))
            return

        # Build a map once — avoids 650 individual DB queries later
        ticket_map = {t.ticket_id: t for t in tickets}
        ticket_ids = list(ticket_map.keys())

        # ── 3. PREPARE TEXT ───────────────────────────────────────
        # Use same fields as classification: title + description + symptoms
        # This ensures semantic search finds tickets based on the same
        # textual content the classifier uses
        self.stdout.write("Preparing ticket texts...")
        texts = []
        for tid in ticket_ids:
            t = ticket_map[tid]
            text = (
                f"{t.title or ''} "
                f"{t.description or ''} "
                f"{t.symptoms or ''}"
            ).strip()
            texts.append(text)

        # ── 4. GENERATE EMBEDDINGS ────────────────────────────────
        self.stdout.write(
            f"Encoding {len(texts)} tickets (this may take 1-2 minutes)...")
        embeddings = model.encode(
            texts,
            convert_to_numpy=True,
            show_progress_bar=True    # progress bar during encoding
        )

        # ── 5. NORMALISE FOR COSINE SIMILARITY ────────────────────
        # sentence-transformers embeddings work best with cosine similarity.
        # Normalising L2 vectors + IndexFlatIP gives cosine similarity,
        # which produces better semantic search than raw L2 distance.
        faiss.normalize_L2(embeddings)

        # ── 6. SAVE EMBEDDINGS TO DATABASE ───────────────────────
        self.stdout.write("Saving embeddings to PostgreSQL...")
        Embedding.objects.all().delete()   # clear old to avoid duplicates

        embedding_objects = []
        for i, ticket_id in enumerate(ticket_ids):
            embedding_objects.append(Embedding(
                ticket=ticket_map[ticket_id],
                embedding=embeddings[i].tobytes(),
                model_used=model_name,
                vector_dimension=vector_dimension
            ))
        Embedding.objects.bulk_create(embedding_objects)
        self.stdout.write(f"Saved {len(embedding_objects)} embeddings.")

        # ── 7. BUILD FAISS INDEX ──────────────────────────────────
        # IndexFlatIP = inner product on normalised vectors = cosine similarity
        # Score range: 0.0 (no similarity) to 1.0 (identical)
        self.stdout.write("Building FAISS index (cosine similarity)...")
        faiss_index = faiss.IndexFlatIP(vector_dimension)
        faiss_index.add(embeddings)
        self.stdout.write(f"FAISS index contains {faiss_index.ntotal} vectors.")

        # ── 8. SAVE INDEX AND MAPPING ─────────────────────────────
        models_dir = os.path.join(settings.BASE_DIR, 'ml_models')
        os.makedirs(models_dir, exist_ok=True)

        faiss.write_index(
            faiss_index,
            os.path.join(models_dir, 'ticket_vectors.faiss'))
        joblib.dump(
            ticket_ids,
            os.path.join(models_dir, 'faiss_ticket_mapping.pkl'))

        self.stdout.write(self.style.SUCCESS(
            f'✅ Done. Embeddings saved to DB and FAISS index saved to {models_dir}'))