import numpy as np
from sklearn.cluster import KMeans
from django.core.management.base import BaseCommand
from tickets.models import Ticket, Embedding, Cluster, TicketCluster

class Command(BaseCommand):
    help = 'Performs K-Means clustering on embeddings of resolved tickets.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Fetching embeddings for Resolved/Closed tickets...")
        
        # 1. Filter tickets that are Resolved or Closed
        resolved_tickets = Ticket.objects.filter(status__in=['Resolved', 'Closed'])
        
        if not resolved_tickets.exists():
            self.stdout.write(self.style.ERROR("No resolved tickets found."))
            return

        # 2. Extract vectors and keep track of ticket IDs
        ticket_ids = []
        vectors = []
        
        for ticket in resolved_tickets:
            # Get the first embedding for the ticket
            emb_obj = ticket.embeddings.first()
            if emb_obj and emb_obj.embedding:
                ticket_ids.append(ticket.ticket_id)
                # Decode the binary vector back to a numpy float32 array
                vector = np.frombuffer(emb_obj.embedding, dtype=np.float32)
                vectors.append(vector)

        if not vectors:
            self.stdout.write(self.style.ERROR("No embeddings found. Run Phase 4 generate_embeddings first."))
            return

        X = np.array(vectors)
        self.stdout.write(f"Loaded {len(X)} vectors of dimension {X.shape[1]}.")

        # 3. Perform K-Means Clustering
        # For 650 tickets, 15-20 clusters is a good starting point to find specific patterns
        n_clusters = 15 
        self.stdout.write(f"Running K-Means algorithm to find {n_clusters} patterns...")
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X)

        # 4. Save to Database
        self.stdout.write("Saving clusters to database...")
        
        # Clear old clusters (TicketCluster mappings will cascade/delete automatically)
        Cluster.objects.all().delete()

        cluster_objects = {}
        for cluster_id in range(n_clusters):
            # Create a new Cluster record
            cluster_model = Cluster.objects.create(
                label=f"Auto-Cluster {cluster_id + 1}", # LLM will rename this in Phase 6
                algorithm_used="K-Means (n=15)"
            )
            cluster_objects[cluster_id] = cluster_model

        # Map tickets to their new clusters
        ticket_cluster_links = []
        for i, ticket_id in enumerate(ticket_ids):
            assigned_cluster_id = labels[i]
            ticket_model = Ticket.objects.get(ticket_id=ticket_id)
            
            ticket_cluster_links.append(
                TicketCluster(
                    ticket=ticket_model,
                    cluster=cluster_objects[assigned_cluster_id]
                )
            )

        TicketCluster.objects.bulk_create(ticket_cluster_links)

        self.stdout.write(self.style.SUCCESS(f'✅ Successfully grouped {len(X)} tickets into {n_clusters} clusters!'))