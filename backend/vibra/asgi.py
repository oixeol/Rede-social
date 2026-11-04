"""
ASGI entry point for the Vibra API.

Permite rodar o projeto com servidores assíncronos (uvicorn, daphne).
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vibra.settings")

application = get_asgi_application()
