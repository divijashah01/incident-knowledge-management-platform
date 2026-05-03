from django.urls import path
from .views import ClusterListView, KnowledgeGapView

urlpatterns = [
    path('clusters/', ClusterListView.as_view(), name='list_clusters'),
    path('gaps/', KnowledgeGapView.as_view(), name='knowledge-gaps'),
]