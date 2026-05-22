# serializers.py
from rest_framework import serializers
from .models import Ticket

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = [
            'title', 'description', 'symptoms', 'impact',
            'domain', 'priority', 'severity', 'environment',
            'predicted_category', 'confidence_score',
        ]
        extra_kwargs = {
            'symptoms':           {'required': False, 'allow_blank': True},
            'impact':             {'required': False, 'allow_blank': True},
            'predicted_category': {'required': False, 'allow_null': True},
            'confidence_score':   {'required': False, 'allow_null': True},
        }