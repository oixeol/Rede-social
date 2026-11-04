'use client';

import { BadgeCheck, Ban, Heart, MessageSquare, Repeat2, Share2, Shield, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Brand } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pill } from '@/components/ui/pill';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function FoundationPreview() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('tokens');

  const tokenRows = [
    { name: 'Fundo', var: '--vibra-background' },
    { name: 'Superfície', var: '--vibra-surface' },
    { name: 'Superfície elevada', var: '--vibra-surface-raised' },
    { name: 'Superfície sutil', var: '--vibra-surface-subtle' },
    { name: 'Texto principal', var: '--vibra-foreground' },
    { name: 'Texto apagado', var: '--vibra-muted' },
    { name: 'Borda', var: '--vibra-border' },
    { name: 'Borda forte', var: '--vibra-border-strong' },
    { name: 'Marca (primária)', var: '--vibra-brand' },
    { name: 'Marca hover', var: '--vibra-brand-hover' },
    { name: 'Marca suave', var: '--vibra-brand-soft' },
    { name: 'Destaque', var: '--vibra-accent' },
    { name: 'Destaque suave', var: '--vibra-accent-soft' },
    { name: 'Marinho', var: '--vibra-navy' },
    { name: 'Dourado', var: '--vibra-gold' },
    { name: 'Lilás', var: '--vibra-lilac' },
    { name: 'Sucesso', var: '--vibra-success' },
    { name: 'Perigo', var: '--vibra-danger' },
    { name: 'Perigo suave', var: '--vibra-danger-soft' },
  ];

  const tabItems: TabItem[] = [
    { id: 'tokens', label: 'Tokens' },
    { id: 'typography', label: 'Tipografia' },
    { id: 'components', label: 'Componentes' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Cabeçalho leve */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/80 backdrop-blur-sm px-4 lg:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main id="conteudo" className="flex-1 pt-16 px-4 lg:px-8 py-10">
        <div className="max-w-5xl mx-auto space-y-12">
          <section aria-labelledby="intro-heading" className="text-center">
            <h1 id="intro-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Etapa 2 · Base visual pronta
            </h1>
            <p className="mt-2 text-sm text-muted">
              Tokens de cor, tipografia, componentes acessíveis e estados de carregamento/erro.
              <br />
              Sem dados fictícios, nomes reais ou números inventados.
            </p>
          </section>

          <Tabs
            label="Navegação da fundação"
            items={tabItems}
            value={activeTab}
            onValueChange={setActiveTab}
            className="border-none"
          >
            {activeTab === 'tokens' ? (
            <div id="tokens">
              <h2 className="font-display text-xl font-semibold mb-4">Paleta semântica</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tokenRows.map((token) => (
                  <div key={token.var} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                    <span
                      className="shrink-0 size-10 rounded-lg border border-border-strong"
                      style={{ backgroundColor: `var(${token.var})` }}
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{token.name}</span>
                      <code className="block text-[11px] text-muted font-mono">{token.var}</code>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="font-display text-xl font-semibold mt-10 mb-4">Raio e sombra</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4">
                  <code className="font-mono text-sm">--radius-pill (999px)</code>
                  <Pill className="mt-2" tone="brand">Exemplo de pílula</Pill>
                </Card>
                <Card className="p-4">
                  <code className="font-mono text-sm">--radius-card (1.25rem)</code>
                  <div className="mt-2 size-20 rounded-card border border-border bg-surface-subtle" />
                </Card>
              </div>
            </div>
            ) : null}

            {activeTab === 'typography' ? (
            <div id="typography">
              <h2 className="font-display text-xl font-semibold mb-4">Escala tipográfica</h2>
              <div className="space-y-4 text-foreground">
                <p className="font-display text-3xl font-semibold">Título grande · Lora 600</p>
                <p className="font-display text-xl font-semibold">Título médio · Lora 600</p>
                <p className="font-display text-lg font-medium">Título pequeno · Lora 500</p>
                <p className="text-base">Corpo padrão · Inter 400</p>
                <p className="text-sm text-muted">Texto apagado · Inter 400</p>
                <p className="font-semibold text-sm uppercase tracking-wider text-brand">Eyebrow · Inter 700</p>
              </div>
            </div>
            ) : null}

            {activeTab === 'components' ? (
            <div id="components">
              <section aria-labelledby="btn-heading" className="space-y-6">
                <h2 id="btn-heading" className="font-display text-xl font-semibold">Botões</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Primário</Button>
                  <Button variant="secondary">Secundário</Button>
                  <Button variant="ghost">Fantasma</Button>
                  <Button variant="danger">Perigo</Button>
                  <Button variant="primary" disabled>Desabilitado</Button>
                </div>
              </section>

              <section aria-labelledby="icon-btn-heading" className="space-y-6">
                <h2 id="icon-btn-heading" className="font-display text-xl font-semibold">Botões de ícone</h2>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" leadingIcon={<Heart className="size-4" />}>Curtir</Button>
                  <Button variant="ghost" size="sm" leadingIcon={<MessageSquare className="size-4" />}>Comentar</Button>
                  <Button variant="ghost" size="sm" leadingIcon={<Repeat2 className="size-4" />}>Repost</Button>
                  <Button variant="ghost" size="sm" leadingIcon={<Share2 className="size-4" />}>Compartilhar</Button>
                </div>
              </section>

              <section aria-labelledby="pill-heading" className="space-y-6">
                <h2 id="pill-heading" className="font-display text-xl font-semibold">Pílulas</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="neutral">Neutra</Pill>
                  <Pill tone="brand">Marca</Pill>
                  <Pill tone="accent">Destaque</Pill>
                  <Pill tone="dark">Escura</Pill>
                </div>
              </section>

              <section aria-labelledby="card-heading" className="space-y-6">
                <h2 id="card-heading" className="font-display text-xl font-semibold">Cartões</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="p-5">
                    <h3 className="font-display text-lg font-semibold">Cartão simples</h3>
                    <p className="mt-1 text-sm text-muted">Exemplo de conteúdo sem dados pessoais.</p>
                  </Card>
                  <Card elevated className="p-5">
                    <h3 className="font-display text-lg font-semibold">Cartão elevado</h3>
                    <p className="mt-1 text-sm text-muted">Sombra —surface— para destaque.</p>
                  </Card>
                </div>
              </section>

              <section aria-labelledby="avatar-heading" className="space-y-6">
                <h2 id="avatar-heading" className="font-display text-xl font-semibold">Avatar</h2>
                <div className="flex items-center gap-4">
                  <Avatar alt="Exemplo" name="Exemplo" size="xl" ring online verified />
                  <Avatar alt="Exemplo sem imagem" size="lg" online />
                  <Avatar alt="Exemplo sem verificação" size="md" verified />
                  <Avatar alt="Offline" size="sm" />
                  <Avatar alt="Muito pequeno" size="xs" />
                </div>
              </section>

              <section aria-labelledby="search-heading" className="space-y-6">
                <h2 id="search-heading" className="font-display text-xl font-semibold">Campo de busca</h2>
                <div className="max-w-md">
                  <SearchField
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Buscar no Vibra…"
                  />
                </div>
              </section>

              <section aria-labelledby="menu-heading" className="space-y-6">
                <h2 id="menu-heading" className="font-display text-xl font-semibold">Menu de opções (post overflow)</h2>
                <div className="flex items-center gap-4">
                  <DropdownMenu
                    label="Opções da publicação"
                    align="end"
                    items={[
                      { id: 'report', label: 'Denunciar publicação', icon: <Shield className="size-4" />, description: 'Avisa a moderação sobre conteúdo inadequado.', destructive: false, onSelect: () => {} },
                      { id: 'block', label: 'Bloquear usuário', icon: <Ban className="size-4" />, description: 'Impede interações com este usuário.', destructive: true, onSelect: () => {} },
                      { id: 'mute', label: 'Silenciar usuário', icon: <Users className="size-4" />, description: 'Funcionalidade em desenvolvimento.', badge: 'Em breve', disabled: true, onSelect: () => {} },
                      { id: 'boost', label: 'Impulsionar publicação', icon: <Sparkles className="size-4" />, description: 'Funcionalidade em desenvolvimento.', badge: 'Em breve', disabled: true, onSelect: () => {} },
                    ]}
                  />
                </div>
              </section>

              <section aria-labelledby="tabs-heading" className="space-y-6">
                <h2 id="tabs-heading" className="font-display text-xl font-semibold">Abas acessíveis (role=tablist)</h2>
                <Tabs
                  label="Exemplo de abas"
                  items={[
                    { id: 'pub', label: 'Publicações', count: 0 },
                    { id: 'reels', label: 'Reels', count: 0 },
                    { id: 'photos', label: 'Fotos', count: 0 },
                    { id: 'likes', label: 'Curtidas', count: 0 },
                  ]}
                  value="pub"
                  onValueChange={() => {}}
                >
                  <div role="tabpanel" className="pt-3">
                    <p className="text-sm text-muted">Painel de exemplo — sem dados de produção.</p>
                  </div>
                </Tabs>
              </section>

              <section aria-labelledby="state-heading" className="space-y-6">
                <h2 id="state-heading" className="font-display text-xl font-semibold">Estados de carregamento / vazio / erro</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="p-5 text-center">
                    <Skeleton className="h-6 w-3/4 mx-auto rounded-pill mb-3" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-5/6 rounded mt-2" />
                  </Card>
                  <Card className="p-5 text-center">
                    <EmptyState
                      icon={<BadgeCheck className="size-5" />}
                      title="Nada por enquanto"
                      description="Este é um estado vazio acessível."
                    />
                  </Card>
                  <Card className="p-5 text-center">
                    <ErrorState
                      title="Falha de conexão"
                      description="Não foi possível obter os dados."
                      onRetry={() => {}}
                    />
                  </Card>
                </div>
              </section>
            </div>
            ) : null}
          </Tabs>
        </div>
      </main>
    </div>
  );
}