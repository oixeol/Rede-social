"""
App de contas: usuários e sessões.

Os nomes das tabelas espelham o schema do servidor Node.js (`users` e
`sessions`) para que a migração dos dados seja direta.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Gerenciador compatível com o modelo de usuário customizado."""

    use_in_migrations = True

    def create_user(self, username, name, password, **extra):
        user = self.model(
            username=username,
            name=name,
            **extra,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, name, password, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(username, name, password, **extra)


class User(AbstractBaseUser):
    """Conta da rede social."""

    username = models.CharField(max_length=24, unique=True)
    name = models.CharField(max_length=40)
    bio = models.CharField(max_length=150, blank=True, default='')
    avatar = models.CharField(max_length=255, null=True, blank=True)

    birth_date = models.DateField(null=True, blank=True)
    interests = models.JSONField(default=list, blank=True)
    message_policy = models.CharField(max_length=20, default='connections')
    is_private = models.BooleanField(default=False)
    last_active_at = models.BigIntegerField(null=True, blank=True)

    created_at = models.BigIntegerField()

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'
        ordering = ['id']

    def __str__(self):
        return self.username

    @property
    def is_superuser(self):
        """Alias usado pelo admin do Django."""
        return self.is_staff


class Session(models.Model):
    """Sessão ativa do usuário, identificada pelo token do cookie."""

    token = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'sessions'

    def __str__(self):
        return f'{self.user_id}:{self.token[:8]}'
