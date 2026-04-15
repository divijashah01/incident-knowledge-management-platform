"""
Phase 2 - Step 7: Insert cleaned dataset into PostgreSQL via Django ORM
Run from backend/ folder with venv active:
    python manage.py load_tickets
"""

import os
import pandas as pd
from django.core.management.base import BaseCommand
from django.conf import settings
from tickets.models import Ticket


DATA_PATH = os.path.join(settings.BASE_DIR, 'data', 'cleaned_tickets_v2.csv')


class Command(BaseCommand):
    help = 'Load cleaned tickets CSV into the database'

    def handle(self, *args, **kwargs):

        # ── Load CSV ──────────────────────────────────────
        self.stdout.write(f"Loading data from: {DATA_PATH}")
        df = pd.read_csv(DATA_PATH)
        self.stdout.write(f"Found {len(df)} rows")

        # ── Convert types ─────────────────────────────────
        df['created_at']  = pd.to_datetime(df['created_at'],  errors='coerce', utc=True)
        df['resolved_at'] = pd.to_datetime(df['resolved_at'], errors='coerce', utc=True)

        bool_cols = ['runbook_available', 'runbook_used', 'manual_intervention']
        for col in bool_cols:
            df[col] = df[col].map({True: True, False: False, 'True': True, 'False': False})

        # ── Insert rows ───────────────────────────────────
        created_count = 0
        skipped_count = 0
        errors        = []

        for _, row in df.iterrows():
            try:
                obj, created = Ticket.objects.get_or_create(
                    ticket_id=row['ticket_id'],
                    defaults={
                        'title':                   row['title'],
                        'category_reported':       row['category_reported'],
                        'domain':                  row['domain'],
                        'priority':                row['priority'],
                        'severity':                row['severity'],
                        'status':                  row['status'],
                        'created_at':              row['created_at'],
                        'resolved_at':             row['resolved_at'] if pd.notna(row['resolved_at']) else None,
                        'description':             row['description'],
                        'symptoms':                row['symptoms'],
                        'impact':                  row['impact'],
                        'service_component':       row['service_component'],
                        'environment':             row['environment'],
                        'technology_stack':        row['technology_stack'],
                        'root_cause':              row['root_cause'],
                        'resolution_steps':        row['resolution_steps'],
                        'runbook_available':       bool(row['runbook_available']),
                        'runbook_used':            bool(row['runbook_used']),
                        'manual_intervention':     bool(row['manual_intervention']),
                        'true_category':           row['true_category'],
                        'predicted_category':      row['predicted_category'] if pd.notna(row['predicted_category']) else None,
                        'confidence_score':        row['confidence_score']   if pd.notna(row['confidence_score'])   else None,
                        'resolution_time_minutes': int(row['resolution_time_minutes']) if pd.notna(row['resolution_time_minutes']) else None,
                    }
                )
                if created:
                    created_count += 1
                else:
                    skipped_count += 1

            except Exception as e:
                errors.append((row['ticket_id'], str(e)))

        # ── Summary ───────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(f"\n✓ Inserted : {created_count} tickets"))
        if skipped_count:
            self.stdout.write(self.style.WARNING(f"⚠ Skipped  : {skipped_count} (already exist)"))
        if errors:
            self.stdout.write(self.style.ERROR(f"✗ Errors   : {len(errors)}"))
            for ticket_id, err in errors:
                self.stdout.write(self.style.ERROR(f"  {ticket_id}: {err}"))
        else:
            self.stdout.write(self.style.SUCCESS("✓ No errors"))

        self.stdout.write(self.style.SUCCESS(f"✓ Done. Total in DB: {Ticket.objects.count()} tickets"))