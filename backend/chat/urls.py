from django.urls import path
from .views import RAGChatView

urlpatterns = [
    path('query/', RAGChatView.as_view(), name='rag-chat'),
]