from django.urls import path
from .views import ClassifyTicketView

urlpatterns = [
    path('classify/', ClassifyTicketView.as_view(), name='classify_ticket'),
]