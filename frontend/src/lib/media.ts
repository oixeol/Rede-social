/**
 * Valida mídia vinda do backend.
 *
 * Aceita somente caminhos internos de upload. Rejeita traversal literal ou
 * codificado, barras invertidas, segmentos vazios e URLs externas.
 */
export function isSafeMediaSource(src: string | null | undefined): src is string {
  if (!src || !src.startsWith('/uploads/')) return false;

  let decoded = src;
  for (let depth = 0; depth < 3; depth += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return false;
    }
  }

  if (decoded !== src) return false;

  const filename = src.slice('/uploads/'.length);
  if (!filename || filename.includes('/') || filename.includes('\\')) return false;
  if (filename === '.' || filename === '..' || filename.includes('..')) return false;
  if (/[\u0000-\u001F\u007F]/.test(filename)) return false;

  return true;
}
