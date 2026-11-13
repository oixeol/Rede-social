import type { Short, ShortsResponse, ShortPresignResponse, ShortManifestResponse, VoiceStateResponse, VoiceJoinResponse, VoiceMuteResponse, VoiceDeafenResponse } from './types';

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

export async function getShorts(cursor?: number, limit = 20) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', String(cursor));
  params.set('limit', String(limit));
  return apiRequest<ShortsResponse>(`/api/shorts?${params.toString()}`);
}

export async function getShort(id: number) {
  return apiRequest<{ short: Short }>(`/api/shorts/${id}`);
}

export async function getShortManifest(id: number) {
  return apiRequest<ShortManifestResponse>(`/api/shorts/${id}/manifest`);
}

export async function getShortPresign(filename: string, contentType: string, title?: string, description?: string) {
  return apiRequest<ShortPresignResponse>('/api/shorts/presign', {
    method: 'POST',
    body: { filename, contentType, title, description },
  });
}

export async function likeShort(id: number) {
  return apiRequest<{ liked: boolean }>(`/api/shorts/${id}/like`, { method: 'POST' });
}

export async function unlikeShort(id: number) {
  return apiRequest<{ liked: boolean }>(`/api/shorts/${id}/like`, { method: 'DELETE' });
}

export async function recordShortView(id: number, watchTime: number) {
  return apiRequest<{ ok: boolean }>(`/api/shorts/${id}/view`, {
    method: 'POST',
    body: { watchTime },
  });
}

export async function deleteShort(id: number) {
  return apiRequest<{ ok: boolean }>(`/api/shorts/${id}`, { method: 'DELETE' });
}

export async function getVoiceState(channelId: number) {
  return apiRequest<VoiceStateResponse>(`/api/channels/${channelId}/voice/state`);
}

export async function joinVoiceChannel(channelId: number) {
  return apiRequest<VoiceJoinResponse>(`/api/channels/${channelId}/voice/join`, { method: 'POST' });
}

export async function leaveVoiceChannel(channelId: number) {
  return apiRequest<VoiceJoinResponse>(`/api/channels/${channelId}/voice/leave`, { method: 'POST' });
}

export async function toggleVoiceMute(channelId: number, muted: boolean) {
  return apiRequest<VoiceMuteResponse>(`/api/channels/${channelId}/voice/mute`, {
    method: 'POST',
    body: { muted },
  });
}

export async function toggleVoiceDeafen(channelId: number, deafened: boolean) {
  return apiRequest<VoiceDeafenResponse>(`/api/channels/${channelId}/voice/deafen`, {
    method: 'POST',
    body: { deafened },
  });
}

export async function forgotPassword(email: string) {
  return apiRequest<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPassword(token: string, password: string, confirmPassword: string) {
  return apiRequest<{ ok: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password, confirmPassword },
  });
}

export async function createSpaceInvite(spaceId: number) {
  return apiRequest<{ invite: { code: string; spaceId: number; expiresAt: number; createdAt: number } }>(
    `/api/spaces/${spaceId}/invite`,
    { method: 'POST' }
  );
}

export async function joinSpaceWithInvite(code: string) {
  return apiRequest<{ spaceId: number; alreadyMember: boolean }>('/api/spaces/join', {
    method: 'POST',
    body: { code },
  });
}
