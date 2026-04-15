from django.urls import path
from .views import ClusterListView

urlpatterns = [
    path('api/clusters/', ClusterListView.as_view(), name='list_clusters'),
]