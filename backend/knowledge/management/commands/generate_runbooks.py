import os
import time
from google import genai
from django.core.management.base import BaseCommand
from tickets.models import Cluster, Runbook


class Command(BaseCommand):
    help = 'Generates LLM runbooks for clusters. Skips clusters that already have one. Safe to rerun.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Delete all unapproved runbooks and regenerate from scratch'
        )

    def handle(self, *args, **kwargs):
        force = kwargs.get('force', False)

        # ── API KEY ───────────────────────────────────────────────
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self.stdout.write(self.style.ERROR(
                "GEMINI_API_KEY not set in environment."))
            return

        client = genai.Client(api_key=api_key)

        # ── OPTIONAL FORCE RESET ──────────────────────────────────
        if force:
            deleted = Runbook.objects.filter(approved=False).delete()
            self.stdout.write(self.style.WARNING(
                f"Force mode: deleted {deleted[0]} unapproved runbooks."))

        # ── FETCH CLUSTERS ────────────────────────────────────────
        clusters = Cluster.objects.prefetch_related(
            'ticket_clusters__ticket').all()

        if not clusters.exists():
            self.stdout.write(self.style.ERROR(
                "No clusters found. Run run_clustering first."))
            return

        total      = clusters.count()
        skipped    = 0
        generated  = 0
        failed     = 0

        self.stdout.write(f"Found {total} clusters.\n")

        for cluster in clusters:

            # ── SKIP IF ALREADY HAS A RUNBOOK ─────────────────────
            # This is the key fix: if a runbook already exists for this
            # cluster, skip it entirely. This makes the command safe to
            # rerun after partial failures without re-generating everything.
            if Runbook.objects.filter(cluster=cluster).exists():
                self.stdout.write(
                    f"Cluster {cluster.id}: already has runbook — skipping.")
                skipped += 1
                continue

            tickets = [tc.ticket for tc in cluster.ticket_clusters.all()][:10]
            if not tickets:
                self.stdout.write(
                    f"Cluster {cluster.id}: no tickets — skipping.")
                skipped += 1
                continue

            self.stdout.write(
                f"Generating runbook for Cluster {cluster.id} "
                f"({len(tickets)} tickets)...")

            # ── BUILD CONTEXT ─────────────────────────────────────
            context_lines = []
            for t in tickets:
                context_lines.append(
                    f"- Title: {t.title}\n"
                    f"  Symptoms: {t.symptoms}\n"
                    f"  Root Cause: {t.root_cause}\n"
                    f"  Resolution: {t.resolution_steps}"
                )
            context_text = "\n\n".join(context_lines)

            prompt = f"""You are an Expert Site Reliability Engineer (SRE).
I will provide you with a list of historical IT support tickets grouped into a cluster by a machine learning algorithm. They represent a recurring systemic issue.

Tickets:
{context_text}

Based ONLY on the provided tickets, generate a structured Runbook in clean Markdown.

Include these sections exactly:
1. Short, Descriptive Title (do not include the word "Runbook" in the title)
2. Systemic Root Cause Summary
3. Diagnostic Steps
4. Step-by-Step Resolution Workflow
5. Preventative Measures"""

            # ── RETRY LOOP ────────────────────────────────────────
            # Uses exponential backoff: 20s, 40s, 80s, 160s
            # Longer initial wait than before to respect free tier limits
            max_retries    = 4
            success        = False
            runbook_content = None

            for attempt in range(max_retries):
                try:
                    response = client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=prompt,
                    )
                    runbook_content = response.text
                    success = True
                    break

                except Exception as e:
                    error_str = str(e)
                    is_rate_limit = any(
                        code in error_str for code in ['429', '503', 'RESOURCE_EXHAUSTED'])

                    if is_rate_limit and attempt < max_retries - 1:
                        sleep_time = 20 * (2 ** attempt)   # 20, 40, 80, 160
                        self.stdout.write(self.style.WARNING(
                            f"  Rate limited. Waiting {sleep_time}s "
                            f"(attempt {attempt + 1}/{max_retries})..."))
                        time.sleep(sleep_time)
                    elif is_rate_limit:
                        self.stdout.write(self.style.ERROR(
                            f"  Cluster {cluster.id}: FAILED after "
                            f"{max_retries} attempts. Will be picked up on next run."))
                        failed += 1
                    else:
                        self.stdout.write(self.style.ERROR(
                            f"  Cluster {cluster.id}: Unhandled error — {e}"))
                        failed += 1
                        break

            # ── SAVE IF SUCCESSFUL ────────────────────────────────
            if success and runbook_content:
                # Extract title from first non-empty line
                lines = [l.strip() for l in runbook_content.split('\n') if l.strip()]
                generated_title = lines[0].lstrip('#').lstrip('*').strip() if lines else ''
                if not generated_title or len(generated_title) > 250:
                    generated_title = f"Runbook for Cluster {cluster.id}"

                Runbook.objects.create(
                    cluster=cluster,
                    version=1,
                    title=generated_title,
                    content=runbook_content,
                    created_by="Gemini",
                    approved=False
                )

                # Update cluster label with the LLM-generated title
                cluster.label = generated_title
                cluster.save()

                self.stdout.write(self.style.SUCCESS(
                    f"  ✅ Cluster {cluster.id}: saved — '{generated_title[:60]}'"))
                generated += 1

            # ── RATE LIMIT DELAY ──────────────────────────────────
            # Gemini free tier: 15 requests/minute max
            # 60s / 15 = 4s minimum. We use 18s to stay well within limits.
            # Only sleep after a successful call — failed calls already
            # waited during retries
            if success:
                time.sleep(18)

        # ── FINAL SUMMARY ─────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            f'\n🎉 Done. Generated: {generated} | Skipped: {skipped} | Failed: {failed}'))

        if failed > 0:
            self.stdout.write(self.style.WARNING(
                f"Re-run the command to retry {failed} failed cluster(s). "
                f"Already-generated runbooks will be skipped automatically."))