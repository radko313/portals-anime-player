// api.js — AllAnime GraphQL API (same source as ani-cli)

const ALLANIME_API = 'https://api.allanime.day/api';
const ALLANIME_REFR = 'https://allmanga.to';

async function gqlFetch(query, variables) {
  const url = `${ALLANIME_API}?variables=${encodeURIComponent(JSON.stringify(variables))}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Referer: ALLANIME_REFR }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Decode obfuscated sourceUrls (-- prefix = encoded)
function decodeUrl(url) {
  if (!url.startsWith('--')) return url;
  const encoded = url.slice(2);
  // AllAnime uses a simple char substitution
  return encoded.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
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
    const url = decodeUrl(src.sourceUrl);
    if (!url.startsWith('http')) continue;
    sources.push({
      url,
      quality: src.sourceName || 'default',
      isM3U8: url.includes('.m3u8') || url.includes('m3u8')
    });
  }

  return { sources };
}
