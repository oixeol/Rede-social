'use client';

import { SearchField } from '@/components/ui/search-field';

interface ConversationSearchProps {
  value: string;
  onValueChange: (value: string) => void;
}

/** Campo de busca da lista de conversas (filtra por nome ou @usuário). */
export function ConversationSearch({ value, onValueChange }: ConversationSearchProps) {
  return (
    <SearchField
      id="busca-conversas"
      value={value}
      onValueChange={onValueChange}
      label="Buscar conversas"
      placeholder="Buscar por nome ou @usuário..."
      rounded="lg"
      className="border-border-strong/70 bg-surface-subtle"
    />
  );
}
