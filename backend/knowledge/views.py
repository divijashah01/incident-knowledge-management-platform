from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from tickets.models import Runbook, Postmortem


class RunbookListView(APIView):
    """
    GET /api/knowledge/runbooks/

    Returns all generated runbooks, newest first.
    Uses select_related to efficiently fetch the associated cluster ID.
    """
    def get(self, request):
        try:
            # select_related avoids N+1 DB hits when accessing rb.cluster.id
            runbooks = Runbook.objects.select_related('cluster').all().order_by('-generated_at')

            result = [{
                "runbook_id":   rb.id,
                "cluster_id":   rb.cluster.id,
                "title":        rb.title,
                "version":      rb.version,
                "created_by":   rb.created_by,
                "approved":     rb.approved,
                "generated_at": rb.generated_at,
                "content":      rb.content
            } for rb in runbooks]

            return Response({"runbooks": result}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PostmortemListView(APIView):
    """
    GET /api/knowledge/postmortems/

    Returns all generated postmortems, newest first.
    Uses select_related to efficiently fetch the associated ticket data.

    Note: Only Critical-severity resolved/closed tickets have postmortems.
    severity_snapshot preserves the severity at generation time — if the
    ticket severity is later updated, the postmortem context remains accurate.
    """
    def get(self, request):
        try:
            postmortems = (
                Postmortem.objects
                .select_related('ticket')
                .all()
                .order_by('-generated_at')
            )

            result = [{
                "postmortem_id":     pm.id,
                "ticket_id":         pm.ticket.ticket_id,
                "ticket_title":      pm.ticket.title,
                "domain":            pm.ticket.domain,
                "severity_snapshot": pm.severity_snapshot,
                "approved":          pm.approved,
                "generated_at":      pm.generated_at,
                "content":           pm.content
            } for pm in postmortems]

            return Response({"postmortems": result}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )