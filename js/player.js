// player.js — HLS.js video player + custom controls

let hlsInstance = null;
let saveTimer = null;
let currentEpisodeId = null;
let sources = [];

function formatTime(secs) {
  if (!isFinite(secs)) return '00:00';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function pickBestSource(srcs) {
  const order = ['1080p', '720p', '480p', '360p', 'default', 'backup'];
  for (const q of order) {
    const match = srcs.find(s => s.quality === q);
    if (match) return match;
  }
  return srcs[0];
}

function initControls() {
  const video   = document.getElementById('video-el');
  const btnPlay = document.getElementById('ctrl-play');
  const seekBar = document.getElementById('ctrl-seek');
  const timeEl  = document.getElementById('ctrl-time');
  const btnFs   = document.getElementById('ctrl-fs');
  const quality = document.getElementById('ctrl-quality');

  btnPlay.addEventListener('click', () => {
    if (video.paused) video.play(); else video.pause();
  });

  video.addEventListener('play',  () => { btnPlay.innerHTML = '&#9646;&#9646;'; });
  video.addEventListener('pause', () => { btnPlay.innerHTML = '&#9654;'; });

  video.addEventListener('timeupdate', () => {
    timeEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    if (video.duration) {
      seekBar.value = (video.currentTime / video.duration) * 100;
    }
    // Save progress every ~5s
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (currentEpisodeId) {
        saveProgress(currentEpisodeId, video.currentTime, video.duration);
      }
    }, 5000);
  });

  video.addEventListener('ended', () => {
    if (currentEpisodeId) {
      saveProgress(currentEpisodeId, video.duration, video.duration);
    }
  });

  seekBar.addEventListener('input', () => {
    if (video.duration) {
      video.currentTime = (seekBar.value / 100) * video.duration;
    }
  });

  btnFs.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.getElementById('view-player').requestFullscreen().catch(() => {});
    }
  });

  quality.addEventListener('change', () => {
    const selected = sources.find(s => s.quality === quality.value);
    if (selected) {
      const t = video.currentTime;
      loadSource(selected, t);
    }
  });

  video.addEventListener('waiting', () => {
    document.getElementById('video-loading').classList.remove('hidden');
  });
  video.addEventListener('canplay', () => {
    document.getElementById('video-loading').classList.add('hidden');
  });
  video.addEventListener('playing', () => {
    document.getElementById('video-loading').classList.add('hidden');
  });
}

function loadSource(src, resumeTime = 0) {
  const video = document.getElementById('video-el');
  document.getElementById('video-loading').classList.remove('hidden');

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (src.isM3U8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(src.url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      video.currentTime = resumeTime;
      video.play().catch(() => {});
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src.url;
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = resumeTime;
      video.play().catch(() => {});
    }, { once: true });
  } else {
    video.src = src.url;
    video.currentTime = resumeTime;
    video.play().catch(() => {});
  }
}

async function loadEpisode(episodeId, resumeTime = 0) {
  currentEpisodeId = episodeId;
  document.getElementById('video-loading').classList.remove('hidden');

  const data = await getStreamingUrls(episodeId);
  sources = (data.sources || []).filter(s => s.url);

  if (!sources.length) {
    document.getElementById('video-loading').classList.remove('hidden');
    document.getElementById('video-loading').textContent = 'NO SOURCES FOUND';
    return;
  }

  // Populate quality dropdown
  const quality = document.getElementById('ctrl-quality');
  quality.innerHTML = '';
  sources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.quality || 'default';
    opt.textContent = (s.quality || 'default').toUpperCase();
    quality.appendChild(opt);
  });

  const best = pickBestSource(sources);
  quality.value = best.quality || 'default';

  loadSource(best, resumeTime);
}

// Wire up controls on DOM ready
document.addEventListener('DOMContentLoaded', initControls);
