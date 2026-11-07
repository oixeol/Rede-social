# Assets do perfil

## Regra

Perfil nunca reutiliza arte, nomes ou números da Imagem B. Dados de usuário vêm da API. Imagens enviados pelo backend são aceitos somente quando usam o caminho interno `/uploads/`, sem `..` ou barras invertidas.

## Placeholders próprios

| Uso | Implementação | Texto alternativo |
| --- | --- | --- |
| Avatar ausente | Iniciais sobre gradiente laranja em `components/ui/avatar.tsx` | `Foto de perfil de {nome}` |
| Banner ausente | Gradiente geométrico original renderizado por `ProfileBanner` em `frontend/src/components/profile/profile-center.tsx` | `Capa de {nome}` |
| Miniatura sem mídia | Cartão textual com fundo neutro e legenda real da publicação | Texto da publicação |

Placeholders são código do próprio projeto. Não usam imagens de terceiros nem assets extraídos da referência.

## Assets públicos legados

`frontend/public/images/` contém arquivos históricos usados apenas por fluxos legados fora do perfil real. Novos componentes de perfil não importam esses arquivos. Remoção pode acontecer em tarefa separada, após confirmar consumidores.
