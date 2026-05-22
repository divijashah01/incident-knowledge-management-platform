from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('reporter', 'Reporter'),
        ('engineer', 'Engineer'),
        ('admin',    'Admin'),
    ]

    user       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role       = models.CharField(max_length=20, choices=ROLE_CHOICES, default='reporter')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f"{self.user.username} ({self.role})"