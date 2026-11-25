#!/usr/bin/env node
/**
 * Sincroniza as releases do FoundFootage (repositório privado) com este site público.
 *
 * O que faz:
 *  1. Lê as releases via API usando o token FOUNDFOOTAGE_TOKEN.
 *  2. Copia os instaladores para uma release pública neste repositório
 *     (tag "foundfootage-installers"), para que qualquer visitante possa baixar.
 *  3. Gera public/releases.json com o histórico e as URLs públicas de download.
 *
 * Variáveis de ambiente:
 *  FOUNDFOOTAGE_TOKEN  token com leitura no repositório Progiago/FoundFootage
 *  GH_TOKEN            token com contents:write neste repositório (usado pelo gh)
 *  GITHUB_REPOSITORY   owner/repo deste site (ex.: Progiago/react-vercel-deploy)
 *  SOURCE_REPO         opcional, padrão Progiago/FoundFootage
 *  MIRROR_TAG          opcional, padrão foundfootage-installers
 */
import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SOURCE_REPO = process.env.SOURCE_REPO || 'Progiago/FoundFootage';
const SITE_REPO = process.env.GITHUB_REPOSITORY;
const MIRROR_TAG = process.env.MIRROR_TAG || 'foundfootage-installers';
const SOURCE_TOKEN = process.env.FOUNDFOOTAGE_TOKEN;
const GH_TOKEN = process.env.GH_TOKEN;

const INSTALLER_EXTENSIONS = [
  '.exe',
  '.msi',
  '.msix',
  '.msixbundle',
  '.appinstaller',
  '.dmg',
  '.pkg',
  '.appimage',
  '.deb',
  '.rpm'
];

if (!SITE_REPO) {
  console.error('GITHUB_REPOSITORY não definido.');
  process.exit(1);
}
if (!SOURCE_TOKEN) {
  console.error('Secret FOUNDFOOTAGE_TOKEN ausente: não é possível ler as releases privadas.');
  process.exit(1);
}
if (!GH_TOKEN) {
  console.error('GH_TOKEN ausente: não é possível publicar os instaladores.');
  process.exit(1);
}

const API = 'https://api.github.com';
const SITE_URL = `https://github.com/${SITE_REPO}`;
const MIRROR_RELEASE_URL = `${SITE_URL}/releases/tag/${MIRROR_TAG}`;

function isInstaller(name = '') {
  const lower = name.toLowerCase();
  return INSTALLER_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function gh(args, { input } = {}) {
  return execFileSync('gh', args, {
    env: { ...process.env, GH_TOKEN },
    stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    input
  }).toString();
}

function ghJson(args) {
  return JSON.parse(gh(['api', ...args]));
}

async function fetchSourceReleases() {
  const response = await fetch(`${API}/repos/${SOURCE_REPO}/releases?per_page=100`, {
    headers: {
      Authorization: `Bearer ${SOURCE_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'foundfootage-site-sync'
    }
  });
  if (!response.ok) {
    throw new Error(`Falha ao ler releases de ${SOURCE_REPO}: HTTP ${response.status}`);
  }
  const releases = await response.json();
  if (!Array.isArray(releases)) throw new Error('Resposta inesperada da API de releases.');
  return releases.filter((release) => !release.draft);
}

function ensureMirrorRelease() {
  try {
    return ghJson([`/repos/${SITE_REPO}/releases/tags/${MIRROR_TAG}`]);
  } catch {
    console.log(`Criando release pública de instaladores (${MIRROR_TAG})…`);
    ghJson([
      '--method',
      'POST',
      `/repos/${SITE_REPO}/releases`,
      '-f',
      `tag_name=${MIRROR_TAG}`,
      '-f',
      'name=Instaladores do FoundFootage',
      '-f',
      'body=Instaladores oficiais publicados automaticamente a partir das releases do FoundFootage.',
      '-f',
      'make_latest=false'
    ]);
    return ghJson([`/repos/${SITE_REPO}/releases/tags/${MIRROR_TAG}`]);
  }
}

async function downloadAsset(asset, destination) {
  const response = await fetch(`${API}/repos/${SOURCE_REPO}/releases/assets/${asset.id}`, {
    headers: {
      Authorization: `Bearer ${SOURCE_TOKEN}`,
      Accept: 'application/octet-stream',
      'User-Agent': 'foundfootage-site-sync'
    },
    redirect: 'follow'
  });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${asset.name}: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));

  if (typeof asset.size === 'number' && asset.size > 0) {
    const { stat } = await import('node:fs/promises');
    const { size } = await stat(destination);
    if (size !== asset.size) {
      throw new Error(`Tamanho inesperado para ${asset.name}: ${size} != ${asset.size}`);
    }
  }
}

function safeName(tag, name) {
  const cleanTag = String(tag).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return cleanTag && !name.toLowerCase().startsWith(cleanTag.toLowerCase())
    ? `${cleanTag}-${name}`
    : name;
}

async function main() {
  const releases = await fetchSourceReleases();
  const mirror = ensureMirrorRelease();

  const mirrored = new Map(
    (mirror.assets ?? []).map((asset) => [asset.name, asset])
  );
  console.log(`Releases encontradas: ${releases.length}. Assets já publicados: ${mirrored.size}.`);

  const workDir = await mkdtemp(join(tmpdir(), 'ff-sync-'));
  const feed = [];

  try {
    for (const release of releases) {
      const installers = (release.assets ?? []).filter((asset) => isInstaller(asset.name));
      const assets = [];

      for (const asset of installers) {
        let publicName = asset.name;
        const existing = mirrored.get(publicName);

        if (existing && existing.size !== asset.size) {
          publicName = safeName(release.tag_name, asset.name);
        }

        const alreadyThere = mirrored.get(publicName);

        if (!alreadyThere || alreadyThere.size !== asset.size) {
          console.log(`Publicando ${asset.name} (${asset.size} bytes)…`);
          // O nome do asset publicado é o nome do arquivo enviado, então o
          // arquivo temporário precisa ter exatamente o nome público desejado.
          const assetDir = join(workDir, String(asset.id));
          await mkdir(assetDir, { recursive: true });
          const target = join(assetDir, publicName.replace(/[\\/:*?"<>|]/g, '_'));
          await downloadAsset(asset, target);
          gh([
            'release',
            'upload',
            MIRROR_TAG,
            target,
            `--repo`,
            SITE_REPO,
            `--clobber`
          ]);
          if (publicName !== asset.name) {
            // Evita duplicar o arquivo no feed caso o nome original já exista.
            console.log(`  publicado como ${publicName}`);
          }
        } else {
          console.log(`${asset.name} já está publicado, ignorando.`);
        }

        assets.push({
          id: asset.id,
          name: publicName,
          size: asset.size,
          browser_download_url: `${SITE_URL}/releases/download/${MIRROR_TAG}/${encodeURIComponent(publicName)}`
        });
      }

      feed.push({
        id: release.id,
        tag_name: release.tag_name,
        name: release.name,
        body: release.body,
        prerelease: Boolean(release.prerelease),
        draft: false,
        published_at: release.published_at,
        html_url: MIRROR_RELEASE_URL,
        assets
      });
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }

  feed.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  await mkdir('public', { recursive: true });
  await writeFile('public/releases.json', `${JSON.stringify(feed, null, 2)}\n`, 'utf8');

  console.log(`public/releases.json gerado com ${feed.length} release(s).`);
  const summary = feed
    .map((release) => `- ${release.tag_name}: ${release.assets.map((a) => a.name).join(', ') || 'sem instalador'}`)
    .join('\n');
  console.log(summary);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
