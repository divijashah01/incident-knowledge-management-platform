from django.urls import path
from .views import RunbookListView, PostmortemListView

urlpatterns = [
    path('api/runbooks/', RunbookListView.as_view(), name='list_runbooks'),
    path('api/postmortems/', PostmortemListView.as_view(), name='list_postmortems'),
]