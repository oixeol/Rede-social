"""
Ponto de entrada HTTP do backend em Python.

O backend expõe um gateway FastAPI na porta 8000. Ele encaminha as rotas de
API (`/api/*`) e os uploads (`/uploads/*`) para a implementação Node atual,
que vive em `backend/node-api` e continua sendo a fonte de verdade do
contrato HTTP durante a migração para Django/DRF.

Variáveis de ambiente:

- `NODE_API_URL`: origem da API Node (padrão `http://node-api:4173`).
- `VIBRA_CORS_ORIGINS`: origens liberadas para o navegador (separadas por
  vírgula).
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

NODE_API_URL = os.getenv('NODE_API_URL', 'http://node-api:4173').rstrip('/')
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'VIBRA_CORS_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000',
    ).split(',')
    if origin.strip()
]

# Prefixos repassados para a API Node.
PROXY_PREFIXES = ('api/', 'uploads/')

# Cabeçalhos que não podem ser copiados tal qual entre os saltos.
HOP_BY_HOP_HEADERS = {
    b'connection',
    b'keep-alive',
    b'proxy-authenticate',
    b'proxy-authorization',
    b'te',
    b'trailer',
    b'transfer-encoding',
    b'upgrade',
    b'content-length',
    b'content-encoding',
}

# Métodos que podem carregar corpo da requisição.
BODY_METHODS = ('POST', 'PUT', 'PATCH', 'DELETE')


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Mantém um cliente HTTP compartilhado durante a vida do processo."""
    app.state.client = httpx.AsyncClient(timeout=None)
    try:
        yield
    finally:
        await app.state.client.aclose()


app = FastAPI(
    title='Vibra API',
    version='2.0.0',
    description='Gateway HTTP do backend do Vibra.',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
async def health() -> dict:
    """Verificação de saúde do gateway."""
    return {
        'status': 'ok',
        'service': 'vibra-backend',
        'upstream': NODE_API_URL,
    }


@app.api_route(
    '/{full_path:path}',
    methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
)
async def proxy(full_path: str, request: Request) -> StreamingResponse:
    """Repassa `/api/*` e `/uploads/*` para a API Node."""
    if not full_path.startswith(PROXY_PREFIXES):
        return JSONResponse({'error': 'Rota não encontrada.'}, status_code=404)

    url = f'{NODE_API_URL}/{full_path}'
    if request.url.query:
        url = f'{url}?{request.url.query}'

    # O header `Host` é preservado: a API Node compara `Origin` com o host
    # público para bloquear CSRF.
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {'accept-encoding'}
    }

    client: httpx.AsyncClient = request.app.state.client
    upstream_request = client.build_request(
        request.method,
        url,
        headers=headers,
        content=request.stream() if request.method in BODY_METHODS else None,
    )
    upstream = await client.send(upstream_request, stream=True)

    async def iter_body():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()

    # httpx expõe os headers crus em `upstream.headers.raw` como lista de
    # (bytes, bytes). O Starlette usa o mesmo formato em `raw_headers`.
    filtered = [
        (key, value)
        for key, value in upstream.headers.raw
        if key.lower() not in HOP_BY_HOP_HEADERS
    ]
    response = StreamingResponse(iter_body(), status_code=upstream.status_code)
    response.raw_headers = filtered
    return response
