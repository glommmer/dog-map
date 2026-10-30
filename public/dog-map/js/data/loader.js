// 데이터 로더. 모든 경로는 상대 경로라서 /dogmap/ 같은 하위 경로에서도 동작한다.
const WORLD_BASE = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/';

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} 불러오기 실패 (${res.status})`);
  return res.json();
}

export async function loadStartupData() {
  const [breeds, countries, places, taxonomy] = await Promise.all([
    getJson('data/breeds-index.json'),
    getJson('data/countries.json'),
    getJson('data/places.json'),
    getJson('data/taxonomy.json'),
  ]);
  return { breeds, countries, places, taxonomy };
}

export function loadWorld() {
  return Promise.all([
    getJson(`${WORLD_BASE}countries-50m.json`),
    getJson(`${WORLD_BASE}countries-110m.json`),
  ]);
}

const details = new Map();

/** 상세 정보는 견종을 열 때 처음 불러오고, 실패하면 다시 시도할 수 있게 캐시에서 뺀다 */
export function loadDetails(id) {
  if (!details.has(id)) {
    const pending = getJson(`data/details/${encodeURIComponent(id)}.json`);
    pending.catch(() => details.delete(id));
    details.set(id, pending);
  }
  return details.get(id);
}

