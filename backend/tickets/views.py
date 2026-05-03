# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from tickets.models import Ticket

class TicketListView(APIView):
    def get(self, request):
        tickets = Ticket.objects.values(
            'ticket_id','title','domain','priority','severity',
            'status','true_category','predicted_category',
            'confidence_score','resolution_time_minutes',
            'description','resolution_steps','runbook_available',
            'environment','created_at','resolved_at'
        )
        return Response({'tickets': list(tickets)})