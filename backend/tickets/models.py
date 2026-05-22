from django.db import models
import uuid


class Ticket(models.Model):

    PRIORITY_CHOICES = [('P1', 'P1'), ('P2', 'P2'), ('P3', 'P3')]
    SEVERITY_CHOICES = [('Critical', 'Critical'), ('High', 'High'), ('Medium', 'Medium'), ('Low', 'Low')]
    STATUS_CHOICES   = [('Resolved', 'Resolved'), ('Closed', 'Closed'), ('In Progress', 'In Progress')]

    # Core fields
    ticket_id             = models.CharField(max_length=20, primary_key=True)
    title                 = models.CharField(max_length=255)
    category_reported     = models.CharField(max_length=100)
    domain                = models.CharField(max_length=100, db_index=True)
    priority              = models.CharField(max_length=5, choices=PRIORITY_CHOICES)
    severity              = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status                = models.CharField(max_length=20, choices=STATUS_CHOICES, db_index=True, default='In Progress')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Text fields
    description           = models.TextField()
    symptoms              = models.TextField()
    impact                = models.TextField()
    root_cause            = models.TextField()
    resolution_steps      = models.TextField()

    # Metadata
    service_component     = models.CharField(max_length=100)
    environment           = models.CharField(max_length=50)
    technology_stack      = models.CharField(max_length=255)

    # Flags
    runbook_available     = models.BooleanField(default=False, db_index=True)
    runbook_used          = models.BooleanField(default=False)
    manual_intervention   = models.BooleanField(default=False)

    # Classification
    true_category         = models.CharField(max_length=50, db_index=True)
    predicted_category    = models.CharField(max_length=50, null=True, blank=True)
    confidence_score      = models.FloatField(null=True, blank=True)

    # Analytics
    resolution_time_minutes = models.IntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.ticket_id:
            # Generates IDs like INC-A1B2C3D4
            self.ticket_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'tickets'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ticket_id} — {self.title}"


class Embedding(models.Model):
    ticket           = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='embeddings')
    embedding        = models.BinaryField()
    model_used       = models.CharField(max_length=100)
    vector_dimension = models.IntegerField()
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'embeddings'

    def __str__(self):
        return f"Embedding for {self.ticket_id} — {self.model_used}"


class Cluster(models.Model):
    label          = models.CharField(max_length=255, null=True, blank=True)
    algorithm_used = models.CharField(max_length=100)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'clusters'

    def __str__(self):
        return f"Cluster {self.id} — {self.label or 'Unlabelled'}"


class TicketCluster(models.Model):
    ticket  = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='ticket_clusters')
    cluster = models.ForeignKey(Cluster, on_delete=models.CASCADE, related_name='ticket_clusters')

    class Meta:
        db_table = 'ticket_clusters'
        unique_together = ('ticket', 'cluster')

    def __str__(self):
        return f"{self.ticket_id} → Cluster {self.cluster_id}"


class Runbook(models.Model):
    cluster      = models.ForeignKey(Cluster, on_delete=models.CASCADE, related_name='runbooks')
    version      = models.IntegerField(default=1)
    title        = models.CharField(max_length=255)
    content      = models.TextField()
    created_by   = models.CharField(max_length=100, null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    approved     = models.BooleanField(default=False)

    class Meta:
        db_table = 'runbooks'
        ordering = ['-version']

    def __str__(self):
        return f"Runbook v{self.version} — Cluster {self.cluster_id}"


class Postmortem(models.Model):
    ticket            = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='postmortems')
    content           = models.TextField()
    severity_snapshot = models.CharField(max_length=20)
    generated_at      = models.DateTimeField(auto_now_add=True)
    approved          = models.BooleanField(default=False)

    class Meta:
        db_table = 'postmortems'

    def __str__(self):
        return f"Postmortem for {self.ticket_id}"