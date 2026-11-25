# FoundFootage — página de downloads

Página React (Vite) publicada no **GitHub Pages** que exibe a versão mais recente do
FoundFootage, o histórico de versões e um botão que baixa o instalador oficial.

O repositório `Progiago/FoundFootage` é **privado**, então a página não pode ler a API
pública de releases diretamente. Um workflow sincroniza as releases e espelha os
instaladores em uma release pública deste repositório.

## Como funciona a automação

1. `.github/workflows/sync-releases.yml` roda a cada 30 minutos (e manualmente).
2. `scripts/sync-releases.mjs` lê as releases do FoundFootage usando o secret
   `FOUNDFOOTAGE_TOKEN`.
3. Os instaladores (`.exe`, `.msi`, `.msix`, `.dmg`, `.pkg`, `.AppImage`, `.deb`, `.rpm`)
   são copiados para a release pública **`foundfootage-installers`** deste repositório.
4. O histórico e as URLs públicas de download são gravados em `public/releases.json`,
   commitados e publicados pelo workflow de deploy.
5. A página lê `releases.json` primeiro e, como fallback, a API pública do GitHub
   (útil caso o FoundFootage volte a ser público).

O botão de download detecta o sistema do visitante (Windows, macOS ou Linux), escolhe
o instalador correspondente da versão mais recente e inicia o download. Em seguida
abre um guia de instalação passo a passo.

> Observação: por segurança, navegadores não instalam programas sozinhos. O botão
> baixa o instalador oficial e mostra as instruções; a confirmação final de instalação
> é feita pelo usuário no sistema operacional.

## Configuração necessária (uma vez)

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Crie o secret **`FOUNDFOOTAGE_TOKEN`** em **Settings → Secrets and variables → Actions**
   com um token que tenha permissão de leitura no repositório `Progiago/FoundFootage`
   (escopo `repo`).
3. Faça push na branch `main`.

O site fica em: `https://progiago.github.io/react-vercel-deploy/`

O workflow roda sozinho a cada 30 minutos. Para forçar uma atualização imediata:
**Actions → Sync FoundFootage releases → Run workflow**.

## Deploy no GitHub Pages

O workflow `.github/workflows/deploy.yml` publica a pasta `dist/` no GitHub Pages
a cada push na `main`, a cada release publicada e também manualmente.

## Desenvolvimento

```bash
npm install
npm run dev      # ambiente local
npm run build    # gera dist/
npm run preview  # pré-visualiza dist/
```

Sem `public/releases.json` preenchido, a página cai no fallback da API pública e mostra
o estado vazio enquanto o repositório do FoundFootage for privado.

## Personalização

Os dados do repositório ficam no topo de `src/App.jsx`:

```js
const REPO_OWNER = 'Progiago';
const REPO_NAME = 'FoundFootage';
const SITE_REPO_URL = 'https://github.com/Progiago/react-vercel-deploy';
const MIRROR_TAG = 'foundfootage-installers';
```

Altere esses valores para apontar para outro repositório de releases.
