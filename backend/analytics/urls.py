from django.urls import path
from .views import PredictMTTRView

urlpatterns = [
    path('predict-mttr/', PredictMTTRView.as_view(), name='predict-mttr'),
]