# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from tickets.models import Ticket
from tickets.serializers import TicketSerializer
from rest_framework import status

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
    
    def post(self, request):
        serializer = TicketSerializer(data=request.data)
        if serializer.is_valid():
            ticket = serializer.save()
            return Response({'ticket_id': str(ticket.ticket_id)}, status=status.HTTP_201_CREATED)
        return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)