import os
import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from scipy.sparse import hstack, csr_matrix

# ── LAZY LOADING ──────────────────────────────────────────────────
_classifier = None
_tfidf      = None
_meta_cols  = None


def _load_models():
    global _classifier, _tfidf, _meta_cols
    if _classifier is not None:
        return True

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


def _get_top_keywords(text, predicted_class, top_n=6):
    """
    Feature 1: Explainability
    Extracts top TF-IDF tokens that most influenced the predicted class
    using the LogisticRegression model's learned coefficients.
    Returns list of {word, influence} dicts sorted by influence score.
    """
    try:
        classes     = list(_classifier.classes_)
        class_index = classes.index(predicted_class)

        tfidf_vector  = _tfidf.transform([text])
        feature_names = np.array(_tfidf.get_feature_names_out())
        class_coefs   = _classifier.coef_[class_index]

        # influence = tfidf_weight × model_coefficient
        tfidf_array = tfidf_vector.toarray()[0]
        influence   = tfidf_array * class_coefs

        top_indices = np.argsort(influence)[::-1][:top_n]

        keywords = []
        for idx in top_indices:
            score = float(influence[idx])
            if score > 0:
                keywords.append({
                    "word":      feature_names[idx],
                    "influence": round(score, 4)
                })
        return keywords

    except Exception:
        return []


class ClassifyTicketView(APIView):
    """
    POST /api/classification/classify/

    Body:
        title, description, symptoms, impact   (text)
        domain, priority, severity, environment (metadata)

    Response:
        predicted_category, confidence_score,
        all_probabilities, top_keywords (Feature 1)
    """

    def post(self, request):
        if not _load_models():
            return Response(
                {"error": "Model not trained yet. Run: python manage.py train_classifier"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        title       = request.data.get('title',       '')
        description = request.data.get('description', '')
        symptoms    = request.data.get('symptoms',    '')
        impact      = request.data.get('impact',      '')
        domain      = request.data.get('domain',      '')
        priority    = request.data.get('priority',    '')
        severity    = request.data.get('severity',    '')
        environment = request.data.get('environment', '')

        text = f"{title} {description} {symptoms} {impact}".strip()
        if not text:
            return Response(
                {"error": "Provide at least one of: title, description, symptoms, impact."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            X_tfidf    = _tfidf.transform([text])
            meta_raw   = pd.DataFrame([{
                'domain': domain, 'priority': priority,
                'severity': severity, 'environment': environment
            }])
            meta_enc     = pd.get_dummies(meta_raw, drop_first=True)
            meta_aligned = meta_enc.reindex(columns=_meta_cols, fill_value=0)

            X_combined    = hstack([X_tfidf, csr_matrix(meta_aligned.values)])
            prediction    = _classifier.predict(X_combined)[0]
            probabilities = _classifier.predict_proba(X_combined)[0]
            classes       = _classifier.classes_

            confidence   = round(float(max(probabilities)), 4)
            all_probs    = {cls: round(float(p), 4) for cls, p in zip(classes, probabilities)}
            top_keywords = _get_top_keywords(text, prediction, top_n=6)

            return Response({
                "predicted_category": prediction,
                "confidence_score":   confidence,
                "all_probabilities":  all_probs,
                "top_keywords":       top_keywords,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)