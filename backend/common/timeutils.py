"""
Tempo em milissegundos Unix.

O contrato HTTP do Vibra usa timestamps numéricos em milissegundos
(`createdAt: 1712345678901`). O Django trabalha com `datetime`, então a
conversão acontece na fronteira da API.
"""

import math
from datetime import date, datetime, timezone

from django.utils import timezone as django_timezone

# Idade máxima aceita. Acima disso a data de nascimento é tratada como inválida.
MAX_AGE_PLATFORM = 120


def now_ms():
    """Instante atual em milissegundos Unix."""
    return int(django_timezone.now().timestamp() * 1000)


def to_ms(value):
    """Converte `datetime` (aware ou naive) em milissegundos Unix."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if django_timezone.is_naive(value):
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def from_ms(value):
    """Converte milissegundos Unix em `datetime` aware em UTC."""
    if value is None:
        return None
    return datetime.fromtimestamp(float(value) / 1000, tz=timezone.utc)


def parse_iso_date(value):
    """Aceita `YYYY-MM-DD` ou `datetime` e devolve `date` (ou `None`)."""
    if value in (None, ''):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    try:
        return datetime.strptime(text[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def age_from_birth_date(birth_date):
    """
    Calcula a idade a partir da data de nascimento.

    Devolve `None` quando a data é ausente, inconsistente ou implausível.
    """
    parsed = parse_iso_date(birth_date)
    if parsed is None:
        return None
    today = django_timezone.now().date()
    age = today.year - parsed.year
    before_birthday = (today.month, today.day) < (parsed.month, parsed.day)
    if before_birthday:
        age -= 1
    if age < 0 or age > MAX_AGE_PLATFORM:
        return None
    return age


def is_adult(birth_date, minimum=18):
    """Indica se a data de nascimento comprova idade mínima."""
    age = age_from_birth_date(birth_date)
    return age is not None and age >= minimum


def public_age(birth_date):
    """
    Idade exibida publicamente no perfil.

    Devolve `None` quando a data é ausente ou inconsistente — a interface
    trata como "idade não informada" em vez de expor um número inventado.
    """
    return age_from_birth_date(birth_date)


def haversine_meters(lat1, lng1, lat2, lng2):
    """Distância aproximada entre dois pontos, em metros."""
    radius = 6371000.0

    def rad(value):
        return value * math.pi / 180.0

    d_lat = rad(lat2 - lat1)
    d_lng = rad(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return int(round(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))))


def format_distance(meters):
    """Texto curto de distância usado no Radar e nos alertas."""
    if meters < 100:
        return 'a menos de 100 m'
    if meters < 1000:
        return f'a aproximadamente {max(100, round(meters / 100) * 100)} m'
    if meters < 10000:
        value = round(meters / 100) / 10
        return f'a aproximadamente {str(value).replace(".", ",")} km'
    return f'a aproximadamente {round(meters / 1000)} km'
