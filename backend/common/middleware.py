"""
Cabeçalhos de segurança e proteção de mesma origem.

O servidor Node.js aplicava cabeçalhos de segurança em toda resposta e
bloqueava requisições de escrita cujo header `Origin` não correspondesse ao
host da requisição. O Django reproduz os dois comportamentos para manter o
mesmo perfil de proteção durante a migração.
"""

from django.conf import settings
from django.http import JsonResponse

# Valores idênticos aos do servidor Node.js.
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    'Content-Security-Policy': (
        "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; "
        "font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    ),
}

# Métodos que não alteram estado e, portanto, não exigem verificação de origem.
SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')

# Rota autenticada por HMAC: a origem é o provedor externo, não o navegador.
EXEMPT_FROM_ORIGIN_CHECK = ('/api/webhooks/identity',)


class SecurityHeadersMiddleware:
    """Adiciona os cabeçalhos de segurança em todas as respostas."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        for name, value in SECURITY_HEADERS.items():
            response.setdefault(name, value)
        return response


class SameOriginMiddleware:
    """
    Rejeita requisições de escrita vindas de outra origem.

    Requisições sem header `Origin` são liberadas (clientes não-browser não o
    enviam), exatamente como no servidor Node.js.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method not in SAFE_METHODS and request.path.startswith('/api/'):
            if request.path not in EXEMPT_FROM_ORIGIN_CHECK:
                origin = request.META.get('HTTP_ORIGIN')
                if origin:
                    host = request.get_host()
                    if origin.split('://')[-1] != host:
                        return JsonResponse(
                            {'error': 'Origem não autorizada.', 'code': 'bad_origin'},
                            status=403,
                        )
        return self.get_response(request)


def is_production():
    """Indica se o ambiente está configurado como produção."""
    return bool(getattr(settings, 'VIBRA_IS_PRODUCTION', False))
