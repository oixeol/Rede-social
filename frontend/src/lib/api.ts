export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!path.startsWith('/api/')) {
    throw new ApiError('Caminho de API inválido.', 400);
  }

  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as unknown)
    : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Não foi possível concluir a solicitação.';
    throw new ApiError(message, response.status);
  }

  return payload as T;
}
