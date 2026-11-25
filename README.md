# FoundFootage — página de downloads

Página React (Vite) publicada no **GitHub Pages** que exibe a versão mais recente do
FoundFootage e o histórico de versões, lendo direto dos **GitHub Releases**.

## Como funciona a automação

- A página busca as releases em tempo real na API pública do GitHub
  (`/repos/Progiago/FoundFootage/releases`).
- Quando uma nova release é publicada, ela aparece automaticamente na página
  (a cada 5 minutos e ao focar a aba) — não é necessário novo deploy.
- O botão de download detecta o sistema do visitante (Windows, macOS ou Linux),
  baixa o instalador correspondente anexado na release e abre um guia de instalação
  passo a passo (procura `.exe`, `.msi`, `.dmg`, `.pkg`, `.AppImage`, `.deb`, `.rpm`,
  priorizando arquivos com `setup` no nome).

> Observação: por segurança, navegadores não instalam programas sozinhos. O botão
> baixa o instalador oficial e mostra as instruções; a confirmação final de instalação
> é feita pelo usuário no sistema operacional.

## Deploy no GitHub Pages

O workflow `.github/workflows/deploy.yml` publica a pasta `dist/` no GitHub Pages
a cada push na `main`, a cada release publicada e também manualmente.

**Configuração necessária (uma vez):**

1. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Faça push na branch `main`.

O site ficará em: `https://progiago.github.io/react-vercel-deploy/`

> A página lê o repositório `Progiago/FoundFootage`. Se o repositório for privado,
> a API pública de releases retorna 404 — nesse caso a página mostra um estado
> amigável com link direto para a página de Releases.

## Desenvolvimento

```bash
npm install
npm run dev      # ambiente local
npm run build    # gera dist/
npm run preview  # pré-visualiza dist/
```

## Personalização

Os dados do repositório ficam no topo de `src/App.jsx`:

```js
const REPO_OWNER = 'Progiago';
const REPO_NAME = 'FoundFootage';
```

Altere esses valores para apontar para outro repositório de releases.
