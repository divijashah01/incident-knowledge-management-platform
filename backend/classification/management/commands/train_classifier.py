import os
import joblib
import numpy as np
import pandas as pd
from django.core.management.base import BaseCommand
from django.conf import settings
from tickets.models import Ticket
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from scipy.sparse import hstack, csr_matrix


class Command(BaseCommand):
    help = 'Trains the ticket classification model and saves it to disk.'

    def handle(self, *args, **kwargs):

        # ── 1. FETCH DATA ─────────────────────────────────────────
        self.stdout.write("Fetching tickets from database...")
        tickets = Ticket.objects.exclude(true_category__isnull=True)

        if not tickets.exists():
            self.stdout.write(self.style.ERROR(
                'No tickets found. Run load_tickets first.'))
            return

        df = pd.DataFrame(list(tickets.values(
            'title', 'description', 'symptoms', 'impact',
            'domain', 'priority', 'severity', 'environment',
            'true_category'
        )))
        self.stdout.write(f"Loaded {len(df)} tickets.")

        # ── 2. FEATURE ENGINEERING ────────────────────────────────
        # Text: same 4 fields used in the notebook comparison study
        # Root cause and resolution_steps excluded — not available at
        # ticket submission time (would be data leakage)
        df['text_input'] = (
            df['title'].fillna('') + ' ' +
            df['description'].fillna('') + ' ' +
            df['symptoms'].fillna('') + ' ' +
            df['impact'].fillna('')
        )

        # Metadata: one-hot encode structural fields
        meta_df = pd.get_dummies(
            df[['domain', 'priority', 'severity', 'environment']],
            drop_first=True
        )

        X_text = df['text_input']
        X_meta = meta_df
        y      = df['true_category']

        # ── 3. TRAIN / TEST SPLIT ─────────────────────────────────
        # Stratified to preserve class proportions in both splits
        (X_text_train, X_text_test,
         X_meta_train, X_meta_test,
         y_train, y_test) = train_test_split(
            X_text, X_meta, y,
            test_size=0.2,
            random_state=42,
            stratify=y
        )
        self.stdout.write(
            f"Split: {len(X_text_train)} train / {len(X_text_test)} test")

        # ── 4. TF-IDF VECTORISATION ───────────────────────────────
        # Config matches the notebook that produced Macro F1 = 0.692
        tfidf = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=5000,
            sublinear_tf=True,
            min_df=2
        )
        X_train_tfidf = tfidf.fit_transform(X_text_train)
        X_test_tfidf  = tfidf.transform(X_text_test)

        # Combine TF-IDF + metadata (matches selected model: LR + Metadata)
        X_train_combined = hstack(
            [X_train_tfidf, csr_matrix(X_meta_train.values)])
        X_test_combined  = hstack(
            [X_test_tfidf,  csr_matrix(X_meta_test.values)])

        # ── 5. TRAIN ON TRAIN SPLIT, EVALUATE ON TEST ─────────────
        self.stdout.write("Training Logistic Regression + Metadata model...")
        clf = LogisticRegression(
            max_iter=1000,
            class_weight='balanced',
            random_state=42
        )
        clf.fit(X_train_combined, y_train)

        y_pred = clf.predict(X_test_combined)
        self.stdout.write("\nHeld-out Test Classification Report:")
        self.stdout.write(classification_report(y_test, y_pred))

        # ── 6. RETRAIN ON FULL DATA BEFORE SAVING ─────────────────
        # Evaluate on test set, but save a model trained on all data
        # so it benefits from the full 650 tickets
        self.stdout.write("Retraining on full dataset before saving...")
        X_full_tfidf    = tfidf.fit_transform(X_text)
        X_full_combined = hstack(
            [X_full_tfidf, csr_matrix(X_meta.values)])
        clf.fit(X_full_combined, y)

        # ── 7. SAVE MODEL ARTIFACTS ───────────────────────────────
        # Save three artifacts:
        #   ticket_classifier.pkl  — the trained LogisticRegression model
        #   tfidf_vectorizer.pkl   — fitted TF-IDF (needed at inference time)
        #   metadata_columns.pkl   — column list for one-hot alignment at inference
        models_dir = os.path.join(settings.BASE_DIR, 'ml_models')
        os.makedirs(models_dir, exist_ok=True)

        joblib.dump(clf,
            os.path.join(models_dir, 'ticket_classifier.pkl'))
        joblib.dump(tfidf,
            os.path.join(models_dir, 'tfidf_vectorizer.pkl'))
        joblib.dump(list(X_meta.columns),
            os.path.join(models_dir, 'metadata_columns.pkl'))

        self.stdout.write(self.style.SUCCESS(
            f'✅ Saved model artifacts to {models_dir}'))