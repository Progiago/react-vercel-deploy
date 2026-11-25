import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const REPO_OWNER = 'Progiago';
const REPO_NAME = 'FoundFootage';
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const RELEASES_URL = `${REPO_URL}/releases`;
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`;

const INSTALLER_EXTENSIONS = ['.exe', '.msi', '.dmg', '.pkg', '.appimage', '.deb', '.rpm'];

function isInstaller(assetName = '') {
  const lower = assetName.toLowerCase();
  return INSTALLER_EXTENSIONS.some((ext) => lower.endsWith(ext));
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

function pickInstaller(release) {
  if (!release?.assets?.length) return null;
  const installers = release.assets.filter((asset) => isInstaller(asset.name));
  const pool = installers.length > 0 ? installers : release.assets;
  return pool.find((asset) => /setup/i.test(asset.name)) ?? pool[0];
}

function ReleaseCard({ release, isLatest }) {
  const installer = pickInstaller(release);
  const otherAssets = (release.assets ?? []).filter((asset) => asset !== installer);

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

      {release.body && (
        <p className="release-card__body">
          {release.body.length > 320 ? `${release.body.slice(0, 320)}…` : release.body}
        </p>
      )}

      <div className="release-card__actions">
        {installer ? (
          <a className="btn btn--primary" href={installer.browser_download_url} download>
            ⬇ Baixar {installer.name}
            {installer.size ? <span className="btn__meta">{formatBytes(installer.size)}</span> : null}
          </a>
        ) : (
          <a className="btn btn--primary" href={release.html_url} target="_blank" rel="noreferrer">
            Abrir release no GitHub
          </a>
        )}
        <a className="btn btn--ghost" href={release.html_url} target="_blank" rel="noreferrer">
          Notas da versão ↗
        </a>
      </div>

      {otherAssets.length > 0 && (
        <details className="release-card__assets">
          <summary>Outros arquivos ({otherAssets.length})</summary>
          <ul>
            {otherAssets.map((asset) => (
              <li key={asset.id}>
                <a href={asset.browser_download_url} download>
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

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus('loading');
    setError('');
    try {
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
      const published = Array.isArray(data)
        ? data
            .filter((release) => !release.draft)
            .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
        : [];

      setReleases(published);
      setStatus(published.length > 0 ? 'ready' : 'empty');
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

  const latest = useMemo(() => releases.find((release) => !release.prerelease) ?? releases[0], [releases]);
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
            Repositório
          </a>
          <a className="btn btn--small btn--primary" href={RELEASES_URL} target="_blank" rel="noreferrer">
            Todas as versões
          </a>
        </nav>
      </header>

      <main className="content">
        <section className="hero">
          <p className="eyebrow">Downloads oficiais</p>
          <h1>Baixe a versão mais recente do FoundFootage</h1>
          <p className="hero__lead">
            Instaladores publicados no GitHub Releases. Esta página atualiza automaticamente
            sempre que uma nova versão é publicada — sem precisar de deploy.
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
              , ela aparecerá aqui automaticamente.
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
            <ReleaseCard release={latest} isLatest />
          </section>
        )}

        {status === 'ready' && history.length > 0 && (
          <section className="history">
            <div className="history__head">
              <h2>Histórico de versões</h2>
              <span>{history.length} versõ{history.length > 1 ? 'es' : 'a'} anterior{history.length > 1 ? 'es' : ''}</span>
            </div>
            <div className="history__list">
              {history.map((release) => (
                <ReleaseCard key={release.id ?? release.tag_name} release={release} />
              ))}
            </div>
          </section>
        )}

        <section className="info">
          <div className="info__card">
            <h3>Atualização automática</h3>
            <p>
              Os dados vêm direto da API de Releases do GitHub. Cada versão publicada é exibida
              aqui em instantes, sem rebuild do site. A página também recarrega ao voltar o foco.
            </p>
          </div>
          <div className="info__card">
            <h3>Instalador oficial</h3>
            <p>
              Os botões de download apontam para os arquivos anexados na release correspondente,
              incluindo o instalador do aplicativo desktop.
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
    </div>
  );
}
