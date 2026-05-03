from django.urls import path
from .views import SimilarTicketsView

urlpatterns = [
    path('similar/', SimilarTicketsView.as_view(), name='similar_tickets'),
]