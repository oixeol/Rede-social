"""
Autenticação por cookie de sessão.

O servidor Node.js emitia um cookie `vibra_session` com um token aleatório de
32 bytes (64 caracteres hexadecimais), guardado na tabela `sessions` com TTL
de 30 dias. O Django reproduz esse mecanismo para que o frontend e as suítes
de QA continuem funcionando sem alteração.
"""

import secrets

from django.conf import settings

from common.errors import ApiError
from common.timeutils import now_ms

# Duração da sessão em milissegundos (30 dias).
SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

SESSION_COOKIE_NAME = getattr(settings, 'SESSION_COOKIE_NAME', 'vibra_session')


def session_cookie_attrs():
    """Atributos do cookie de sessão (`Path`, `HttpOnly`, `SameSite`, `Secure`)."""
    secure = getattr(settings, 'SESSION_COOKIE_SECURE', False)
    attrs = 'Path=/; HttpOnly; SameSite=Lax'
    if secure:
        attrs += '; Secure'
    return attrs


def create_session(user):
    """Cria uma sessão para o usuário e devolve o token."""
    from accounts.models import Session

    token = secrets.token_hex(32)
    Session.objects.create(token=token, user=user, created_at=now_ms())
    return token


def set_session_cookie(response, token):
    """Grava o cookie de sessão na resposta."""
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=int(SESSION_TTL_MS / 1000),
        httponly=True,
        secure=getattr(settings, 'SESSION_COOKIE_SECURE', False),
        samesite='Lax',
        path='/',
    )
    return response


def clear_session_cookie(response):
    """Remove o cookie de sessão da resposta."""
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path='/',
        samesite='Lax',
    )
    return response


def current_user(request):
    """
    Devolve o usuário da requisição ou `None`.

    Sessões expiradas são removidas do banco, como fazia o Node.
    """
    from accounts.models import Session

    token = request.COOKIES.get(SESSION_COOKIE_NAME)
    if not token:
        return None

    session = Session.objects.select_related('user').filter(token=token).first()
    if not session:
        return None

    if session.created_at <= now_ms() - SESSION_TTL_MS:
        session.delete()
        return None

    return session.user


def require_user(request):
    """Devolve o usuário logado ou levanta `ApiError(401)`."""
    user = current_user(request)
    if not user:
        raise ApiError(401, 'Você precisa entrar para continuar.')
    return user


def destroy_session(request):
    """Encerra a sessão atual (logout)."""
    from accounts.models import Session

    token = request.COOKIES.get(SESSION_COOKIE_NAME)
    if token:
        Session.objects.filter(token=token).delete()
