"""
Feature 5: MTTR Prediction
Train a regression model to predict resolution_time_minutes
for new tickets based on domain, severity, priority, environment,
and text features.

Run from backend/ with venv active:
    python manage.py train_mttr_model
"""

import os
import joblib
import numpy as np
import pandas as pd
from django.core.management.base import BaseCommand
from django.conf import settings
from tickets.models import Ticket
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
from scipy.sparse import hstack, csr_matrix


class Command(BaseCommand):
    help = 'Trains the MTTR prediction regression model and saves it to disk.'

    def handle(self, *args, **kwargs):

        # ── 1. FETCH RESOLVED TICKETS ONLY ────────────────────────
        # Only resolved/closed tickets have a real MTTR value.
        # In Progress tickets have null resolution_time_minutes.
        self.stdout.write("Fetching resolved tickets...")
        tickets = Ticket.objects.filter(
            status__in=['Resolved', 'Closed'],
            resolution_time_minutes__isnull=False
        ).values(
            'title', 'description', 'symptoms',
            'domain', 'priority', 'severity', 'environment',
            'resolution_time_minutes'
        )

        if not tickets:
            self.stdout.write(self.style.ERROR("No resolved tickets found."))
            return

        df = pd.DataFrame(list(tickets))
        self.stdout.write(f"Loaded {len(df)} resolved tickets.")
        self.stdout.write(
            f"MTTR range: {df['resolution_time_minutes'].min()}m "
            f"– {df['resolution_time_minutes'].max()}m | "
            f"Mean: {df['resolution_time_minutes'].mean():.0f}m"
        )

        # ── 2. FEATURE ENGINEERING ────────────────────────────────
        df['text_input'] = (
            df['title'].fillna('') + ' ' +
            df['description'].fillna('') + ' ' +
            df['symptoms'].fillna('')
        )

        meta_df = pd.get_dummies(
            df[['domain', 'priority', 'severity', 'environment']],
            drop_first=True
        )

        X_text = df['text_input']
        X_meta = meta_df
        y      = df['resolution_time_minutes'].astype(float)

        # ── 3. TRAIN/TEST SPLIT ───────────────────────────────────
        (X_text_train, X_text_test,
         X_meta_train, X_meta_test,
         y_train, y_test) = train_test_split(
            X_text, X_meta, y,
            test_size=0.2, random_state=42
        )

        # ── 4. TF-IDF ─────────────────────────────────────────────
        tfidf = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=3000,
            sublinear_tf=True,
            min_df=2
        )
        X_train_tfidf = tfidf.fit_transform(X_text_train)
        X_test_tfidf  = tfidf.transform(X_text_test)

        X_train = hstack([X_train_tfidf, csr_matrix(X_meta_train.values)])
        X_test  = hstack([X_test_tfidf,  csr_matrix(X_meta_test.values)])

        # ── 5. TRAIN REGRESSION MODEL ─────────────────────────────
        # GradientBoostingRegressor handles non-linear relationships
        # between ticket features and resolution time well.
        self.stdout.write("Training GradientBoosting regressor...")
        model = GradientBoostingRegressor(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            random_state=42
        )
        model.fit(X_train, y_train)

        # ── 6. EVALUATE ───────────────────────────────────────────
        y_pred = model.predict(X_test)
        mae    = mean_absolute_error(y_test, y_pred)
        r2     = r2_score(y_test, y_pred)

        self.stdout.write(f"\nTest MAE : {mae:.1f} minutes")
        self.stdout.write(f"Test R²  : {r2:.3f}")
        self.stdout.write(
            f"(MAE = average prediction error in minutes; "
            f"R² = 1.0 is perfect, 0.0 is no better than mean)")

        # ── 7. RETRAIN ON FULL DATA ───────────────────────────────
        self.stdout.write("\nRetraining on full dataset before saving...")
        X_full_tfidf = tfidf.fit_transform(X_text)
        X_full       = hstack([X_full_tfidf, csr_matrix(X_meta.values)])
        model.fit(X_full, y)

        # ── 8. SAVE ARTIFACTS ─────────────────────────────────────
        models_dir = os.path.join(settings.BASE_DIR, 'ml_models')
        os.makedirs(models_dir, exist_ok=True)

        joblib.dump(model, os.path.join(models_dir, 'mttr_model.pkl'))
        joblib.dump(tfidf, os.path.join(models_dir, 'mttr_tfidf.pkl'))
        joblib.dump(list(X_meta.columns),
                    os.path.join(models_dir, 'mttr_metadata_columns.pkl'))

        self.stdout.write(self.style.SUCCESS(
            f'✅ MTTR model saved to {models_dir}'))
        self.stdout.write(
            f"Saved: mttr_model.pkl, mttr_tfidf.pkl, mttr_metadata_columns.pkl")