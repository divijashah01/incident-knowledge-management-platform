from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from tickets.models import Cluster


class ClusterListView(APIView):
    """
    GET /api/clustering/clusters/

    Returns all detected clusters sorted by ticket count (largest first).
    Each cluster includes a preview of up to 3 ticket titles.

    Response:
        clusters: list of {
            cluster_id, label, algorithm, ticket_count, sample_tickets
        }
    """

    def get(self, request):
        try:
            # annotate() computes ticket_count in SQL — no Python len() needed
            # prefetch_related limits to 3 ticket_clusters per cluster for preview
            clusters = (
                Cluster.objects
                .annotate(ticket_count=Count('ticket_clusters'))
                .prefetch_related('ticket_clusters__ticket')
                .order_by('-ticket_count')   # largest cluster first
            )

            result = []
            for cluster in clusters:
                # Get up to 3 ticket titles for the preview
                sample_titles = [
                    tc.ticket.title
                    for tc in cluster.ticket_clusters.all()[:3]
                ]
                result.append({
                    "cluster_id":     cluster.id,
                    "label":          cluster.label,
                    "algorithm":      cluster.algorithm_used,
                    "ticket_count":   cluster.ticket_count,
                    "sample_tickets": sample_titles
                })

            return Response({"clusters": result}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )