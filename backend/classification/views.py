import os
import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from scipy.sparse import hstack, csr_matrix

# ── LAZY MODEL LOADING ────────────────────────────────────────────
# Models are loaded once on first request and reused for all
# subsequent requests — never loaded inside the request handler
_classifier  = None
_tfidf       = None
_meta_cols   = None


def _load_models():
    """Load all three artifacts from disk. Called once on first request."""
    global _classifier, _tfidf, _meta_cols
    if _classifier is not None:
        return True                          # already loaded

    models_dir = os.path.join(settings.BASE_DIR, 'ml_models')
    clf_path   = os.path.join(models_dir, 'ticket_classifier.pkl')
    tfidf_path = os.path.join(models_dir, 'tfidf_vectorizer.pkl')
    cols_path  = os.path.join(models_dir, 'metadata_columns.pkl')

    if not all(os.path.exists(p) for p in [clf_path, tfidf_path, cols_path]):
        return False

    _classifier = joblib.load(clf_path)
    _tfidf      = joblib.load(tfidf_path)
    _meta_cols  = joblib.load(cols_path)
    return True


class ClassifyTicketView(APIView):
    """
    POST /api/classification/classify/

    Body (JSON):
        title        : str  (optional but recommended)
        description  : str
        symptoms     : str  (optional)
        impact       : str  (optional)
        domain       : str  e.g. "Application / Backend Issues"
        priority     : str  e.g. "P1"
        severity     : str  e.g. "Critical"
        environment  : str  e.g. "Production"

    Returns:
        predicted_category : str
        confidence_score   : float  (0.0 – 1.0)
        all_probabilities  : dict   {class: probability}
    """

    def post(self, request):

        # ── Load models (first request only) ──────────────────────
        if not _load_models():
            return Response(
                {"error": "Model not trained yet. Run: python manage.py train_classifier"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # ── Extract inputs ─────────────────────────────────────────
        title       = request.data.get('title', '')
        description = request.data.get('description', '')
        symptoms    = request.data.get('symptoms', '')
        impact      = request.data.get('impact', '')
        domain      = request.data.get('domain', '')
        priority    = request.data.get('priority', '')
        severity    = request.data.get('severity', '')
        environment = request.data.get('environment', '')

        text = f"{title} {description} {symptoms} {impact}".strip()
        if not text:
            return Response(
                {"error": "Provide at least one of: title, description, symptoms, impact."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # ── Build text features ───────────────────────────────
            X_tfidf = _tfidf.transform([text])

            # ── Build metadata features ───────────────────────────
            # Create a one-row DataFrame with the same columns used
            # during training, then one-hot encode to match training shape
            meta_raw = pd.DataFrame([{
                'domain':      domain,
                'priority':    priority,
                'severity':    severity,
                'environment': environment
            }])
            meta_encoded = pd.get_dummies(meta_raw, drop_first=True)

            # Align columns to match exactly what training produced
            # Any unseen category gets a zero column; missing cols are added as 0
            meta_aligned = meta_encoded.reindex(
                columns=_meta_cols, fill_value=0)

            # ── Combine and predict ───────────────────────────────
            X_combined   = hstack([X_tfidf, csr_matrix(meta_aligned.values)])
            prediction   = _classifier.predict(X_combined)[0]
            probabilities = _classifier.predict_proba(X_combined)[0]
            classes      = _classifier.classes_

            confidence   = round(float(max(probabilities)), 4)
            all_probs    = {
                cls: round(float(prob), 4)
                for cls, prob in zip(classes, probabilities)
            }

            return Response({
                "predicted_category": prediction,
                "confidence_score":   confidence,
                "all_probabilities":  all_probs
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )