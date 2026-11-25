import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { cleanReleaseBody } from './lib/releaseBody';

const REPO_OWNER = 'Progiago';
const REPO_NAME = 'FoundFootage';
// Repositório público deste site e release onde os instaladores são espelhados,
// já que o repositório do FoundFootage é privado.
const SITE_REPO_URL = 'https://github.com/Progiago/react-vercel-deploy';
const MIRROR_TAG = 'foundfootage-installers';
const REPO_URL = SITE_REPO_URL;
const RELEASES_URL = `${SITE_REPO_URL}/releases/tag/${MIRROR_TAG}`;
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`;
// Arquivo gerado automaticamente pelo workflow de sincronização. Permite mostrar as
// versões (e o instalador) mesmo quando o repositório do FoundFootage é privado.
const LOCAL_RELEASES_URL = 'releases.json';

const INSTALLER_EXTENSIONS = ['.exe', '.msi', '.dmg', '.pkg', '.appimage', '.deb', '.rpm'];

const OS_INFO = {
  windows: {
    label: 'Windows',
    installSteps: [
      'O download do instalador .exe começou.',
      'Abra o arquivo baixado (geralmente em "Downloads").',
      'Se aparecer o aviso do Windows/SmartScreen, clique em "Mais informações" e depois em "Executar assim mesmo".',
      'Siga o assistente de instalação (Avançar → Instalar → Concluir).'
    ]
  },
  mac: {
    label: 'macOS',
    installSteps: [
      'O download do instalador começou.',
      'Abra o arquivo .dmg baixado e arraste o FoundFootage para a pasta "Aplicativos".',
      'Se o macOS bloquear, vá em Ajustes do Sistema → Privacidade e Segurança → "Abrir mesmo assim".',
      'Abra o FoundFootage pelo Launchpad.'
    ]
  },
  linux: {
    label: 'Linux',
    installSteps: [
      'O download do pacote começou.',
      'Para AppImage: clique com o botão direito → Propriedades → Permissões → marque "Permitir execução", depois dê dois cliques.',
      'Para .deb: instale com o gerenciador de pacotes ou "sudo apt install ./arquivo.deb".',
      'Para .rpm: use "sudo rpm -i arquivo.rpm" ou o seu gerenciador gráfico.'
    ]
  },
  unknown: {
    label: 'seu sistema',
    installSteps: [
      'O download do instalador começou.',
      'Abra o arquivo baixado.',
      'Siga o assistente de instalação do seu sistema operacional.'
    ]
  }
};

function isInstaller(assetName = '') {
  const lower = assetName.toLowerCase();
  return INSTALLER_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function assetOS(assetName = '') {
  const name = assetName.toLowerCase();
  if (name.endsWith('.exe') || name.endsWith('.msi')) return 'windows';
  if (name.endsWith('.dmg') || name.endsWith('.pkg')) return 'mac';
  if (name.endsWith('.appimage') || name.endsWith('.deb') || name.endsWith('.rpm')) return 'linux';
  return 'other';
}

function detectOS() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const platform = nav.userAgentData?.platform || nav.platform || '';
  const probe = `${platform} ${nav.userAgent || ''}`.toLowerCase();
  if (probe.includes('win')) return 'windows';
  if (probe.includes('mac') || probe.includes('darwin')) return 'mac';
  if (probe.includes('linux') || probe.includes('x11') || probe.includes('android')) return 'linux';
  return 'unknown';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso) {
  if (!iso) return 'Data desconhecida';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} dia${days > 1 ? 's' : ''}`;
  const months = Math.round(days / 30);
  return `há ${months} mês${months > 1 ? 'es' : ''}`;
}

// Escolhe o instalador mais adequado para o sistema do visitante.
function pickInstaller(release, preferredOS) {
  if (!release?.assets?.length) return null;
  const installers = release.assets.filter((asset) => isInstaller(asset.name));
  const pool = installers.length > 0 ? installers : release.assets;

  const forOS = pool.filter((asset) => assetOS(asset.name) === preferredOS);
  const candidates = forOS.length > 0 ? forOS : pool;

  return candidates.find((asset) => /setup/i.test(asset.name)) ?? candidates[0];
}

function startDownload(asset) {
  if (!asset) return;
  // Os assets do GitHub já vêm com Content-Disposition: attachment, então o
  // navegador inicia o download e mantém a página aberta.
  const link = document.createElement('a');
  link.href = asset.browser_download_url;
  link.rel = 'noopener noreferrer';
  link.download = asset.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function InstallGuide({ info, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className="modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <p className="eyebrow">Instalação</p>
        <h2 id="install-guide-title" className="modal__title">
          Como instalar no {info.osLabel}
        </h2>
        <p className="modal__file">
          Arquivo: <code>{info.fileName}</code>
        </p>
        <ol className="modal__steps">
          {info.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="modal__note">
          Por segurança, o navegador não executa instaladores sozinho: ele baixa o arquivo e você
          confirma a instalação no seu sistema.
        </p>
        <div className="modal__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Entendi
          </button>
          <a className="btn btn--ghost" href={RELEASES_URL} target="_blank" rel="noreferrer">
            Ver todos os arquivos
          </a>
        </div>
      </div>
    </div>
  );
}

function ReleaseCard({ release, isLatest, preferredOS, onInstall }) {
  const installer = pickInstaller(release, preferredOS);
  const otherAssets = (release.assets ?? []).filter((asset) => asset !== installer);
  const osLabel = OS_INFO[preferredOS]?.label ?? OS_INFO.unknown.label;
  const body = cleanReleaseBody(release.body);

  return (
    <article className={`release-card${isLatest ? ' release-card--latest' : ''}`}>
      <header className="release-card__header">
        <div className="release-card__title">
          <span className="release-card__tag">{release.tag_name}</span>
          {isLatest && <span className="badge badge--live">Mais recente</span>}
          {release.prerelease && <span className="badge badge--warn">Pré-release</span>}
        </div>
        <time className="release-card__date" dateTime={release.published_at || ''}>
          {formatDate(release.published_at)}
        </time>
      </header>

      {release.name && release.name !== release.tag_name && (
        <h3 className="release-card__name">{release.name}</h3>
      )}

      {body && (
        <p className="release-card__body">
          {body.length > 320 ? `${body.slice(0, 320)}…` : body}
        </p>
      )}

      <div className="release-card__actions">
        {installer ? (
          <button
            type="button"
            className="btn btn--primary btn--install"
            onClick={() => {
              startDownload(installer);
              onInstall({ release, asset: installer, os: preferredOS });
            }}
          >
            <span className="btn__icon" aria-hidden="true">
              ⬇
            </span>
            <span>
              Baixar e instalar para {osLabel}
              {installer.size ? <span className="btn__meta">{formatBytes(installer.size)}</span> : null}
            </span>
          </button>
        ) : (
          <a className="btn btn--primary" href={release.html_url} target="_blank" rel="noreferrer">
            Abrir release no GitHub
          </a>
        )}
        <a className="btn btn--ghost" href={release.html_url} target="_blank" rel="noreferrer">
          Notas da versão ↗
        </a>
      </div>

      {installer && (
        <p className="release-card__hint">
          O navegador baixa o instalador; depois é só abrir o arquivo para concluir a instalação.
        </p>
      )}

      {otherAssets.length > 0 && (
        <details className="release-card__assets">
          <summary>Outros arquivos ({otherAssets.length})</summary>
          <ul>
            {otherAssets.map((asset) => (
              <li key={asset.id}>
                <a
                  href={asset.browser_download_url}
                  target="_blank"
                  rel="noreferrer"
                  download
                >
                  {asset.name}
                </a>
                <span>{formatBytes(asset.size)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export default function App() {
  const [releases, setReleases] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | empty | error
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [guide, setGuide] = useState(null);
  const [preferredOS, setPreferredOS] = useState('unknown');

  useEffect(() => {
    setPreferredOS(detectOS());
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus('loading');
    setError('');
    try {
      let published = null;

      // 1) Feed publicado pelo workflow de sincronização (funciona com repo privado).
      try {
        const localResponse = await fetch(`${LOCAL_RELEASES_URL}?t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (localResponse.ok) {
          const localData = await localResponse.json();
          if (Array.isArray(localData) && localData.length > 0) {
            published = localData;
          }
        }
      } catch {
        /* segue para a API pública */
      }

      // 2) Fallback: API pública do GitHub (quando o repositório for público).
      if (published === null) {
        const response = await fetch(API_URL, {
          headers: { Accept: 'application/vnd.github+json' }
        });

        if (response.status === 404) {
          setReleases([]);
          setStatus('empty');
          return;
        }
        if (!response.ok) {
          throw new Error(`GitHub respondeu ${response.status}`);
        }

        const data = await response.json();
        published = Array.isArray(data) ? data : [];
      }

      const sorted = published
        .filter((release) => !release.draft)
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

      setReleases(sorted);
      setStatus(sorted.length > 0 ? 'ready' : 'empty');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Falha ao carregar releases');
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load({ silent: true }), 5 * 60 * 1000);
    const onFocus = () => load({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const handleInstall = useCallback(({ release, asset, os }) => {
    const info = OS_INFO[os] ?? OS_INFO.unknown;
    setGuide({
      osLabel: info.label,
      steps: info.installSteps,
      fileName: asset.name,
      version: release.tag_name
    });
  }, []);

  const latest = useMemo(
    () => releases.find((release) => !release.prerelease) ?? releases[0],
    [releases]
  );
  const history = useMemo(
    () => releases.filter((release) => release !== latest),
    [releases, latest]
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            FF
          </span>
          <div className="brand__text">
            <strong>FoundFootage</strong>
            <span>Catálogo audiovisual local</span>
          </div>
        </div>
        <nav className="topbar__nav">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="btn btn--small btn--primary" href={RELEASES_URL} target="_blank" rel="noreferrer">
            Todas as versões
          </a>
        </nav>
      </header>

      <main className="content">
        <section className="hero">
          <p className="eyebrow">Downloads oficiais</p>
          <h1>Baixe e instale o FoundFootage</h1>
          <p className="hero__lead">
            Detectamos o seu sistema e preparamos o instalador certo. Ao clicar, o download começa
            e mostramos o passo a passo para instalar. Novas versões aparecem aqui automaticamente.
          </p>
        </section>

        {status === 'loading' && (
          <section className="state state--loading" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Carregando versões do GitHub…</p>
          </section>
        )}

        {status === 'error' && (
          <section className="state state--error" role="alert">
            <p>Não foi possível carregar as versões automaticamente.</p>
            <p className="state__detail">{error}</p>
            <div className="state__actions">
              <button type="button" className="btn btn--primary" onClick={() => load()}>
                Tentar novamente
              </button>
              <a className="btn btn--ghost" href={RELEASES_URL} target="_blank" rel="noreferrer">
                Abrir no GitHub
              </a>
            </div>
          </section>
        )}

        {status === 'empty' && (
          <section className="state state--empty">
            <p className="state__big">Ainda não há versões publicadas</p>
            <p>
              Assim que a primeira release for publicada em{' '}
              <a href={RELEASES_URL} target="_blank" rel="noreferrer">
                GitHub Releases
              </a>
              , o instalador aparecerá aqui automaticamente.
            </p>
            <a className="btn btn--primary" href={RELEASES_URL} target="_blank" rel="noreferrer">
              Ir para GitHub Releases
            </a>
          </section>
        )}

        {status === 'ready' && latest && (
          <section className="latest">
            <div className="latest__label">
              <span className="pulse" aria-hidden="true" />
              Versão mais recente · {relativeTime(latest.published_at)}
            </div>
            <ReleaseCard
              release={latest}
              isLatest
              preferredOS={preferredOS}
              onInstall={handleInstall}
            />
          </section>
        )}

        {status === 'ready' && history.length > 0 && (
          <section className="history">
            <div className="history__head">
              <h2>Histórico de versões</h2>
              <span>
                {history.length} versõ{history.length > 1 ? 'es' : 'a'} anterior
                {history.length > 1 ? 'es' : ''}
              </span>
            </div>
            <div className="history__list">
              {history.map((release) => (
                <ReleaseCard
                  key={release.id ?? release.tag_name}
                  release={release}
                  preferredOS={preferredOS}
                  onInstall={handleInstall}
                />
              ))}
            </div>
          </section>
        )}

        <section className="info">
          <div className="info__card">
            <h3>Instalação em 3 passos</h3>
            <p>
              1) Clique em baixar · 2) Abra o instalador · 3) Siga o assistente. O arquivo é o
              mesmo publicado oficialmente no GitHub Releases.
            </p>
          </div>
          <div className="info__card">
            <h3>Atualização automática</h3>
            <p>
              A página lê direto da API de Releases do GitHub. Cada versão publicada aparece aqui
              em instantes, sem rebuild do site.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>
          © {new Date().getFullYear()} FoundFootage ·{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
        <span>
          {lastUpdated
            ? `Atualizado ${relativeTime(lastUpdated.toISOString())}`
            : `Projeto ${REPO_OWNER}/${REPO_NAME}`}
        </span>
      </footer>

      {guide && <InstallGuide info={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}
