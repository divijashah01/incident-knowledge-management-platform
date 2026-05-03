import difflib
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from tickets.models import Runbook, Postmortem
from .resolution_scorer import score_resolution


class RunbookListView(APIView):
    """
    GET /api/knowledge/runbooks/
    Returns all runbooks newest first with version info.
    """
    def get(self, request):
        try:
            runbooks = (
                Runbook.objects
                .select_related('cluster')
                .all()
                .order_by('-generated_at')
            )
            result = [{
                "runbook_id":   rb.id,
                "cluster_id":   rb.cluster.id,
                "title":        rb.title,
                "version":      rb.version,
                "created_by":   rb.created_by,
                "approved":     rb.approved,
                "generated_at": rb.generated_at,
                "content":      rb.content,
            } for rb in runbooks]
            return Response({"runbooks": result}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RunbookVersionsView(APIView):
    """
    GET /api/knowledge/runbooks/<cluster_id>/versions/

    Feature 4: Returns all versions of a runbook for a given cluster,
    ordered from latest to oldest.
    """
    def get(self, request, cluster_id):
        try:
            runbooks = (
                Runbook.objects
                .filter(cluster_id=cluster_id)
                .order_by('-version')
            )
            if not runbooks.exists():
                return Response(
                    {"error": f"No runbooks found for cluster {cluster_id}."},
                    status=status.HTTP_404_NOT_FOUND
                )
            result = [{
                "runbook_id":   rb.id,
                "version":      rb.version,
                "title":        rb.title,
                "approved":     rb.approved,
                "created_by":   rb.created_by,
                "generated_at": rb.generated_at,
                "content":      rb.content,
            } for rb in runbooks]
            return Response({
                "cluster_id":     cluster_id,
                "total_versions": len(result),
                "versions":       result
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RunbookDiffView(APIView):
    """
    GET /api/knowledge/runbooks/<cluster_id>/diff/

    Feature 4: Returns a line-by-line unified diff between
    the two most recent versions of a cluster's runbook.
    Used in the frontend to show what changed between versions.

    Query params:
        v1 : int (optional) — older version number
        v2 : int (optional) — newer version number
        If not provided, defaults to latest two versions.
    """
    def get(self, request, cluster_id):
        try:
            v1_num = request.query_params.get('v1', None)
            v2_num = request.query_params.get('v2', None)

            runbooks_qs = Runbook.objects.filter(
                cluster_id=cluster_id).order_by('-version')

            if runbooks_qs.count() < 2:
                return Response(
                    {"error": "Need at least 2 versions to show a diff."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if v1_num and v2_num:
                try:
                    rb_old = runbooks_qs.get(version=int(v1_num))
                    rb_new = runbooks_qs.get(version=int(v2_num))
                except Runbook.DoesNotExist:
                    return Response(
                        {"error": "One or both specified versions not found."},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # Default: latest two versions
                rb_new = runbooks_qs[0]
                rb_old = runbooks_qs[1]

            # ── Compute unified diff ───────────────────────────────
            old_lines = rb_old.content.splitlines(keepends=True)
            new_lines = rb_new.content.splitlines(keepends=True)

            diff = list(difflib.unified_diff(
                old_lines, new_lines,
                fromfile=f"v{rb_old.version} ({rb_old.generated_at.strftime('%Y-%m-%d')})",
                tofile=f"v{rb_new.version} ({rb_new.generated_at.strftime('%Y-%m-%d')})",
                lineterm=''
            ))

            # Also produce a structured diff for frontend rendering
            structured = []
            for line in diff:
                if line.startswith('+++') or line.startswith('---') or line.startswith('@@'):
                    structured.append({"type": "meta",    "text": line})
                elif line.startswith('+'):
                    structured.append({"type": "added",   "text": line[1:]})
                elif line.startswith('-'):
                    structured.append({"type": "removed", "text": line[1:]})
                else:
                    structured.append({"type": "context", "text": line})

            return Response({
                "cluster_id":  cluster_id,
                "old_version": rb_old.version,
                "new_version": rb_new.version,
                "unified_diff": "".join(diff),
                "structured_diff": structured,
                "lines_added":   sum(1 for l in structured if l["type"] == "added"),
                "lines_removed": sum(1 for l in structured if l["type"] == "removed"),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RunbookApproveView(APIView):
    """
    POST /api/knowledge/runbooks/<runbook_id>/approve/

    Admin-only: marks a runbook as approved.
    Approved runbooks are never overwritten by future generation runs.
    """
    def post(self, request, runbook_id):
        try:
            rb = Runbook.objects.get(id=runbook_id)
            rb.approved = True
            rb.save()
            return Response({
                "message":    f"Runbook {runbook_id} approved.",
                "runbook_id": runbook_id,
                "version":    rb.version,
                "title":      rb.title,
            }, status=status.HTTP_200_OK)
        except Runbook.DoesNotExist:
            return Response({"error": "Runbook not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PostmortemListView(APIView):
    """
    GET /api/knowledge/postmortems/
    Returns all postmortems newest first.
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
                "content":           pm.content,
            } for pm in postmortems]
            return Response({"postmortems": result}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ScoreResolutionView(APIView):
    """
    POST /api/knowledge/score-resolution/

    Feature 3: Scores a resolution note 0-100 before it enters
    the knowledge base. Returns grade, feedback, and per-dimension breakdown.
    """
    def post(self, request):
        resolution_text = request.data.get('resolution_text', '').strip()
        ticket_id       = request.data.get('ticket_id', '')

        if not resolution_text:
            return Response(
                {"error": "Provide 'resolution_text'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            result             = score_resolution(resolution_text)
            result["acceptable"] = result["score"] >= 60
            result["ticket_id"]  = ticket_id
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)