import os
import joblib
import numpy as np
import faiss
from django.core.management.base import BaseCommand
from django.conf import settings
from tickets.models import Ticket, Embedding
from sentence_transformers import SentenceTransformer

class Command(BaseCommand):
    help = 'Generates vector embeddings for all tickets, saves them to DB, and builds a FAISS index.'

    def handle(self, *args, **kwargs):
        model_name = 'all-MiniLM-L6-v2' # Fast, lightweight, highly effective
        self.stdout.write(f"Loading embedding model: {model_name}...")
        model = SentenceTransformer(model_name)
        vector_dimension = model.get_sentence_embedding_dimension()

        tickets = Ticket.objects.all()
        if not tickets.exists():
            self.stdout.write(self.style.ERROR("No tickets found. Run Phase 2 data load first."))
            return

        texts_to_embed = []
        ticket_ids = []

        self.stdout.write("Preparing ticket text data...")
        for ticket in tickets:
            # We embed what a user would type when reporting a NEW ticket
            text = f"{ticket.description} {ticket.symptoms}".strip()
            texts_to_embed.append(text)
            ticket_ids.append(ticket.ticket_id)

        self.stdout.write(f"Encoding {len(texts_to_embed)} tickets into vectors (this may take a minute)...")
        # Generate embeddings as a numpy array
        embeddings = model.encode(texts_to_embed, convert_to_numpy=True)

        self.stdout.write("Saving embeddings to PostgreSQL database...")
        # Clear old embeddings to prevent duplicates on rerun
        Embedding.objects.all().delete()
        
        embedding_objects = []
        for i, ticket_id in enumerate(ticket_ids):
            ticket = Ticket.objects.get(ticket_id=ticket_id)
            vector_bytes = embeddings[i].tobytes()
            embedding_objects.append(
                Embedding(
                    ticket=ticket,
                    embedding=vector_bytes,
                    model_used=model_name,
                    vector_dimension=vector_dimension
                )
            )
        Embedding.objects.bulk_create(embedding_objects)

        self.stdout.write("Building FAISS vector index...")
        # L2 distance (Euclidean) is standard for these embeddings
        faiss_index = faiss.IndexFlatL2(vector_dimension)
        faiss_index.add(embeddings)

        # Save the FAISS index and the ID mapping to disk
        models_dir = os.path.join(settings.BASE_DIR, 'ml_models')
        os.makedirs(models_dir, exist_ok=True)
        
        faiss.write_index(faiss_index, os.path.join(models_dir, 'ticket_vectors.faiss'))
        joblib.dump(ticket_ids, os.path.join(models_dir, 'faiss_ticket_mapping.pkl'))

        self.stdout.write(self.style.SUCCESS('✅ Successfully generated embeddings and built FAISS index!'))