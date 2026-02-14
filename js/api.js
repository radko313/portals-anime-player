// api.js — Consumet API wrapper

const params = new URLSearchParams(location.search);
const BASE = (params.get('api') || 'https://api.consumet.org/anime/gogoanime').replace(/\/$/, '');

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function search(query) {
  const data = await apiFetch(`${BASE}/${encodeURIComponent(query)}`);
  return data.results || [];
}

async function getAnimeInfo(animeId) {
  return apiFetch(`${BASE}/info/${encodeURIComponent(animeId)}`);
}

async function getStreamingUrls(episodeId) {
  return apiFetch(`${BASE}/watch/${encodeURIComponent(episodeId)}`);
}
