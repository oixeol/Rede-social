'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { Hash, Users, Plus, ChevronRight } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import type { Community, SelfUser } from '@/lib/types';
import { CommunityFeed } from '@/components/communities/community-feed';

interface ComunidadesClientProps {
  initialMe: { user: SelfUser } | null;
  initialCommunities: Community[];
  initialMyCommunities: Community[];
  initialOtherCommunities: Community[];
}

export function ComunidadesClient({
  initialMe,
  initialCommunities,
  initialMyCommunities,
  initialOtherCommunities,
}: ComunidadesClientProps) {
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = initialMe?.user;

  const handleCreateCommunity = async () => {
    if (!newCommunityName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const slug = newCommunityName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
      await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCommunityName.trim(),
          description: newCommunityDescription.trim(),
          slug,
        }),
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar comunidade');
    } finally {
      setCreating(false);
    }
  };

  if (!me) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          icon={<Users className="size-5" />}
          title="Faça login para ver comunidades"
          description="Entre na sua conta para participar de comunidades."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Comunidades</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
            Comunidades
          </h1>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} leadingIcon={<Plus className="size-4" />}>
          Nova comunidade
        </Button>
      </header>

      {/* Create Community Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreateDialog(false)}>
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-semibold mb-4">Criar comunidade</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="community-name" className="block text-sm font-medium mb-1">Nome</label>
                <input
                  id="community-name"
                  type="text"
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  maxLength={80}
                  minLength={2}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome da comunidade"
                />
              </div>
              <div>
                <label htmlFor="community-desc" className="block text-sm font-medium mb-1">Descrição (opcional)</label>
                <textarea
                  id="community-desc"
                  value={newCommunityDescription}
                  onChange={(e) => setNewCommunityDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  placeholder="Sobre o que é esta comunidade?"
                />
              </div>
              {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateCommunity} disabled={creating || newCommunityName.trim().length < 2}>
                {creating ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Active Community Feed */}
      {activeCommunity && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Feed de {activeCommunity.name}</h2>
            <Button variant="ghost" size="sm" onClick={() => setActiveCommunity(null)}>
              Voltar
            </Button>
          </div>
          <CommunityFeed
            communitySlug={activeCommunity.slug}
            communityName={activeCommunity.name}
            communityAvatar={activeCommunity.avatar}
            currentUser={{
              id: me.id,
              username: me.username,
              name: me.name,
              avatar: me.avatar,
            }}
          />
        </div>
      )}

      {/* Communities Lists */}
      {!activeCommunity && (
        <>
          {initialMyCommunities.length > 0 && (
            <section aria-label="Minhas comunidades" className="mb-8">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <Hash className="size-5 text-brand" aria-hidden="true" />
                  Minhas comunidades
                </h2>
              </header>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {initialMyCommunities.map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    onClick={() => setActiveCommunity(community)}
                  />
                ))}
              </div>
            </section>
          )}

          {initialOtherCommunities.length > 0 && (
            <section aria-label="Outras comunidades" className="mb-8">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <Users className="size-5" aria-hidden="true" />
                  Conheça outras comunidades
                </h2>
              </header>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {initialOtherCommunities.slice(0, 9).map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    showJoinButton
                    onClick={() => setActiveCommunity(community)}
                  />
                ))}
              </div>
            </section>
          )}

          {initialMyCommunities.length === 0 && initialOtherCommunities.length === 0 && (
            <EmptyState
              icon={<Users className="size-5" />}
              title="Nenhuma comunidade ainda"
              description="Seja o primeiro a criar uma comunidade no Orbit!"
            />
          )}
        </>
      )}
    </div>
  );
}

interface CommunityCardProps {
  community: Community;
  onClick: () => void;
  showJoinButton?: boolean;
}

function CommunityCard({ community, onClick, showJoinButton }: CommunityCardProps) {
  return (
    <Card
      className={cn(
        'p-4 transition-colors cursor-pointer',
        showJoinButton ? 'hover:border-brand/30 hover:bg-surface-subtle' : 'hover:bg-surface-subtle'
      )}
      onClick={onClick}
    >
      <Link href={`/comunidades/${encodeURIComponent(community.slug)}` as Route} className="block" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {community.avatar ? (
            <Image src={community.avatar} alt="" width={48} height={48} className="rounded-xl shrink-0" unoptimized />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand font-bold text-lg">
              {community.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{community.name}</h3>
            <p className="mt-1 text-sm text-muted line-clamp-2">{community.description || 'Sem descrição'}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Users className="size-3.5" />
                {community.memberCount} membro{community.memberCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </Link>
      {showJoinButton && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={async (e) => {
            e.stopPropagation();
            e.preventDefault();
            try {
              await fetch(`/api/communities/${encodeURIComponent(community.slug)}/join`, { method: 'POST' });
              window.location.reload();
            } catch {
              alert('Erro ao entrar na comunidade');
            }
          }}
        >
          Entrar
        </Button>
      )}
    </Card>
  );
}