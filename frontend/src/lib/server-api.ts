import 'server-only';

import { cookies } from 'next/headers';

import type {
  ExploreResponse,
  FeedResponse,
  MeResponse,
  ProfileResponse,
  StoriesResponse,
  SuggestionsResponse,
} from './types';

/**
 * Error thrown when the upstream Node API fails or returns a non-2xx status.
 * Mirrors the shape of the client helper in `./api.ts`, but is server-only.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const DEFAULT_API_ORIGIN = 'http://127.0.0.1:4173';
const REQUEST_TIMEOUT_MS = 15_000;

export type ServerApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ServerApiRequestOptions {
  method?: ServerApiMethod;
  /** Serialized as JSON and sent with a `Content-Type: application/json` header. */
  body?: unknown;
  headers?: HeadersInit;
  /** Caller-controlled cancellation, combined with the internal 15s timeout. */
  signal?: AbortSignal;
}

interface JsonErrorPayload {
  error?: unknown;
}

/** Reads the configured API origin at request time so runtime env changes apply. */
function getApiOrigin(): string {
  const configured = (process.env.VIBRA_API_ORIGIN ?? DEFAULT_API_ORIGIN).trim();

  if (!configured) {
    return DEFAULT_API_ORIGIN;
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ApiError('Origem da API inválida: VIBRA_API_ORIGIN.', 500);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError('Origem da API inválida: VIBRA_API_ORIGIN.', 500);
  }

  return url.origin;
}

/** Builds the absolute upstream URL, rejecting anything that is not an API path. */
function buildApiUrl(path: string): URL {
  if (!path.startsWith('/api/')) {
    throw new ApiError('Caminho de API inválido.', 400);
  }

  return new URL(path, getApiOrigin());
}

function isJsonErrorPayload(payload: unknown): payload is JsonErrorPayload {
  return typeof payload === 'object' && payload !== null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isJsonErrorPayload(payload)) {
    return null;
  }

  return typeof payload.error === 'string' ? payload.error : null;
}

/**
 * Calls the Node API from a Server Component.
 *
 * - Forwards the incoming (HttpOnly) session cookie.
 * - Never caches the response (`cache: 'no-store'`).
 * - Aborts after 15 seconds.
 * - Parses the JSON payload and throws {@link ApiError} on failure.
 */
export async function serverApiRequest<T>(
  path: string,
  options: ServerApiRequestOptions = {},
): Promise<T> {
  const url = buildApiUrl(path);

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body,
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError('Tempo limite da requisição à API excedido.', 504);
    }

    if (options.signal?.aborted) {
      throw new ApiError('A requisição à API foi cancelada.', 499);
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Não foi possível conectar à API.',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }

  const rawBody = await response.text();
  let payload: unknown = null;
  let parseFailed = false;

  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      parseFailed = true;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload) ?? 'Não foi possível concluir a solicitação.',
      response.status,
    );
  }

  if (parseFailed) {
    throw new ApiError('Resposta inválida da API.', 500);
  }

  return payload as T;
}

/** GET /api/me */
export function getMe(): Promise<MeResponse> {
  return serverApiRequest<MeResponse>('/api/me');
}

/** GET /api/feed */
export function getFeed(options: { limit?: number; before?: number; mediaType?: 'video' | 'image' | 'image,video' } = {}): Promise<FeedResponse> {
  const query = new URLSearchParams();

  if (options.limit !== undefined) {
    query.set('limit', String(options.limit));
  }

  if (options.before !== undefined) {
    query.set('before', String(options.before));
  }

  if (options.mediaType !== undefined) {
    query.set('mediaType', options.mediaType);
  }

  const queryString = query.toString();
  const suffix = queryString.length > 0 ? `?${queryString}` : '';
  return serverApiRequest<FeedResponse>(`/api/feed${suffix}`);
}

/** GET /api/explore */
export function getExplore(options: { limit?: number; before?: number; topic?: string; q?: string; mediaType?: 'video' | 'image' | 'image,video' } = {}): Promise<ExploreResponse> {
  const query = new URLSearchParams();

  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.before !== undefined) query.set('before', String(options.before));
  if (options.topic) query.set('topic', options.topic);
  if (options.q) query.set('q', options.q);
  if (options.mediaType) query.set('mediaType', options.mediaType);

  const queryString = query.toString();
  return serverApiRequest<ExploreResponse>(`/api/explore${queryString ? `?${queryString}` : ''}`);
}

/** GET /api/users/:username */
export function getProfile(username: string): Promise<ProfileResponse> {
  return serverApiRequest<ProfileResponse>(`/api/users/${encodeURIComponent(username)}`);
}

/** GET /api/suggestions */
export function getSuggestions(): Promise<SuggestionsResponse> {
  return serverApiRequest<SuggestionsResponse>('/api/suggestions');
}

/** GET /api/stories */
export function getStories(): Promise<StoriesResponse> {
  return serverApiRequest<StoriesResponse>('/api/stories');
}
