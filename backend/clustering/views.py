from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from tickets.models import Cluster

class ClusterListView(APIView):
    """
    API endpoint to list all detected incident clusters and their ticket counts.
    """
    def get(self, request):
        try:
            clusters = Cluster.objects.prefetch_related('ticket_clusters__ticket').all()
            
            result = []
            for cluster in clusters:
                # Get the tickets in this cluster
                tickets = [tc.ticket for tc in cluster.ticket_clusters.all()]
                
                # We will return the first 3 ticket titles as a preview of what the cluster is about
                sample_titles = [t.title for t in tickets[:3]]
                
                result.append({
                    "cluster_id": cluster.id,
                    "label": cluster.label,
                    "algorithm": cluster.algorithm_used,
                    "ticket_count": len(tickets),
                    "sample_tickets": sample_titles
                })
                
            # Sort by biggest cluster first
            result.sort(key=lambda x: x['ticket_count'], reverse=True)
            
            return Response({"clusters": result}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)