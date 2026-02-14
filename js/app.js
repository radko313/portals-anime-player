// app.js — view router + UI logic

const state = {
  view: 'SEARCH',
  animeId: null,
  animeData: null,
  episodeId: null,
};

// ── Navigate ──────────────────────────────────────────────

function navigate(view, params = {}) {
  Object.assign(state, { view, ...params });

  document.getElementById('view-search').style.display   = view === 'SEARCH'   ? 'flex' : 'none';
  document.getElementById('view-episodes').style.display = view === 'EPISODES' ? 'flex' : 'none';
  document.getElementById('view-player').style.display   = view === 'PLAYER'   ? 'flex' : 'none';

  document.getElementById('btn-back').style.display = view === 'SEARCH' ? 'none' : '';

  if (view === 'EPISODES') renderEpisodes();
  if (view === 'PLAYER')   loadEpisode(state.episodeId, params.resumeTime || 0);
}

// ── Search view ───────────────────────────────────────────

function renderContinueWatching() {
  const list = getContinueWatching();
  const section = document.getElementById('continue-section');
  const cards   = document.getElementById('continue-cards');

  if (!list.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  cards.innerHTML = '';

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'continue-card';
    card.innerHTML = `
      <img src="${item.image}" alt="" loading="lazy" onerror="this.style.display='none'" />
      <div class="continue-card-info">
        <div class="continue-card-title">${item.animeTitle}</div>
        <div class="continue-card-ep">EP ${item.episodeNum}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      state.animeId = item.animeId;
      state.animeData = null;
      state.episodeId = item.episodeId;
      const prog = getProgress(item.episodeId);
      navigate('PLAYER', { episodeId: item.episodeId, resumeTime: prog ? prog.currentTime : 0 });
      renderPlayerMeta(item.animeTitle, item.episodeNum);
    });
    cards.appendChild(card);
  });
}

async function doSearch(query) {
  const resultsSection = document.getElementById('results-section');
  const resultsList    = document.getElementById('results-list');
  const emptyState     = document.getElementById('search-empty');
  const errorPanel     = document.getElementById('search-error');

  emptyState.style.display  = 'none';
  errorPanel.style.display  = 'none';
  resultsSection.style.display = '';
  resultsList.innerHTML = '<div class="loading-row">SEARCHING...</div>';

  try {
    const results = await search(query);

    if (!results.length) {
      resultsList.innerHTML = '<div class="loading-row">NO RESULTS FOUND</div>';
      return;
    }

    resultsList.innerHTML = '';
    results.forEach(item => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `
        <img src="${item.image || ''}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <div class="result-info">
          <div class="result-title">${item.title || item.id}</div>
          <div class="result-meta">${item.subOrDub ? item.subOrDub.toUpperCase() : ''} ${item.releaseDate ? '· ' + item.releaseDate : ''}</div>
        </div>
        <span class="result-play">&#9654;</span>
      `;
      row.addEventListener('click', async () => {
        state.animeId = item.id;
        state.animeData = null;
        await loadAnimeInfo(item.id);
      });
      resultsList.appendChild(row);
    });
  } catch (e) {
    resultsList.innerHTML = '';
    resultsSection.style.display = 'none';
    errorPanel.style.display = '';
  }
}

async function loadAnimeInfo(animeId) {
  const epList = document.getElementById('episodes-list');
  const infoBar = document.getElementById('anime-info-bar');

  navigate('EPISODES', { animeId });
  epList.innerHTML = '<div class="loading-row">LOADING...</div>';
  infoBar.innerHTML = '';

  try {
    const data = await getAnimeInfo(animeId);
    state.animeData = data;
    renderEpisodes();
  } catch (e) {
    epList.innerHTML = '<div class="loading-row">FAILED TO LOAD</div>';
  }
}

// ── Episodes view ─────────────────────────────────────────

function renderEpisodes() {
  const data = state.animeData;
  if (!data) return;

  const infoBar = document.getElementById('anime-info-bar');
  infoBar.innerHTML = `
    <img src="${data.image || ''}" alt="" onerror="this.style.display='none'" />
    <div class="anime-info-text">
      <div class="anime-info-title">${data.title || data.id}</div>
      <div class="anime-info-meta">
        ${data.totalEpisodes ? data.totalEpisodes + ' EPISODES' : ''}
        ${data.status ? ' · ' + data.status.toUpperCase() : ''}
      </div>
    </div>
  `;

  const epList = document.getElementById('episodes-list');
  epList.innerHTML = '';

  const episodes = data.episodes || [];
  if (!episodes.length) {
    epList.innerHTML = '<div class="loading-row">NO EPISODES FOUND</div>';
    return;
  }

  episodes.forEach(ep => {
    const prog = getProgress(ep.id);
    const watched = prog && prog.duration && (prog.currentTime / prog.duration) > 0.9;
    const inProgress = prog && !watched;

    const row = document.createElement('div');
    row.className = 'episode-row' + (inProgress ? ' in-progress' : '');

    let badge = '';
    if (inProgress) {
      badge = `<span class="ep-badge resume">&#9654; ${formatMinSec(prog.currentTime)}</span>`;
    } else if (watched) {
      badge = `<span class="ep-badge watched">&#10003;</span>`;
    }

    row.innerHTML = `
      <span class="ep-num">${ep.number || ''}</span>
      <span class="ep-title">${ep.title || 'EPISODE ' + ep.number}</span>
      ${badge}
    `;
    row.addEventListener('click', () => {
      state.episodeId = ep.id;
      const resumeTime = (inProgress && prog) ? prog.currentTime : 0;
      navigate('PLAYER', { episodeId: ep.id, resumeTime });
      renderPlayerMeta(data.title || data.id, ep.number);
      saveContinueWatching(state.animeId, data.title || data.id, data.image || '', ep.id, ep.number);
    });
    epList.appendChild(row);
  });
}

// ── Player view ───────────────────────────────────────────

function renderPlayerMeta(animeTitle, epNum) {
  document.getElementById('player-meta').innerHTML =
    `<span class="ep-label">${animeTitle}</span> — EP ${epNum}`;
}

// ── Helpers ───────────────────────────────────────────────

function formatMinSec(secs) {
  if (!secs || !isFinite(secs)) return '';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Init ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Back button
  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.view === 'PLAYER') navigate('EPISODES');
    else navigate('SEARCH');
  });

  // Close button
  document.getElementById('btn-close').addEventListener('click', () => {
    PortalsSdk.closeIframe();
  });

  // Search
  const input = document.getElementById('search-input');
  document.getElementById('btn-search').addEventListener('click', () => {
    const q = input.value.trim();
    if (q) doSearch(q);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) doSearch(q);
    }
  });

  // Continue watching
  renderContinueWatching();

  // Start on search view
  navigate('SEARCH');
});
