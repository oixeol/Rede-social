"""
Erros de API e normalização das respostas de erro.

O servidor Node.js devolvia sempre o formato `{error, code?, details?}`.
O frontend depende desse formato (`core.js` lê `data.error`, `data.code` e
`data.details`), então o Django precisa produzir exatamente a mesma forma.
"""

from django.http import JsonResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class ApiError(Exception):
    """Erro de domínio com status HTTP, código estável e detalhes opcionais."""

    def __init__(self, status_code, message, code=None, details=None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code
        self.details = details

    def to_payload(self):
        payload = {'error': self.message}
        if self.code:
            payload['code'] = self.code
        if self.details:
            payload['details'] = self.details
        return payload


def error_payload(message, code=None, details=None):
    """Monta o corpo de erro no formato esperado pelo frontend."""
    payload = {'error': message}
    if code:
        payload['code'] = code
    if details:
        payload['details'] = details
    return payload


def error_response(message, status_code=status.HTTP_400_BAD_REQUEST, code=None, details=None):
    """Resposta JSON de erro já pronta para uso em views."""
    return Response(error_payload(message, code, details), status=status_code)


def api_exception_handler(exc, context):
    """
    Handler global do DRF.

    Converte qualquer exceção em `{error, code?, details?}` com o status
    equivalente, preservando o contrato do servidor Node.js.
    """
    if isinstance(exc, ApiError):
        return Response(exc.to_payload(), status=exc.status_code)

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    code = None
    details = None

    if isinstance(detail, dict) and 'detail' in detail:
        message = str(detail['detail'])
    elif isinstance(detail, dict):
        # Erros de serializer: achata as mensagens em uma lista legível.
        parts = []
        for field, messages in detail.items():
            if isinstance(messages, (list, tuple)):
                text = '; '.join(str(item) for item in messages)
            else:
                text = str(messages)
            parts.append(f'{field}: {text}')
        message = '; '.join(parts) or 'Erro de validação.'
    elif isinstance(detail, (list, tuple)):
        message = '; '.join(str(item) for item in detail)
    else:
        message = str(detail)

    if isinstance(exc, Exception):
        code = getattr(exc, 'default_code', None)
        if code in ('not_authenticated', 'authentication_failed', 'permission_denied', 'not_found'):
            code = None

    response.data = error_payload(message, code, details)
    return response


def json_error(request, message, status_code=404, code=None, details=None):
    """Erro JSON para views que não usam o DRF (ex.: rotas fora de `/api/`)."""
    return JsonResponse(error_payload(message, code, details), status=status_code)
