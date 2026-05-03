from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from tickets.models import Cluster, Runbook


class ClusterListView(APIView):
    """
    GET /api/clustering/clusters/

    Returns all clusters sorted by ticket count.
    Each cluster includes:
      - ticket_count      : SQL COUNT annotation (no len())
      - has_runbook       : bool
      - knowledge_gap     : bool — True if no runbook exists
      - dominant_domain   : most common domain in cluster (Feature 2)
      - dominant_severity : most common severity in cluster (Feature 2)
      - runbook_title     : latest runbook title if exists
    """

    def get(self, request):
        try:
            clusters = (
                Cluster.objects
                .annotate(
                    ticket_count=Count('ticket_clusters'),
                    runbook_count=Count('runbooks'),
                )
                .prefetch_related('ticket_clusters__ticket')
                .order_by('-ticket_count')
            )

            result    = []
            gap_count = 0

            for cluster in clusters:
                tickets       = [tc.ticket for tc in cluster.ticket_clusters.all()]
                sample_titles = [t.title for t in tickets[:3]]

                # ── Feature 2: Pattern intelligence ───────────────
                domain_counts   = {}
                severity_counts = {}
                for t in tickets:
                    domain_counts[t.domain]     = domain_counts.get(t.domain, 0) + 1
                    severity_counts[t.severity] = severity_counts.get(t.severity, 0) + 1

                dominant_domain   = max(domain_counts,   key=domain_counts.get) if domain_counts   else None
                dominant_severity = max(severity_counts, key=severity_counts.get) if severity_counts else None

                # ── Feature 6: Knowledge gap detection ────────────
                has_runbook   = cluster.runbook_count > 0
                knowledge_gap = not has_runbook
                if knowledge_gap:
                    gap_count += 1

                runbook_title = None
                if has_runbook:
                    rb = (
                        Runbook.objects
                        .filter(cluster=cluster)
                        .order_by('-version')
                        .values('title', 'version')
                        .first()
                    )
                    if rb:
                        runbook_title = f"v{rb['version']}: {rb['title']}"

                result.append({
                    "cluster_id":        cluster.id,
                    "label":             cluster.label,
                    "algorithm":         cluster.algorithm_used,
                    "ticket_count":      cluster.ticket_count,
                    "sample_tickets":    sample_titles,
                    "dominant_domain":   dominant_domain,
                    "dominant_severity": dominant_severity,
                    "has_runbook":       has_runbook,
                    "knowledge_gap":     knowledge_gap,
                    "runbook_title":     runbook_title,
                })

            return Response({
                "clusters":              result,
                "total_clusters":        len(result),
                "knowledge_gaps":        gap_count,
                "clusters_with_runbook": len(result) - gap_count,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class KnowledgeGapView(APIView):
    """
    GET /api/clustering/gaps/

    Returns only clusters with no runbook.
    Used in Admin dashboard to surface what needs attention.
    """

    def get(self, request):
        try:
            gaps = (
                Cluster.objects
                .annotate(
                    ticket_count=Count('ticket_clusters'),
                    runbook_count=Count('runbooks'),
                )
                .filter(runbook_count=0)
                .prefetch_related('ticket_clusters__ticket')
                .order_by('-ticket_count')
            )

            result = []
            for cluster in gaps:
                tickets       = [tc.ticket for tc in cluster.ticket_clusters.all()]
                sample_titles = [t.title for t in tickets[:3]]

                domain_counts = {}
                for t in tickets:
                    domain_counts[t.domain] = domain_counts.get(t.domain, 0) + 1
                dominant_domain = max(domain_counts, key=domain_counts.get) if domain_counts else None

                result.append({
                    "cluster_id":      cluster.id,
                    "label":           cluster.label,
                    "ticket_count":    cluster.ticket_count,
                    "dominant_domain": dominant_domain,
                    "sample_tickets":  sample_titles,
                })

            return Response({
                "knowledge_gaps": result,
                "total_gaps":     len(result),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )