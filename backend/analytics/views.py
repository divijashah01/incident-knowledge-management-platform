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
_mttr_model   = None
_mttr_tfidf   = None
_mttr_cols    = None


def _load_mttr_models():
    global _mttr_model, _mttr_tfidf, _mttr_cols
    if _mttr_model is not None:
        return True

    models_dir  = os.path.join(settings.BASE_DIR, 'ml_models')
    model_path  = os.path.join(models_dir, 'mttr_model.pkl')
    tfidf_path  = os.path.join(models_dir, 'mttr_tfidf.pkl')
    cols_path   = os.path.join(models_dir, 'mttr_metadata_columns.pkl')

    if not all(os.path.exists(p) for p in [model_path, tfidf_path, cols_path]):
        return False

    _mttr_model = joblib.load(model_path)
    _mttr_tfidf = joblib.load(tfidf_path)
    _mttr_cols  = joblib.load(cols_path)
    return True


def _human_readable(minutes):
    """Convert minutes to a human readable string for the API response."""
    minutes = int(round(minutes))
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    mins  = minutes % 60
    if hours < 24:
        return f"{hours}h {mins}m" if mins else f"{hours} hours"
    days  = hours // 24
    hrs   = hours % 24
    return f"{days}d {hrs}h" if hrs else f"{days} days"


def _severity_band(minutes):
    """
    Maps predicted MTTR to an expected severity band.
    Based on typical SRE SLO ranges.
    """
    if minutes <= 120:
        return "Within 2 hours — typical for well-documented recurring incidents"
    elif minutes <= 480:
        return "2–8 hours — typical for medium complexity issues"
    elif minutes <= 1440:
        return "8–24 hours — typical for complex or novel issues"
    else:
        return "More than 1 day — may require escalation or investigation"


class PredictMTTRView(APIView):
    """
    POST /api/analytics/predict-mttr/

    Feature 5: Predicts resolution time for a new ticket
    before an engineer picks it up. Useful for workload planning
    and SLA breach early warning.

    Body:
        title       : str
        description : str
        symptoms    : str  (optional)
        domain      : str
        priority    : str
        severity    : str
        environment : str

    Response:
        predicted_minutes   : int
        predicted_readable  : str   e.g. "3h 20m"
        context             : str   — what this prediction means
        confidence          : str   "high" | "medium" | "low"
        similar_mttr_range  : dict  — based on same domain+severity from DB
    """

    def post(self, request):
        if not _load_mttr_models():
            return Response(
                {"error": "MTTR model not trained. Run: python manage.py train_mttr_model"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        title       = request.data.get('title',       '')
        description = request.data.get('description', '')
        symptoms    = request.data.get('symptoms',    '')
        domain      = request.data.get('domain',      '')
        priority    = request.data.get('priority',    '')
        severity    = request.data.get('severity',    '')
        environment = request.data.get('environment', '')

        text = f"{title} {description} {symptoms}".strip()
        if not text:
            return Response(
                {"error": "Provide at least one of: title, description, symptoms."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # ── Build features ─────────────────────────────────────
            X_tfidf  = _mttr_tfidf.transform([text])
            meta_raw = pd.DataFrame([{
                'domain':      domain,
                'priority':    priority,
                'severity':    severity,
                'environment': environment
            }])
            meta_enc     = pd.get_dummies(meta_raw, drop_first=True)
            meta_aligned = meta_enc.reindex(columns=_mttr_cols, fill_value=0)
            X_combined   = hstack([X_tfidf, csr_matrix(meta_aligned.values)])

            # ── Predict ────────────────────────────────────────────
            raw_pred        = float(_mttr_model.predict(X_combined)[0])
            predicted_mins  = max(1, int(round(raw_pred)))

            # ── Confidence heuristic ───────────────────────────────
            # High confidence if domain + severity are known (non-zero metadata)
            meta_nonzero = int(meta_aligned.values.sum())
            if meta_nonzero >= 3:
                confidence = "high"
            elif meta_nonzero >= 1:
                confidence = "medium"
            else:
                confidence = "low"

            # ── Similar MTTR range from DB ─────────────────────────
            # Pull actual MTTR of resolved tickets with same domain+severity
            # for context alongside the model prediction
            from tickets.models import Ticket
            similar = Ticket.objects.filter(
                domain=domain,
                severity=severity,
                status__in=['Resolved', 'Closed'],
                resolution_time_minutes__isnull=False
            ).values_list('resolution_time_minutes', flat=True)

            similar_list = list(similar)
            if similar_list:
                similar_range = {
                    "min":    min(similar_list),
                    "max":    max(similar_list),
                    "mean":   int(round(sum(similar_list) / len(similar_list))),
                    "count":  len(similar_list),
                    "min_readable":  _human_readable(min(similar_list)),
                    "mean_readable": _human_readable(
                        sum(similar_list) / len(similar_list)),
                    "max_readable":  _human_readable(max(similar_list)),
                }
            else:
                similar_range = None

            return Response({
                "predicted_minutes":  predicted_mins,
                "predicted_readable": _human_readable(predicted_mins),
                "context":            _severity_band(predicted_mins),
                "confidence":         confidence,
                "similar_mttr_range": similar_range,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )