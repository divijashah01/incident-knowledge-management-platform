from django.urls import path
from .views import (
    RunbookListView,
    RunbookVersionsView,
    RunbookDiffView,
    RunbookApproveView,
    PostmortemListView,
    ScoreResolutionView,
)

urlpatterns = [
    # Runbooks
    path('runbooks/',                              RunbookListView.as_view(),    name='runbook-list'),
    path('runbooks/<int:cluster_id>/versions/',    RunbookVersionsView.as_view(),name='runbook-versions'),
    path('runbooks/<int:cluster_id>/diff/',        RunbookDiffView.as_view(),    name='runbook-diff'),
    path('runbooks/<int:runbook_id>/approve/',     RunbookApproveView.as_view(), name='runbook-approve'),

    # Postmortems
    path('postmortems/',                           PostmortemListView.as_view(), name='postmortem-list'),

    # Feature 3: Resolution quality scoring
    path('score-resolution/',                      ScoreResolutionView.as_view(),name='score-resolution'),
]