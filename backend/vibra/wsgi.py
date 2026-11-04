"""
WSGI entry point for the Vibra API.

The default Django `wsgi.py` is usually generated automatically, but our
project uses a custom setup that needs a simple, single-file entry.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vibra.settings")

application = get_wsgi_application()
