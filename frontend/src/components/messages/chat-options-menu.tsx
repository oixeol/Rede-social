'use client';

import { Ban, BellOff, Flag, Pin } from 'lucide-react';

import { DropdownMenu } from '@/components/ui/dropdown-menu';

interface ChatOptionsMenuProps {
  pinned: boolean;
  muted: boolean;
  onTogglePinned: () => void;
  onToggleMuted: () => void;
  onBlock: () => void;
  onReport: () => void;
  trigger?: React.ReactNode;
}

/** Menu de opções da conversa. Ações indisponíveis ficam explicitamente desabilitadas. */
export function ChatOptionsMenu({
  pinned,
  muted,
  onTogglePinned,
  onToggleMuted,
  onBlock,
  onReport,
  trigger,
}: ChatOptionsMenuProps) {
  return (
    <DropdownMenu
      label="Opções da conversa"
      align="end"
      trigger={trigger}
      items={[
        {
          id: 'pin',
          label: pinned ? 'Desafixar conversa' : 'Fixar conversa',
          description: pinned ? 'Remover marca de conversa fixa.' : 'Manter esta conversa no topo da lista.',
          icon: <Pin className="size-4" />,
          onSelect: onTogglePinned,
        },
        {
          id: 'mute',
          label: muted ? 'Ativar notificações' : 'Silenciar conversa',
          description: muted ? 'Receber notificações desta conversa novamente.' : 'Reduzir alertas desta conversa.',
          icon: <BellOff className="size-4" />,
          onSelect: onToggleMuted,
        },
        {
          id: 'group-info',
          label: 'Informações do grupo',
          description: 'Grupos ainda não estão disponíveis.',
          icon: <Ban className="size-4" />,
          disabled: true,
        },
        {
          id: 'block',
          label: 'Bloquear participante',
          description: 'O participante não poderá enviar novas mensagens.',
          icon: <Ban className="size-4" />,
          destructive: true,
          onSelect: onBlock,
        },
        {
          id: 'report',
          label: 'Denunciar participante',
          description: 'Abrir um aviso de segurança para esta conversa.',
          icon: <Flag className="size-4" />,
          destructive: true,
          onSelect: onReport,
        },
      ]}
    />
  );
}
