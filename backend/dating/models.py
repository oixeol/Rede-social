"""
Modelos da área de namoro: perfis, respostas, curtidas, matches e Radar.
"""

from django.db import models

from accounts.models import User


class IdentityVerification(models.Model):
    """Verificação de identidade usada para liberar a área de namoro."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='identity_verification')
    provider = models.CharField(max_length=40)
    status = models.CharField(max_length=20, default='not_started')
    is_simulation = models.BooleanField(default=False)
    provider_ref = models.CharField(max_length=120, blank=True, default='')
    submitted_at = models.BigIntegerField(null=True, blank=True)
    reviewed_at = models.BigIntegerField(null=True, blank=True)
    expires_at = models.BigIntegerField(null=True, blank=True)
    reason = models.CharField(max_length=300, blank=True, default='')

    class Meta:
        db_table = 'identity_verifications'


class DatingProfile(models.Model):
    """Perfil de namoro — separado do perfil social."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='dating_profile')
    bio = models.CharField(max_length=500, blank=True, default='')
    photos = models.JSONField(default=list, blank=True)
    interests = models.JSONField(default=list, blank=True)
    goals = models.JSONField(default=list, blank=True)
    age_min = models.IntegerField(default=24)
    age_max = models.IntegerField(default=45)
    distance_km = models.IntegerField(default=50)
    active = models.BooleanField(default=True)
    paused = models.BooleanField(default=False)
    radar_enabled = models.BooleanField(default=True)
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'dating_profiles'
        indexes = [models.Index(fields=['active', 'paused'], name='idx_dating_active')]


class CompatibilityAnswer(models.Model):
    """Resposta do questionário de compatibilidade."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='compatibility_answers')
    question_id = models.CharField(max_length=40)
    answer = models.JSONField()
    updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'compatibility_answers'
        constraints = [
            models.UniqueConstraint(fields=['user', 'question_id'], name='uniq_answer_user_question'),
        ]


class DatingLike(models.Model):
    """Curtida (like) ou recusa (pass) na área de namoro."""

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dating_likes_given')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dating_likes_received')
    action = models.CharField(max_length=10)
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'dating_likes'
        constraints = [
            models.UniqueConstraint(fields=['from_user', 'to_user'], name='uniq_dating_like_pair'),
        ]
        indexes = [models.Index(fields=['to_user', 'action'], name='idx_dating_likes_target')]


class Match(models.Model):
    """Match de namoro entre dois usuários."""

    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_a')
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_b')
    created_at = models.BigIntegerField()
    ended_at = models.BigIntegerField(null=True, blank=True)
    ended_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matches_ended',
    )

    class Meta:
        db_table = 'matches'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(user_a__lt=models.F('user_b')),
                name='match_users_ordered',
            ),
            models.UniqueConstraint(
                fields=['user_a', 'user_b'],
                condition=models.Q(ended_at__isnull=True),
                name='uniq_active_match_pair',
            ),
        ]


class LocationConsent(models.Model):
    """Consentimento de compartilhamento de localização em um match."""

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='location_consents')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='location_consents')
    enabled = models.BooleanField(default=False)
    updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'location_consents'
        constraints = [
            models.UniqueConstraint(fields=['match', 'user'], name='uniq_location_consent'),
        ]


class LocationSnapshot(models.Model):
    """Última localização conhecida — nunca sai pela API."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='location_snapshot')
    lat = models.FloatField()
    lng = models.FloatField()
    accuracy = models.FloatField(default=0)
    updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'location_snapshots'


class RadarPref(models.Model):
    """Preferências de alerta do Radar."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='radar_pref')
    alerts_enabled = models.BooleanField(default=False)
    threshold_m = models.IntegerField(default=1000)
    updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'radar_prefs'


class RadarAlert(models.Model):
    """Registro do último alerta de proximidade enviado."""

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='radar_alerts')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='radar_alerts')
    last_notified_at = models.BigIntegerField()
    distance_m = models.IntegerField()

    class Meta:
        db_table = 'radar_alerts'
        constraints = [
            models.UniqueConstraint(fields=['match', 'user'], name='uniq_radar_alert'),
        ]
