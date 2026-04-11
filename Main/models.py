from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    
    # 🌟 用來顯示在過磅人員選單上的真實姓名
    name = models.CharField(max_length=50, blank=True, null=True, verbose_name="真實姓名")
    
    code = models.CharField(max_length=20, blank=True, null=True)
    theme_preference = models.CharField(
        max_length=10,
        choices=[
            ('system', 'Follow System'),
            ('light', 'Light'),
            ('dark', 'Dark'),
        ],
        default='system'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.name:
            return f"{self.user.username} ({self.name})"
        return self.user.username

# Signal to auto-create profile when user is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance, code=f"USER{instance.id:04d}")

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()