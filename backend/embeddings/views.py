import os
import joblib
import faiss
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from sentence_transformers import SentenceTransformer
from tickets.models import Ticket

# Load globally to keep API fast (loads once when server starts)
MODEL_NAME = 'all-MiniLM-L6-v2'
try:
    embedding_model = SentenceTransformer(MODEL_NAME)
except Exception:
    embedding_model = None

class SimilarTicketsView(APIView):
    """
    API endpoint to find similar historical tickets based on semantic meaning.
    """
    def post(self, request):
        query_text = request.data.get('query', '')
        top_k = request.data.get('top_k', 3) # Default to top 3 results

        if not query_text:
            return Response({"error": "Please provide a 'query' string."}, status=status.HTTP_400_BAD_REQUEST)

        if embedding_model is None:
            return Response({"error": "Embedding model failed to load."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        models_dir = os.path.join(settings.BASE_DIR, 'ml_models')
        faiss_path = os.path.join(models_dir, 'ticket_vectors.faiss')
        mapping_path = os.path.join(models_dir, 'faiss_ticket_mapping.pkl')

        if not os.path.exists(faiss_path) or not os.path.exists(mapping_path):
             return Response({"error": "FAISS index not built. Run generate_embeddings command."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            # 1. Embed the incoming query
            query_vector = embedding_model.encode([query_text], convert_to_numpy=True)

            # 2. Load FAISS and Mapping
            index = faiss.read_index(faiss_path)
            ticket_mapping = joblib.load(mapping_path)

            # 3. Perform Vector Search
            distances, indices = index.search(query_vector, int(top_k))

            # 4. Format Results
            results = []
            for i in range(len(indices[0])):
                match_index = indices[0][i]
                if match_index == -1: continue # FAISS returns -1 if not enough results
                
                matched_ticket_id = ticket_mapping[match_index]
                distance = float(distances[0][i]) # Lower distance = higher similarity
                
                ticket = Ticket.objects.get(ticket_id=matched_ticket_id)
                results.append({
                    "ticket_id": ticket.ticket_id,
                    "title": ticket.title,
                    "true_category": ticket.true_category,
                    "resolution_steps": ticket.resolution_steps,
                    "similarity_score": round(1 / (1 + distance), 4) # Convert L2 distance to a 0-1 score
                })

            return Response({"results": results}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)