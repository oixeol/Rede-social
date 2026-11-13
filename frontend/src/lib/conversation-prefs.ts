/**
 * Preferências locais de conversa (fixadas e silenciadas).
 *
 * O backend ainda não expõe colunas de pin/silêncio em `conversation_members`,
 * então o estado vive no `localStorage` do navegador. A API pública é
 * estável: quando a migração do servidor existir, basta trocar a origem dos
 * dados sem alterar os componentes.
 */

const PINNED_KEY = 'vibra:mensagens:fixadas';
const MUTED_KEY = 'vibra:mensagens:silenciadas';

function readIds(key: string): number[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* Modo privado ou cota cheia: mantém apenas em memória. */
  }
}

/** IDs das conversas fixadas. */
export function loadPinnedConversations(): number[] {
  return readIds(PINNED_KEY);
}

/** IDs das conversas silenciadas. */
export function loadMutedConversations(): number[] {
  return readIds(MUTED_KEY);
}

/** Alterna o estado de fixada e devolve a nova lista. */
export function togglePinnedConversation(id: number): number[] {
  const current = readIds(PINNED_KEY);
  const next = current.includes(id)
    ? current.filter((value) => value !== id)
    : [...current, id];
  writeIds(PINNED_KEY, next);
  return next;
}

/** Alterna o estado de silenciada e devolve a nova lista. */
export function toggleMutedConversation(id: number): number[] {
  const current = readIds(MUTED_KEY);
  const next = current.includes(id)
    ? current.filter((value) => value !== id)
    : [...current, id];
  writeIds(MUTED_KEY, next);
  return next;
}
