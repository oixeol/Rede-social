/**
 * Catálogo de interesses — espelho do backend (server.js).
 * Mantido em sincronia para exibir rótulos legíveis no frontend.
 */
export const INTERESTS = [
  { id: 'games', label: 'Games', group: 'Cultura digital' },
  { id: 'musica', label: 'Música', group: 'Cultura' },
  { id: 'filmes', label: 'Filmes e séries', group: 'Cultura' },
  { id: 'futebol', label: 'Futebol', group: 'Esportes' },
  { id: 'academia', label: 'Academia', group: 'Esportes' },
  { id: 'tecnologia', label: 'Tecnologia', group: 'Conhecimento' },
  { id: 'viagens', label: 'Viagens', group: 'Experiências' },
  { id: 'livros', label: 'Livros', group: 'Conhecimento' },
  { id: 'arte', label: 'Arte', group: 'Cultura' },
  { id: 'culinaria', label: 'Culinária', group: 'Sabores' },
  { id: 'natureza', label: 'Natureza', group: 'Experiências' },
  { id: 'humor', label: 'Humor', group: 'Cultura' },
  { id: 'fotografia', label: 'Fotografia', group: 'Cultura' },
  { id: 'corrida', label: 'Corrida', group: 'Esportes' },
  { id: 'cafe', label: 'Café', group: 'Sabores' },
  { id: 'design', label: 'Design', group: 'Cultura' },
  { id: 'animais', label: 'Animais', group: 'Estilo de vida' },
  { id: 'cozinhar', label: 'Cozinhar', group: 'Sabores' },
  { id: 'cinema', label: 'Cinema', group: 'Cultura' },
  { id: 'praia', label: 'Praia', group: 'Natureza' },
  { id: 'trilhas', label: 'Trilhas', group: 'Natureza' },
  { id: 'boardgames', label: 'Jogos de tabuleiro', group: 'Cultura digital' },
  { id: 'podcasts', label: 'Podcasts', group: 'Cultura' },
  { id: 'musica-ao-vivo', label: 'Shows', group: 'Cultura' },
] as const;

export type InterestId = typeof INTERESTS[number]['id'];

export const INTEREST_LABELS: Record<InterestId, string> = Object.fromEntries(
  INTERESTS.map((i) => [i.id, i.label]),
) as Record<InterestId, string>;

export function getInterestLabel(id: string): string {
  return INTEREST_LABELS[id as InterestId] ?? id;
}