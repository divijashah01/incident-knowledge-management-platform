import os
import joblib
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class ClassifyTicketView(APIView):
    """
    API endpoint to classify a new ticket description/symptoms.
    """
    def post(self, request):
        description = request.data.get('description', '')
        symptoms = request.data.get('symptoms', '')
        
        # Combine inputs
        text = f"{description} {symptoms}".strip()

        if not text:
            return Response(
                {"error": "Please provide 'description' or 'symptoms' text."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        model_path = os.path.join(settings.BASE_DIR, 'ml_models', 'ticket_classifier.pkl')
        
        if not os.path.exists(model_path):
             return Response(
                {"error": "Model not trained yet. Run train_classifier command."}, 
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            # Load model and predict
            pipeline = joblib.load(model_path)
            prediction = pipeline.predict([text])[0]
            
            # (Optional) Get confidence score
            # probabilities = pipeline.predict_proba([text])[0]
            # max_prob = max(probabilities)
            
            return Response({
                "predicted_category": prediction,
                # "confidence_score": round(max_prob, 2)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)