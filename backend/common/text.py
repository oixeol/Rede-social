"""
Validação de entrada compartilhada entre os apps.

Reproduz os helpers `cleanText` e `parseJsonArray` do servidor Node.js,
incluindo as mensagens de erro exatas — o frontend as exibe diretamente.
"""

from common.constants import INTEREST_IDS
from common.errors import ApiError


def clean_text(value, field, min=0, max=1000, required=False):
    """
    Normaliza um texto e valida o tamanho.

    Regra equivalente ao Node.js: `required` exige conteúdo; `min` e `max`
    geram mensagens de erro com o mesmo texto.
    """
    text = value.strip() if isinstance(value, str) else ''
    if required and not text:
        raise ApiError(400, f'{field} e obrigatorio.')
    if len(text) < min:
        raise ApiError(400, f'{field} muito curto.')
    if len(text) > max:
        raise ApiError(400, f'{field} muito longo (máximo {max}).')
    return text


def parse_json_array(value, allowed=None):
    """
    Converte um campo JSON em lista de strings únicas.

    `allowed` receive um conjunto de IDs permitidos; quando informado, os
    itens fora do conjunto são descartados silenciosamente.
    """
    if isinstance(value, str):
        import json

        try:
            parsed = json.loads(value or '[]')
        except (ValueError, TypeError):
            return []
    else:
        parsed = value if value is not None else []

    if not isinstance(parsed, (list, tuple)):
        return []

    items = []
    for item in parsed:
        if isinstance(item, str) and item not in items:
            items.append(item)

    if allowed is not None:
        items = [item for item in items if item in allowed]
    return items


def unique_valid_interests(value, limit=12):
    """Normaliza a lista de interesses enviada pelo cliente (máx. 12)."""
    items = parse_json_array(value, INTEREST_IDS)
    return items[:limit]
