"""Configuração do app de namoro."""

from django.apps import AppConfig


class DatingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dating'
    verbose_name = 'Namoro'
