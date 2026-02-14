// storage.js — localStorage helpers

const PROGRESS_KEY = 'portals_anime_progress';
const CONTINUE_KEY = 'portals_anime_continue';

function saveProgress(episodeId, currentTime, duration) {
  const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  all[episodeId] = { currentTime, duration, ts: Date.now() };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

function getProgress(episodeId) {
  const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  return all[episodeId] || null;
}

function saveContinueWatching(animeId, animeTitle, image, episodeId, episodeNum) {
  const list = getContinueWatching();
  const filtered = list.filter(e => e.animeId !== animeId);
  filtered.unshift({ animeId, animeTitle, image, episodeId, episodeNum, ts: Date.now() });
  localStorage.setItem(CONTINUE_KEY, JSON.stringify(filtered.slice(0, 10)));
}

function getContinueWatching() {
  return JSON.parse(localStorage.getItem(CONTINUE_KEY) || '[]');
}
