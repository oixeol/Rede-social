/**
 * Utilidades de formatação e agrupamento usadas pela tela de mensagens.
 *
 * Ficam fora dos componentes para que sidebar, chat header e lista de
 * mensagens compartilhem a mesma regra de tempo e data.
 */

/** Agrupa mensagens por dia preservando a ordem de chegada. */
export interface MessageDayGroup<T> {
  /** Chave estável do dia (YYYY-MM-DD no fuso local). */
  key: string;
  /** Rótulo pronto para exibir ("Hoje", "Ontem", "12 de março"). */
  label: string;
  messages: T[];
}

function startOfDay(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayKey(timestamp: number): string {
  const date = startOfDay(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Rótulo do separador de data: hoje, ontem ou data por extenso. */
export function formatDayLabel(timestamp: number, now = Date.now()): string {
  const current = startOfDay(now).getTime();
  const target = startOfDay(timestamp).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (target === current) return 'Hoje';
  if (target === current - dayMs) return 'Ontem';

  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

/** Agrupa mensagens por dia, mantendo a ordem original dentro de cada dia. */
export function groupMessagesByDay<T extends { createdAt: number }>(
  messages: T[],
  now = Date.now(),
): MessageDayGroup<T>[] {
  const groups: MessageDayGroup<T>[] = [];

  for (const message of messages) {
    const key = dayKey(message.createdAt);
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.messages.push(message);
      continue;
    }
    groups.push({ key, label: formatDayLabel(message.createdAt, now), messages: [message] });
  }

  return groups;
}

/** Hora curta (HH:MM) usada dentro dos balões. */
export function formatClockTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(timestamp),
  );
}

/** Tempo relativo curto usado na lista de conversas ("agora", "há 5 min"). */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'agora';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(timestamp));
}

/** Rótulo de presença exibido no cabeçalho do chat. */
export function formatPresenceLabel(presence: string): string {
  switch (presence) {
    case 'available':
      return 'Online';
    case 'away':
      return 'Ausente';
    case 'dnd':
      return 'Não perturbar';
    default:
      return 'Offline';
  }
}

/** Formata números grandes (1.2k, 5.3M, etc). */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}k`;
  return String(value);
}
