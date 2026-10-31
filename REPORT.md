# Relatório da investigação com REA

## Objetivo

Entender o aplicativo "Instagram" instalado no PC e usar o que fosse possível para reconstruir uma experiência funcional local.

## Alvo encontrado

| Item | Valor |
| --- | --- |
| Pacote | `Facebook.InstagramBeta` |
| Versão | `42.0.23.0` |
| Nome de exibição | `Instagram` |
| Pasta | `C:\Program Files\WindowsApps\Facebook.InstagramBeta_42.0.23.0_neutral__8xx8rvfyw5nnt` |
| Tipo | Host PWA do Microsoft Edge |

O `AppxManifest.xml` declara uma extensão `microsoft.store.edgePWA` e aponta para conteúdo remoto:

```xml
<uap3:AppExtension Name="microsoft.store.edgePWA" Id="MicrosoftEdge" ... />
<uap3:AppExtension Name="com.ms.webapp.internals.4" Id="Facebook.InstagramBeta" ...>
  parameters?--app-id=akpamiohjfcnimfljfndmaldlcfphjmp
  --app-fallback-url=https://www.instagram.com/?utm_source=pwa_homescreen&__pwa=1
  --display-mode=standalone
  start-url?https://www.instagram.com/?utm_source=pwa_homescreen&__pwa=1
</uap3:AppExtension>
```

## Conclusão da análise

O pacote instalado é um **invólucro PWA**: ele abre `https://www.instagram.com` em uma janela do Edge em modo standalone. Dentro do pacote não existe a aplicação web, o JavaScript do produto, o feed ou os dados locais — apenas manifesto, ícones e a configuração do host.

Por isso, não havia código local do Instagram para descompilar ou reconstruir. Copiar os ativos ou o código remoto também não seria adequado. A alternativa foi reconstruir **o comportamento observável** em uma implementação própria.

## O que foi reconstruído

O Vibra implementa, com código original, as funcionalidades que definem essa categoria de produto:

- autenticação e sessão
- feed de fotos
- stories de 24 horas
- curtidas, comentários e seguidores
- perfis e edição de perfil
- exploração, busca e sugestões
- upload local de imagens
- mensagens sociais e conversas de match
- área de namoro separada, com verificação, afinidade, matches e Radar

A linguagem visual foi propositalmente diferente: papel quente, tipografia serifada, cartões editoriais e uma navegação própria em cinco áreas, em vez de uma cópia da interface do Instagram ou do Tinder.

## Evidência reproduzível

```powershell
Get-AppxPackage -Name '*Instagram*' |
  Select-Object Name, PackageFullName, Version, InstallLocation

Get-Content 'C:\Program Files\WindowsApps\Facebook.InstagramBeta_42.0.23.0_neutral__8xx8rvfyw5nnt\AppxManifest.xml'
```

Observação: a pasta `WindowsApps` exige permissão de administrador para leitura em alguns sistemas.

## Resultado

- App funcional: `http://127.0.0.1:4173` (ou a porta definida em `PORT`)
- Dados de exemplo: opcionais, via `npm run seed:demo` e `VIBRA_DEMO_PASSWORD`
- Código: `server.js`, `lib/dating.js`, `public/`
- Testes: `npm test` (servidor isolado) ou `node qa/smoke.mjs` com o servidor em execução
- Registro da Fase 1: `docs/FASE-1.md`
