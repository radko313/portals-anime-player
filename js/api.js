// api.js — AllAnime GraphQL API (same source as ani-cli)

const PROXY = 'https://anime-proxy.bongiornomordo.workers.dev';

async function gqlFetch(query, variables) {
  const url = `${PROXY}?variables=${encodeURIComponent(JSON.stringify(variables))}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Decode obfuscated sourceUrls (-- prefix = hex bytes XOR 0x38)
function decodeUrl(url) {
  if (!url.startsWith('--')) return url;
  const hex = url.slice(2);
  return hex.match(/../g).map(h => String.fromCharCode(parseInt(h, 16) ^ 0x38)).join('');
}

async function search(query) {
  const gql = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
  const data = await gqlFetch(gql, {
    search: { allowAdult: false, allowUnknown: false, query },
    limit: 20,
    page: 1,
    translationType: 'sub',
    countryOrigin: 'ALL'
  });
  const edges = data?.data?.shows?.edges || [];
  return edges.map(e => ({
    id: e._id,
    title: e.name,
    image: `https://wp.youtube-anime.com/aln.youtube-anime.com/wp-content/uploads/${e._id}.jpg`,
    availableEpisodes: e.availableEpisodes
  }));
}

async function getAnimeInfo(animeId) {
  const gql = `query($showId:String!){show(_id:$showId){_id name availableEpisodesDetail thumbnail}}`;
  const data = await gqlFetch(gql, { showId: animeId });
  const show = data?.data?.show;
  if (!show) throw new Error('Show not found');

  const epDetail = show.availableEpisodesDetail || {};
  const subEps = epDetail.sub || [];
  // Sort episodes numerically
  const episodes = subEps
    .map(num => ({ id: `${animeId}?ep=${num}`, number: num, title: `Episode ${num}` }))
    .sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

  return {
    id: show._id,
    title: show.name,
    image: show.thumbnail,
    totalEpisodes: subEps.length,
    episodes
  };
}

async function getStreamingUrls(episodeId) {
  // episodeId format: "showId?ep=epNum"
  const [showId, epParam] = episodeId.split('?ep=');
  const gql = `query($showId:String!,$translationType:VaildTranslationTypeEnumType!,$episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;
  const data = await gqlFetch(gql, {
    showId,
    translationType: 'sub',
    episodeString: epParam
  });

  const sourceUrls = data?.data?.episode?.sourceUrls || [];
  const sources = [];

  for (const src of sourceUrls) {
    if (!src.sourceUrl) continue;
    let decoded = decodeUrl(src.sourceUrl);

    // Relative path → needs clock.json resolution
    if (decoded.startsWith('/')) {
      try {
        const id = new URL('https://x.x' + decoded).searchParams.get('id');
        if (!id) continue;
        const res = await fetch(`${PROXY}/resolve?id=${encodeURIComponent(id)}`);
        const json = await res.json();
        const links = json.links || [];
        for (const link of links) {
          if (!link.link) continue;
          const referer = link.headers?.Referer || 'https://megacloud.club/';
          const origin = link.headers?.Origin || 'https://megacloud.club';
          const proxyUrl = `${PROXY}/stream?url=${encodeURIComponent(link.link)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
          sources.push({
            url: proxyUrl,
            quality: link.resolutionStr || src.sourceName || 'auto',
            isM3U8: true
          });
        }
      } catch (e) { /* skip */ }
      continue;
    }

    if (!decoded.startsWith('http')) continue;

    // Direct URL — proxy it too for headers
    sources.push({
      url: decoded,
      quality: src.sourceName || 'default',
      isM3U8: decoded.includes('.m3u8')
    });
  }

  return { sources };
}
