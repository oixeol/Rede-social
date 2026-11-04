"""
Configuração de execução do backend.

Reproduz as validações de inicialização do servidor Node.js:

- `IDENTITY_PROVIDER` aceita `dev` ou `webhook`;
- `webhook` exige `IDENTITY_WEBHOOK_SECRET`;
- produção não aceita `dev` nem `COOKIE_SECURE=0`;
- o seed demo é proibido em produção.

As funções `validate_config()` devem ser chamadas no start do servidor; as
flags são expostas para que os testes e o shell possam inspecioná-las.
"""

import os

from django.conf import settings


def is_production():
    """Indica se o ambiente está configurado como produção."""
    return bool(getattr(settings, 'VIBRA_IS_PRODUCTION', False))


def identity_provider():
    """Provedor de verificação de identidade configurado (`dev`/`webhook`)."""
    return str(getattr(settings, 'VIBRA_IDENTITY_PROVIDER', '') or '').strip()


def identity_webhook_secret():
    """Segredo usado na assinatura HMAC do webhook de identidade."""
    return str(getattr(settings, 'VIBRA_IDENTITY_WEBHOOK_SECRET', '') or '')


def admin_token():
    """Token de administração da fila de moderação (vazio = rota desativada)."""
    return str(getattr(settings, 'VIBRA_ADMIN_TOKEN', '') or '')


def identity_mode():
    """
    Modo efetivo de verificação de identidade.

    - `webhook`: integração real via provedor externo;
    - `dev`: simulação explícita (apenas fora de produção);
    - `disabled`: nenhuma verificação disponível.
    """
    provider = identity_provider()
    if provider == 'webhook':
        return 'webhook'
    if provider == 'dev':
        return 'dev'
    return 'disabled' if is_production() else 'dev'


def seed_demo_enabled():
    """Indica se o seed de demonstração está habilitado."""
    return bool(getattr(settings, 'VIBRA_SEED_DEMO', False))


def demo_password():
    """Senha usada pelas contas de demonstração."""
    return str(getattr(settings, 'VIBRA_DEMO_PASSWORD', '') or '')


def validate_config():
    """
    Valida a configuração do ambiente.

    Devolve a lista de problemas encontrados; quando a lista está vazia, a
    configuração é aceitável.
    """
    problems = []
    production = is_production()
    provider = identity_provider()

    if seed_demo_enabled() and production:
        problems.append('VIBRA_SEED_DEMO não pode ser habilitado em produção.')
    if seed_demo_enabled() and len(demo_password()) < 8:
        problems.append('VIBRA_SEED_DEMO exige VIBRA_DEMO_PASSWORD com ao menos 8 caracteres.')
    if provider and provider not in ('dev', 'webhook'):
        problems.append('VIBRA_IDENTITY_PROVIDER deve ser "dev" ou "webhook".')
    if provider == 'webhook' and not identity_webhook_secret():
        problems.append('VIBRA_IDENTITY_PROVIDER=webhook exige VIBRA_IDENTITY_WEBHOOK_SECRET.')
    if production and provider == 'dev':
        problems.append('VIBRA_IDENTITY_PROVIDER=dev não é permitido em produção.')
    if production and str(os.getenv('COOKIE_SECURE', '1')) == '0':
        problems.append('COOKIE_SECURE=0 não é permitido em produção; publique atrás de HTTPS.')

    return problems
