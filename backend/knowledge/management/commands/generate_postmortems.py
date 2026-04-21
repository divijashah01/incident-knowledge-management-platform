import os
import time
from google import genai
from django.core.management.base import BaseCommand
from tickets.models import Ticket, Postmortem


class Command(BaseCommand):
    help = 'Generates LLM postmortems for Critical severity resolved tickets. Safe to rerun.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Delete all unapproved postmortems and regenerate from scratch'
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
            deleted = Postmortem.objects.filter(approved=False).delete()
            self.stdout.write(self.style.WARNING(
                f"Force mode: deleted {deleted[0]} unapproved postmortems."))

        # ── FETCH TICKETS ─────────────────────────────────────────
        # Postmortems are generated only for Critical severity tickets
        # that are fully resolved or closed.
        # NOTE: severity and priority are separate fields.
        #   severity = Critical / High / Medium / Low
        #   priority = P1 / P2 / P3
        # We filter on severity=Critical (most impactful incidents).
        # In a real environment this would also include High severity,
        # but for this dataset Critical keeps the count manageable for
        # the Gemini free tier rate limit.
        tickets = Ticket.objects.filter(
            severity='Critical',
            status__in=['Resolved', 'Closed']
        )

        if not tickets.exists():
            self.stdout.write(self.style.ERROR(
                "No resolved Critical-severity tickets found."))
            return

        total = tickets.count()
        self.stdout.write(
            f"Found {total} Critical-severity resolved tickets.\n")

        generated = 0
        skipped   = 0
        failed    = 0

        for ticket in tickets:

            # ── SKIP IF ALREADY HAS A POSTMORTEM ──────────────────
            # Makes this command safe to rerun after partial failures.
            if Postmortem.objects.filter(ticket=ticket).exists():
                self.stdout.write(
                    f"Ticket {ticket.ticket_id}: already has postmortem — skipping.")
                skipped += 1
                continue

            self.stdout.write(
                f"Generating postmortem for {ticket.ticket_id} "
                f"({ticket.title[:50]})...")

            # ── BUILD PROMPT ──────────────────────────────────────
            prompt = f"""You are an Expert Site Reliability Engineer promoting a Blameless Culture.
Draft a Postmortem for the following high-severity incident.

Incident Details:
- Title: {ticket.title}
- Description: {ticket.description}
- Symptoms: {ticket.symptoms}
- Impact: {ticket.impact}
- Root Cause: {ticket.root_cause}
- Resolution: {ticket.resolution_steps}
- Created At: {ticket.created_at}
- Resolved At: {ticket.resolved_at}
- Duration: {ticket.resolution_time_minutes} minutes

Output clean Markdown with exactly these sections:
1. Executive Summary
2. Incident Timeline
3. Root Cause Analysis (5 Whys)
4. Actionable Remediation Items"""

            # ── RETRY LOOP ────────────────────────────────────────
            # Exponential backoff: 20s, 40s, 80s, 160s
            # failed flag set only once outside the loop to avoid
            # double-counting a single ticket across retry attempts
            max_retries     = 4
            success         = False
            this_one_failed = False

            for attempt in range(max_retries):
                try:
                    response = client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=prompt,
                    )
                    postmortem_content = response.text
                    success = True
                    break

                except Exception as e:
                    error_str = str(e)
                    is_rate_limit = any(
                        code in error_str
                        for code in ['429', '503', 'RESOURCE_EXHAUSTED']
                    )

                    if is_rate_limit and attempt < max_retries - 1:
                        sleep_time = 20 * (2 ** attempt)  # 20, 40, 80, 160
                        self.stdout.write(self.style.WARNING(
                            f"  Rate limited. Waiting {sleep_time}s "
                            f"(attempt {attempt + 1}/{max_retries})..."))
                        time.sleep(sleep_time)

                    elif is_rate_limit:
                        # Final attempt also failed
                        self.stdout.write(self.style.ERROR(
                            f"  {ticket.ticket_id}: failed after "
                            f"{max_retries} attempts. Will retry on next run."))
                        this_one_failed = True
                        break

                    else:
                        # Non-rate-limit error — don't retry
                        self.stdout.write(self.style.ERROR(
                            f"  {ticket.ticket_id}: unhandled error — {e}"))
                        this_one_failed = True
                        break

            if this_one_failed:
                failed += 1
                # No sleep — failed calls already waited during retries
                continue

            # ── SAVE POSTMORTEM ───────────────────────────────────
            if success:
                Postmortem.objects.create(
                    ticket=ticket,
                    content=postmortem_content,
                    severity_snapshot=ticket.severity,  # snapshot at generation time
                    approved=False
                )
                self.stdout.write(self.style.SUCCESS(
                    f"  ✅ {ticket.ticket_id}: postmortem saved."))
                generated += 1

                # ── RATE LIMIT DELAY ──────────────────────────────
                # Gemini free tier: 15 requests/minute max.
                # 60 / 15 = 4s minimum. 18s gives a comfortable margin.
                # Only sleep after a successful call — failed calls
                # already burned time in retry waits.
                time.sleep(18)

        # ── FINAL SUMMARY ─────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            f'\n🎉 Done. '
            f'Generated: {generated} | Skipped: {skipped} | Failed: {failed} '
            f'| Total: {total}'))

        if failed > 0:
            self.stdout.write(self.style.WARNING(
                f"Rerun the command to retry {failed} failed ticket(s). "
                f"Already-generated postmortems will be skipped automatically."))