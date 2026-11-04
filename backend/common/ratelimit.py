"""
Limite de requisições (rate limit).

O servidor Node.js mantinha contadores em memória, keyed por
`bucket + endereço IP`. Aqui o mesmo contrato é preservado: cada balde tem um
número máximo de requisições dentro de uma janela deslizante.

Observação: como o servidor escuta apenas em 127.0.0.1 por padrão, todos os
usuários locais compartilham o mesmo balde — exatamente como antes.
"""

import math
import threading
import time

from common.errors import ApiError

# `bucket -> (chave -> {'count': int, 'reset_at': float})`
_BUCKETS = {}
_LOCK = threading.Lock()

# Limite de chaves mantidas em memória antes da limpeza das expiradas.
_MAX_KEYS = 5000


def _client_key(request):
    """Identificador do cliente para fins de rate limit (endereço remoto)."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR') or 'unknown'


def rate_limit(request, bucket, max_requests, window_ms):
    """
    Aplica o limite de requisições.

    Levanta `ApiError(429)` quando o limite é excedido, com o tempo restante
    da janela em segundos — a mesma mensagem do servidor Node.js.
    """
    key = f'{bucket}:{_client_key(request)}'
    timestamp = time.time()
    window = window_ms / 1000.0

    with _LOCK:
        entries = _BUCKETS.setdefault(bucket, {})
        entry = entries.get(key)
        if not entry or entry['reset_at'] <= timestamp:
            entry = {'count': 0, 'reset_at': timestamp + window}
            entries[key] = entry
        entry['count'] += 1
        count = entry['count']
        reset_at = entry['reset_at']

        if len(_BUCKETS) > _MAX_KEYS:
            for stored_bucket, stored_entries in list(_BUCKETS.items()):
                for stored_key, stored_value in list(stored_entries.items()):
                    if stored_value['reset_at'] <= timestamp:
                        stored_entries.pop(stored_key, None)
                if not stored_entries:
                    _BUCKETS.pop(stored_bucket, None)

    if count > max_requests:
        retry = max(1, math.ceil((reset_at - timestamp)))
        raise ApiError(
            429,
            f'Muitas tentativas. Tente novamente em {retry}s.',
            code='rate_limited',
        )


def reset_buckets():
    """Limpa todos os baldes (usado em testes)."""
    with _LOCK:
        _BUCKETS.clear()
