"""Configuração do app `common` (utilitários compartilhados)."""

from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'common'
    verbose_name = 'Utilitários compartilhados'
