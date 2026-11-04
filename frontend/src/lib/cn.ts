import { twMerge } from 'tailwind-merge';

/**
 * Combina classes de Tailwind resolvendo conflitos de Tailwind v4.
 *
 * Sem isso, `cn('inline-flex', 'hidden')` produz `inline-flex hidden` e o
 * navegador aplica o utilitário gerado por último no CSS — o que não
 * corresponde à ordem escrita no JSX. `twMerge` remove a classe anterior do
 * mesmo grupo, garantindo que a última escrita seja a aplicada.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return twMerge(values.filter(Boolean).join(' '));
}
