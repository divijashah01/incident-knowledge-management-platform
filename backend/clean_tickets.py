"""
Phase 2 - Step 6: Clean and Preprocess Ticket Data
Run from backend/ folder with venv active:
    python clean_tickets.py
Output: cleaned_tickets.csv saved in same folder as input
"""

import pandas as pd
import re
import os

# ─── CONFIG ───────────────────────────────────────────────
INPUT_PATH  = r"E:\Sem-4\edi-4\synthetic_support_tickets_v2.csv"
OUTPUT_PATH = r"E:\Sem-4\edi-4\cleaned_tickets_v2.csv"
# ──────────────────────────────────────────────────────────


def load_data(path):
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    return df


def rename_columns(df):
    """Rename columns to match Django model field names exactly."""
    df = df.rename(columns={
        'Ticket ID':                   'ticket_id',
        'Title':                       'title',
        'Category (Reported)':         'category_reported',
        'Domain':                      'domain',
        'Priority':                    'priority',
        'Severity':                    'severity',
        'Status':                      'status',
        'Created At':                  'created_at',
        'Resolved At':                 'resolved_at',
        'Description':                 'description',
        'Symptoms':                    'symptoms',
        'Impact':                      'impact',
        'Service / Component':         'service_component',
        'Environment':                 'environment',
        'Technology Stack':            'technology_stack',
        'Root Cause':                  'root_cause',
        'Resolution Steps':            'resolution_steps',
        'Runbook Available':           'runbook_available',
        'Runbook Used':                'runbook_used',
        'Manual Intervention Required':'manual_intervention',
        'True Category':               'true_category',
        'Predicted Category':          'predicted_category',
        'Confidence Score':            'confidence_score',
    })
    print("✓ Columns renamed")
    return df


def clean_whitespace(df):
    """Strip leading/trailing whitespace from all string columns."""
    str_cols = df.select_dtypes(include='str').columns
    df[str_cols] = df[str_cols].apply(lambda col: col.str.strip())
    print("✓ Whitespace stripped")
    return df


def convert_booleans(df):
    """Convert Yes/No strings to True/False booleans."""
    bool_cols = ['runbook_available', 'runbook_used', 'manual_intervention']
    for col in bool_cols:
        df[col] = df[col].str.strip().str.lower().map({'yes': True, 'no': False})
    print("✓ Boolean columns converted")
    return df


def convert_datetimes(df):
    """Parse datetime strings into proper datetime objects."""
    df['created_at']  = pd.to_datetime(df['created_at'],  format='%d-%m-%Y %H:%M', errors='coerce')
    df['resolved_at'] = pd.to_datetime(df['resolved_at'], format='%d-%m-%Y %H:%M', errors='coerce')
    print("✓ Datetime columns parsed")
    return df


def compute_resolution_time(df):
    """
    Compute resolution_time_minutes from created_at and resolved_at.
    Will be NULL for In Progress tickets (no resolved_at).
    """
    df['resolution_time_minutes'] = (
        (df['resolved_at'] - df['created_at'])
        .dt.total_seconds()
        .div(60)
        .round()
        .astype('Int64')   # nullable integer — handles NaN rows cleanly
    )
    resolved_count = df['resolution_time_minutes'].notna().sum()
    print(f"✓ resolution_time_minutes computed ({resolved_count} resolved, {df['resolution_time_minutes'].isna().sum()} null)")
    return df


def handle_nulls(df):
    """
    - resolved_at:        leave as NaT  (In Progress tickets, handled by model null=True)
    - resolution_steps:   fill with 'Pending' for In Progress tickets
    - predicted_category: already filled in dataset, leave as is
    - confidence_score:   already filled in dataset, leave as is
    """
    df['resolution_steps'] = df['resolution_steps'].fillna('Pending investigation')
    print(f"✓ Nulls handled")
    return df


def clean_text_fields(df):
    """
    Light cleaning on free-text fields:
    - Normalize multiple spaces to single space
    - Remove non-printable characters
    Keep original wording intact for NLP/embeddings quality.
    """
    text_cols = ['description', 'symptoms', 'impact', 'root_cause', 'resolution_steps']
    for col in text_cols:
        df[col] = df[col].apply(lambda x: re.sub(r'\s+', ' ', str(x)).strip() if pd.notna(x) else x)
    print("✓ Text fields lightly cleaned")
    return df


def validate(df):
    """Print a quick validation summary."""
    print("\n── Validation Summary ──────────────────────")
    print(f"Total rows          : {len(df)}")
    print(f"Null resolved_at    : {df['resolved_at'].isna().sum()}  (expected 20 — In Progress)")
    print(f"Null resolution_time: {df['resolution_time_minutes'].isna().sum()}  (expected 20)")
    print(f"Null resolution_step: {df['resolution_steps'].isna().sum()}  (expected 0)")
    print(f"Boolean cols sample :")
    print(df[['runbook_available', 'runbook_used', 'manual_intervention']].head(3))
    print(f"Datetime sample     :")
    print(df[['created_at', 'resolved_at']].head(3))
    print(f"resolution_time_min sample:")
    print(df['resolution_time_minutes'].head(5).tolist())
    print("────────────────────────────────────────────\n")


def main():
    df = load_data(INPUT_PATH)
    df = rename_columns(df)
    df = clean_whitespace(df)
    df = convert_booleans(df)
    df = convert_datetimes(df)
    df = compute_resolution_time(df)
    df = handle_nulls(df)
    df = clean_text_fields(df)
    validate(df)

    df.to_csv(OUTPUT_PATH, index=False)
    print(f"✓ Cleaned dataset saved to: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()