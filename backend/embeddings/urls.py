from django.urls import path
from .views import SimilarTicketsView

urlpatterns = [
    path('api/similar/', SimilarTicketsView.as_view(), name='similar_tickets'),
]