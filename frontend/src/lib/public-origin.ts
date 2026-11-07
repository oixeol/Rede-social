/**
 * Resolve a origem pública canônica para QR de login.
 *
 * - Se `VIBRA_PUBLIC_ORIGIN` estiver definido, usa esse valor (validado como URL
 *   absoluta com protocolo http/https, sem credenciais, sem caminho/querystring).
 * - Caso contrário, em desenvolvimento (`NODE_ENV !== 'production'`) aceita o
 *   `Host`/`X-Forwarded-Host` apenas quando aponta para loopback (localhost,
 *   127.0.0.1, ::1). Em produção retorna `null` para evitar spoofing de cabeçalho.
 * - O resultado é apenas a origem (ex.: `https://app.exemplo.com`).
 */
export function resolvePublicOrigin(headersList: Headers): string | null {
  const configured = process.env.VIBRA_PUBLIC_ORIGIN?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (url.username || url.password) return null;
      if (url.pathname !== '/' || url.search || url.hash) return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  // Sem configuração explícita: apenas aceita host de loopback em dev
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const forwardedHost = headersList.get('x-forwarded-host')?.split(',')[0]?.trim();
  const rawHost = forwardedHost ?? headersList.get('host');
  if (!rawHost) return null;

  const forwardedProto = headersList.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto ?? 'http';
  if (protocol !== 'http' && protocol !== 'https') return null;

  try {
    const url = new URL(`${protocol}://${rawHost}`);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}