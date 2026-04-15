import os
import joblib
import pandas as pd
from django.core.management.base import BaseCommand
from django.conf import settings
from tickets.models import Ticket # Adjust import if your model name differs
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

class Command(BaseCommand):
    help = 'Trains the ticket classification model using data from the database and saves it.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Fetching data from the database...")
        # Exclude tickets that don't have a true category
        tickets = Ticket.objects.exclude(true_category__isnull=True)
        
        if not tickets.exists():
            self.stdout.write(self.style.ERROR('No tickets found in the database. Please run Phase 2 load_tickets first.'))
            return

        # Load into DataFrame
        df = pd.DataFrame(list(tickets.values('description', 'symptoms', 'true_category')))
        
        # Combine text fields to replicate notebook behavior
        df['text'] = df['description'].fillna('') + " " + df['symptoms'].fillna('')
        X = df['text']
        y = df['true_category']

        # Build Pipeline based on Phase 3.0 selected model
        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=5000, stop_words='english')),
            ('clf', LogisticRegression(max_iter=1000, class_weight='balanced'))
        ])

        self.stdout.write("Training Logistic Regression model...")
        pipeline.fit(X, y)

        # Print quick evaluation metrics to terminal
        predictions = pipeline.predict(X)
        self.stdout.write("\nTraining Classification Report:")
        self.stdout.write(classification_report(y, predictions))

        # Save the trained model
        models_dir = os.path.join(settings.BASE_DIR, 'ml_models')
        os.makedirs(models_dir, exist_ok=True)
        model_path = os.path.join(models_dir, 'ticket_classifier.pkl')
        
        joblib.dump(pipeline, model_path)
        self.stdout.write(self.style.SUCCESS(f'✅ Successfully saved trained model to {model_path}'))