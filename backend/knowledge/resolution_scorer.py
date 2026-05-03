"""
Feature 3: Resolution Quality Scorer
Standalone module — imported by knowledge/views.py

Scores a resolution note 0-100 across 5 dimensions:
  - root_cause            (25pts) — did they explain what caused it?
  - steps                 (25pts) — did they describe what they did?
  - prevention            (20pts) — did they mention how to prevent recurrence?
  - impact_acknowledged   (15pts) — did they mention who/what was affected?
  - length                (15pts) — is the note long enough to be useful?

Grade scale: A≥90, B≥75, C≥60, D≥40, F<40
Acceptable threshold: score >= 60 (grade C or above)
"""

import re

RULES = [
    {
        "label":    "root_cause",
        "weight":   25,
        "patterns": [
            r'\broot cause\b', r'\bcaused by\b', r'\bbecause\b',
            r'\bdue to\b', r'\bresulted from\b', r'\bunderlying\b',
            r'\btriggered by\b', r'\borigin\b',
        ],
        "feedback": "Missing root cause — explain what fundamentally caused the issue."
    },
    {
        "label":    "steps",
        "weight":   25,
        "patterns": [
            r'\b(step|steps)\b', r'\d+\.\s',
            r'\bfirst\b', r'\bthen\b', r'\bfinally\b',
            r'\b(ran|executed|applied|restarted|rolled back|reverted|deployed|fixed)\b',
            r'\bwe (did|ran|restarted|deployed|reverted|fixed)\b',
        ],
        "feedback": "Missing resolution steps — describe the actions taken to fix the issue."
    },
    {
        "label":    "prevention",
        "weight":   20,
        "patterns": [
            r'\bprevent\b', r'\bmonitor\b', r'\balert\b',
            r'\bautomated?\b', r'\bgoing forward\b', r'\bin future\b',
            r'\bto avoid\b', r'\baction item\b', r'\bfollow.?up\b',
            r'\bimprovement\b', r'\bupgrade\b', r'\bmitigation\b',
        ],
        "feedback": "Missing preventative measures — add what will stop this from recurring."
    },
    {
        "label":    "impact_acknowledged",
        "weight":   15,
        "patterns": [
            r'\buser[s]?\b', r'\baffected\b', r'\bdowntime\b',
            r'\boutage\b', r'\bdegraded\b', r'\bimpact\b',
            r'\bcustomer[s]?\b', r'\bservice\b',
        ],
        "feedback": "Impact not acknowledged — mention who or what was affected."
    },
    {
        "label":    "length",
        "weight":   15,
        "patterns": [],
        "feedback": "Resolution note is too short — aim for at least 30 words."
    },
]

MIN_WORDS = 30


def score_resolution(text):
    """
    Score a resolution note and return structured feedback.

    Returns dict:
        score      : int   0-100
        grade      : str   A/B/C/D/F
        passed     : list  of check labels that passed
        feedback   : list  of improvement suggestions
        breakdown  : dict  {label: {score, max, detail?}}
        word_count : int
    """
    if not text or not text.strip():
        return {
            "score":     0,
            "grade":     "F",
            "passed":    [],
            "feedback":  ["Resolution note is empty."],
            "breakdown": {},
            "word_count": 0,
        }

    text_lower = text.lower()
    words      = text_lower.split()
    score      = 0
    passed     = []
    feedback   = []
    breakdown  = {}

    for rule in RULES:
        label  = rule["label"]
        weight = rule["weight"]
        fb     = rule["feedback"]

        if label == "length":
            if len(words) >= MIN_WORDS:
                score += weight
                passed.append(label)
                breakdown[label] = {"score": weight, "max": weight}
            else:
                feedback.append(fb)
                breakdown[label] = {
                    "score":  0,
                    "max":    weight,
                    "detail": f"{len(words)} words found, need {MIN_WORDS}."
                }
        else:
            matched = any(re.search(p, text_lower) for p in rule["patterns"])
            if matched:
                score += weight
                passed.append(label)
                breakdown[label] = {"score": weight, "max": weight}
            else:
                feedback.append(fb)
                breakdown[label] = {"score": 0, "max": weight}

    if score >= 90:   grade = "A"
    elif score >= 75: grade = "B"
    elif score >= 60: grade = "C"
    elif score >= 40: grade = "D"
    else:             grade = "F"

    return {
        "score":     score,
        "grade":     grade,
        "passed":    passed,
        "feedback":  feedback,
        "breakdown": breakdown,
        "word_count": len(words),
    }