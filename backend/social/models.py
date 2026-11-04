"""
Modelos da área social: publicações, stories, relacionamentos e moderação.

Os nomes das tabelas e dos campos espelham o schema do servidor Node.js.
Todos os timestamps são inteiros em milissegundos Unix, igual ao Node, para
que a conversão na fronteira da API seja direta.
"""

from django.db import models

from accounts.models import User


class Post(models.Model):
    """Publicação de foto ou vídeo."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    image = models.CharField(max_length=255)
    caption = models.CharField(max_length=2200, blank=True, default='')
    media_type = models.CharField(max_length=10, default='image')
    topic = models.CharField(max_length=30, default='cotidiano')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'posts'
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['user', '-created_at'], name='idx_posts_user')]

    def __str__(self):
        return f'post:{self.pk}'


class PostMedia(models.Model):
    """Mídia adicional de uma publicação (carrossel)."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='media')
    url = models.CharField(max_length=255)
    media_type = models.CharField(max_length=10, default='image')
    position = models.IntegerField(default=0)

    class Meta:
        db_table = 'post_media'
        ordering = ['post_id', 'position', 'id']
        indexes = [models.Index(fields=['post', 'position', 'id'], name='idx_post_media_post')]

    def __str__(self):
        return f'media:{self.pk}'


class Like(models.Model):
    """Curtida em uma publicação."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='likes')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes_set')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'likes'
        constraints = [
            models.UniqueConstraint(fields=['user', 'post'], name='uniq_like_user_post'),
        ]


class Comment(models.Model):
    """Comentário em uma publicação."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    text = models.CharField(max_length=500)
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'comments'
        ordering = ['created_at', 'id']
        indexes = [models.Index(fields=['post', 'created_at'], name='idx_comments_post')]


class Follow(models.Model):
    """Vínculo de seguimento."""

    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following_set')
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name='follower_set')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'follows'
        constraints = [
            models.UniqueConstraint(fields=['follower', 'following'], name='uniq_follow_pair'),
        ]


class FollowRequest(models.Model):
    """Solicitação de seguimento para perfis privados."""

    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='follow_requests_made')
    target = models.ForeignKey(User, on_delete=models.CASCADE, related_name='follow_requests_received')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'follow_requests'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['requester', 'target'], name='uniq_follow_request_pair'),
        ]


class CloseFriend(models.Model):
    """Melhor amigo — vê stories exclusivos."""

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='close_friends_set')
    friend = models.ForeignKey(User, on_delete=models.CASCADE, related_name='close_friends_of')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'close_friends'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'friend'], name='uniq_close_friend_pair'),
        ]


class Story(models.Model):
    """Story temporário (expira em 24 horas)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    image = models.CharField(max_length=255)
    media_type = models.CharField(max_length=10, default='image')
    audience = models.CharField(max_length=20, default='public')
    caption = models.CharField(max_length=300, blank=True, default='')
    mentions = models.JSONField(default=list, blank=True)
    created_at = models.BigIntegerField()
    expires_at = models.BigIntegerField()

    class Meta:
        db_table = 'stories'
        ordering = ['created_at', 'id']
        indexes = [models.Index(fields=['expires_at'], name='idx_stories_expiry')]


class StoryView(models.Model):
    """Registro de visualização de um story."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='story_views')
    viewed_at = models.BigIntegerField()

    class Meta:
        db_table = 'story_views'
        constraints = [
            models.UniqueConstraint(fields=['story', 'user'], name='uniq_story_view'),
        ]


class StoryReaction(models.Model):
    """Reação com emoji a um story."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='story_reactions')
    emoji = models.CharField(max_length=8)
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'story_reactions'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['story', 'user'], name='uniq_story_reaction'),
        ]


class Share(models.Model):
    """Compartilhamento de publicação."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shares')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='shares_set')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'shares'
        constraints = [
            models.UniqueConstraint(fields=['user', 'post'], name='uniq_share_pair'),
        ]


class Block(models.Model):
    """Bloqueio entre dois usuários — sempre bilateral."""

    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocks_given')
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocks_received')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'blocks'
        constraints = [
            models.UniqueConstraint(fields=['blocker', 'blocked'], name='uniq_block_pair'),
        ]


class Notification(models.Model):
    """Notificação persistida do usuário."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=40)
    text = models.CharField(max_length=500)
    link = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.BigIntegerField()
    read_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['user', '-created_at'], name='idx_notifications_user')]


class Report(models.Model):
    """Denúncia de conteúdo para a moderação."""

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports')
    target_type = models.CharField(max_length=20)
    target_id = models.BigIntegerField()
    reason = models.CharField(max_length=80)
    details = models.CharField(max_length=1000, blank=True, default='')
    status = models.CharField(max_length=20, default='open')
    created_at = models.BigIntegerField()
    reviewed_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'reports'
        ordering = ['created_at', 'id']
        indexes = [models.Index(fields=['status', 'created_at'], name='idx_reports_status')]


class ProblemReport(models.Model):
    """Relato de problema técnico enviado pelo menu do perfil."""

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='problem_reports')
    category = models.CharField(max_length=20)
    title = models.CharField(max_length=120)
    details = models.CharField(max_length=2000, blank=True, default='')
    context = models.CharField(max_length=300, blank=True, default='')
    status = models.CharField(max_length=20, default='open')
    created_at = models.BigIntegerField()
    reviewed_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'problem_reports'
        ordering = ['created_at', 'id']
        indexes = [models.Index(fields=['status', 'created_at'], name='idx_problem_reports_status')]
