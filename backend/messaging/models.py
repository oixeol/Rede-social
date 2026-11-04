"""
Modelos de mensagens: conversas, participantes e mensagens.
"""

from django.db import models

from accounts.models import User


class Conversation(models.Model):
    """Conversa social ou de namoro."""

    kind = models.CharField(max_length=10, default='social')
    match = models.OneToOneField(
        'dating.Match',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversation',
    )
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'conversations'
        ordering = ['-updated_at', '-id']


class ConversationMember(models.Model):
    """Participante de uma conversa, com marcação da última leitura."""

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='members',
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversation_memberships')
    last_read_at = models.BigIntegerField(default=0)
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'conversation_members'
        constraints = [
            models.UniqueConstraint(fields=['conversation', 'user'], name='uniq_conversation_member'),
        ]


class Message(models.Model):
    """Mensagem trocada em uma conversa."""

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    body = models.CharField(max_length=2000, blank=True, default='')
    shared_post = models.ForeignKey(
        'social.Post',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shared_messages',
    )
    created_at = models.BigIntegerField()
    deleted_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'messages'
        ordering = ['created_at', 'id']
        indexes = [models.Index(fields=['conversation', 'created_at'], name='idx_messages_conversation')]
