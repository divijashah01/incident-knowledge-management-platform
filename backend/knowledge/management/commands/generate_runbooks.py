import os
import time
from google import genai
from django.core.management.base import BaseCommand
from tickets.models import Cluster, Runbook


class Command(BaseCommand):
    help = 'Generates LLM runbooks with versioning. Never overwrites approved runbooks. Safe to rerun.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true',
            help='Delete all unapproved runbooks and regenerate from scratch'
        )
        parser.add_argument(
            '--cluster', type=int, default=None,
            help='Regenerate runbook for a specific cluster ID only'
        )

    def handle(self, *args, **kwargs):
        force      = kwargs.get('force', False)
        cluster_id = kwargs.get('cluster', None)

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self.stdout.write(self.style.ERROR("GEMINI_API_KEY not set."))
            return

        client = genai.Client(api_key=api_key)

        if force:
            deleted = Runbook.objects.filter(approved=False).delete()
            self.stdout.write(self.style.WARNING(
                f"Force mode: deleted {deleted[0]} unapproved runbooks."))

        qs = Cluster.objects.prefetch_related('ticket_clusters__ticket').all()
        if cluster_id:
            qs = qs.filter(id=cluster_id)
            if not qs.exists():
                self.stdout.write(self.style.ERROR(f"Cluster {cluster_id} not found."))
                return

        if not qs.exists():
            self.stdout.write(self.style.ERROR("No clusters found."))
            return

        total     = qs.count()
        generated = versioned = skipped = failed = 0
        self.stdout.write(f"Found {total} clusters.\n")

        for cluster in qs:

            # ── Versioning logic ───────────────────────────────────
            # Approved runbook exists → skip (never touch approved content)
            # Unapproved exists → create new version (keep old for diff)
            # None exists → create v1
            if Runbook.objects.filter(cluster=cluster, approved=True).exists():
                self.stdout.write(f"Cluster {cluster.id}: approved runbook exists — skipping.")
                skipped += 1
                continue

            latest = (
                Runbook.objects.filter(cluster=cluster)
                .order_by('-version').values('version').first()
            )
            next_version = (latest['version'] + 1) if latest else 1
            is_new       = next_version == 1

            tickets = [tc.ticket for tc in cluster.ticket_clusters.all()][:10]
            if not tickets:
                skipped += 1
                continue

            label = "Generating" if is_new else f"Re-generating v{next_version}"
            self.stdout.write(f"Cluster {cluster.id}: {label}...")

            context_text = "\n\n".join(
                f"- Title: {t.title}\n  Symptoms: {t.symptoms}\n"
                f"  Root Cause: {t.root_cause}\n  Resolution: {t.resolution_steps}"
                for t in tickets
            )

            prompt = f"""You are an Expert Site Reliability Engineer (SRE).
Historical IT support tickets grouped by a clustering algorithm:

{context_text}

Based ONLY on the provided tickets, generate a structured Runbook in clean Markdown.

Include:
1. Short, Descriptive Title (no "Runbook" in title)
2. Systemic Root Cause Summary
3. Diagnostic Steps
4. Step-by-Step Resolution Workflow
5. Preventative Measures"""

            success = this_failed = False
            runbook_content = None

            for attempt in range(4):
                try:
                    response = client.models.generate_content(
                        model='gemini-2.5-flash', contents=prompt)
                    runbook_content = response.text
                    success = True
                    break
                except Exception as e:
                    err = str(e)
                    if any(c in err for c in ['429', '503', 'RESOURCE_EXHAUSTED']):
                        if attempt < 3:
                            wait = 20 * (2 ** attempt)
                            self.stdout.write(self.style.WARNING(f"  Waiting {wait}s..."))
                            time.sleep(wait)
                        else:
                            self.stdout.write(self.style.ERROR(f"  Failed after 4 attempts."))
                            this_failed = True; break
                    else:
                        self.stdout.write(self.style.ERROR(f"  Error: {e}"))
                        this_failed = True; break

            if this_failed:
                failed += 1
                continue

            if success and runbook_content:
                lines = [l.strip() for l in runbook_content.split('\n') if l.strip()]
                title = lines[0].lstrip('#*').strip() if lines else f"Runbook for Cluster {cluster.id}"
                if len(title) > 250:
                    title = f"Runbook for Cluster {cluster.id}"

                Runbook.objects.create(
                    cluster=cluster, version=next_version,
                    title=title, content=runbook_content,
                    created_by="Gemini", approved=False
                )
                if is_new:
                    cluster.label = title
                    cluster.save()
                    generated += 1
                else:
                    versioned += 1

                self.stdout.write(self.style.SUCCESS(
                    f"  ✅ Cluster {cluster.id} v{next_version}: '{title[:60]}'"))

            if success:
                time.sleep(18)

        self.stdout.write(self.style.SUCCESS(
            f'\n🎉 New: {generated} | Versioned: {versioned} | '
            f'Skipped: {skipped} | Failed: {failed}'))
        if failed > 0:
            self.stdout.write(self.style.WARNING(
                f"Rerun to retry {failed} failed. Use --cluster <id> for specific cluster."))