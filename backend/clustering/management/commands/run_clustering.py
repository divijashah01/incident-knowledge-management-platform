import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from django.core.management.base import BaseCommand
from tickets.models import Ticket, Embedding, Cluster, TicketCluster


class Command(BaseCommand):
    help = 'Performs K-Means clustering on ticket embeddings and saves results to DB.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run clustering and show results without saving'
        )

    def handle(self, *args, **kwargs):

        # ── 1. FETCH RESOLVED/CLOSED TICKETS ─────────────────────
        self.stdout.write("Fetching resolved/closed tickets...")
        resolved_tickets = Ticket.objects.filter(
            status__in=['Resolved', 'Closed']
        ).prefetch_related('embeddings')

        if not resolved_tickets.exists():
            self.stdout.write(self.style.ERROR("No resolved tickets found."))
            return

        # ── 2. EXTRACT VECTORS (no N+1) ───────────────────────────
        ticket_ids = []
        vectors    = []

        for ticket in resolved_tickets:
            emb_obj = ticket.embeddings.first()
            if emb_obj and emb_obj.embedding:
                ticket_ids.append(ticket.ticket_id)
                vector = np.frombuffer(
                    bytes(emb_obj.embedding), dtype=np.float32).copy()
                vectors.append(vector)

        if not vectors:
            self.stdout.write(self.style.ERROR(
                "No embeddings found. Run generate_embeddings first."))
            return

        X = np.array(vectors)
        self.stdout.write(
            f"Loaded {len(X)} vectors of dimension {X.shape[1]}.")

        # ── 3. DETERMINE N_CLUSTERS ───────────────────────────────
        # Reasoning: 8 domains × ~2 dominant incident patterns per domain
        # = ~16 natural groupings. We use 15 as a round number that avoids
        # over-fragmenting small domains while capturing cross-domain patterns.
        # For a more rigorous selection, run the elbow method below:
        #
        #   inertias = []
        #   for k in range(5, 25):
        #       km = KMeans(n_clusters=k, random_state=42, n_init=10)
        #       km.fit(X)
        #       inertias.append(km.inertia_)
        #   plt.plot(range(5, 25), inertias, 'bo-')
        #   plt.xlabel('k'); plt.ylabel('Inertia'); plt.show()
        #
        n_clusters = 15

        # ── 4. RUN K-MEANS ────────────────────────────────────────
        self.stdout.write(
            f"Running K-Means with n_clusters={n_clusters}...")
        kmeans = KMeans(
            n_clusters=n_clusters,
            random_state=42,
            n_init=10
        )
        labels = kmeans.fit_predict(X)

        # ── 5. SILHOUETTE SCORE ───────────────────────────────────
        # Measures cluster quality: 1.0 = perfect separation,
        # 0.0 = overlapping clusters, negative = wrong assignments
        # Values above 0.3 are generally considered acceptable
        sil_score = silhouette_score(
            X, labels, sample_size=min(500, len(X)), random_state=42)
        self.stdout.write(
            f"Silhouette Score: {sil_score:.4f} "
            f"({'good' if sil_score > 0.3 else 'acceptable' if sil_score > 0.15 else 'low — consider adjusting n_clusters'})"
        )

        # ── 6. CLUSTER SIZE SUMMARY ───────────────────────────────
        unique, counts = np.unique(labels, return_counts=True)
        self.stdout.write("Cluster sizes:")
        for cid, cnt in sorted(zip(unique, counts),
                               key=lambda x: -x[1]):
            self.stdout.write(f"  Cluster {cid + 1}: {cnt} tickets")

        if kwargs['dry_run']:
            self.stdout.write(
                self.style.SUCCESS("Dry run complete. No database changes made.")
            )
            return

        # ── 7. SAVE TO DATABASE ───────────────────────────────────
        self.stdout.write("Clearing old clusters and saving new ones...")
        Cluster.objects.all().delete()  # cascades to TicketCluster

        # Create all Cluster records
        cluster_objects = {}
        for cid in range(n_clusters):
            cluster_model = Cluster.objects.create(
                label=f"Auto-Cluster {cid + 1}",  # LLM renames in Phase 6
                algorithm_used=f"K-Means (n_clusters={n_clusters})"
            )
            cluster_objects[cid] = cluster_model

        # ── 8. BULK FETCH TICKETS (no N+1) ────────────────────────
        ticket_map = {
            t.ticket_id: t
            for t in Ticket.objects.filter(ticket_id__in=ticket_ids)
        }

        # Create TicketCluster links in bulk
        links = []
        for i, ticket_id in enumerate(ticket_ids):
            ticket  = ticket_map.get(ticket_id)
            cluster = cluster_objects[labels[i]]
            if ticket:
                links.append(TicketCluster(ticket=ticket, cluster=cluster))

        TicketCluster.objects.bulk_create(links)

        self.stdout.write(self.style.SUCCESS(
            f'✅ Grouped {len(X)} tickets into {n_clusters} clusters. '
            f'Silhouette: {sil_score:.4f}'))