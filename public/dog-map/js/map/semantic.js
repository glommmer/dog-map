// 시맨틱 줌: 현재 배율에 맞춰 국가 배지, 클러스터, 개별 마커 중 무엇을 그릴지 정한다.
import Supercluster from 'supercluster';

/** 이 배율(지구 반지름 픽셀) 미만은 국가 배지 */
export const SCALE_COUNTRY = 900;
/** 이 배율 이상이면 개별 마커에 이름표를 붙인다 */
export const SCALE_LABEL = 1100;

const CLUSTER_RADIUS = 64;
const CLUSTER_EXTENT = 512;
const CLUSTER_MAX_ZOOM = 12;

export const zoomForScale = (s) => Math.log2((2 * Math.PI * s) / CLUSTER_EXTENT);
export const scaleForZoom = (z) => (CLUSTER_EXTENT * 2 ** z) / (2 * Math.PI);

export function breedItem(breed, opts = {}) {
  const rank = opts.pinned ? 1000 : 300;
  return {
    key: `breed:${breed.id}`,
    kind: 'breed',
    lng: breed.lng,
    lat: breed.lat,
    priority: rank + (opts.role === 'selected' ? 100 : 0),
    pinned: !!opts.pinned,
    role: opts.role ?? null,
    breed,
  };
}

export function createSemantic({ countries, places }) {
  let active = [];
  let byCountry = [];
  let index = null;
  let clusterCache = { zoom: null, items: [] };
  const leafNames = new Map();

  function setActive(breeds) {
    active = breeds;
    clusterCache = { zoom: null, items: [] };
    leafNames.clear();

    const groups = new Map();
    for (const b of breeds) {
      if (!groups.has(b.country)) groups.set(b.country, []);
      groups.get(b.country).push(b);
    }
    byCountry = [...groups].map(([code, list]) => {
      const c = countries[code];
      return {
        key: `country:${code}`,
        kind: 'country',
        lng: c.lng,
        lat: c.lat,
        priority: 100 + list.length,
        name: c.ko,
        count: list.length,
        breeds: list,
      };
    });

    index = new Supercluster({ radius: CLUSTER_RADIUS, extent: CLUSTER_EXTENT, maxZoom: CLUSTER_MAX_ZOOM });
    index.load(breeds.map((b) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      properties: { breed: b },
    })));
  }

  function clusterName(id) {
    if (!leafNames.has(id)) {
      const leaves = index.getLeaves(id, Infinity).map((f) => f.properties.breed);
      const codes = new Set(leaves.map((b) => b.country));
      leafNames.set(id, {
        leaves,
        name: codes.size === 1 ? countries[leaves[0].country].ko : null,
      });
    }
    return leafNames.get(id);
  }

  function clusterItems(s) {
    const zoom = Math.floor(zoomForScale(s));
    if (clusterCache.zoom === zoom) return clusterCache.items;
    const items = index.getClusters([-180, -85, 180, 85], zoom).map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      if (!f.properties.cluster) return breedItem(f.properties.breed);
      const id = f.properties.cluster_id;
      const { name, leaves } = clusterName(id);
      return {
        key: `cluster:${zoom}:${id}`,
        kind: 'cluster',
        lng,
        lat,
        priority: 200 + f.properties.point_count,
        name,
        count: f.properties.point_count,
        clusterId: id,
        breeds: leaves,
      };
    });
    clusterCache = { zoom, items };
    return items;
  }

  function placeItems(s) {
    return places
      .filter((p) => s >= p.minScale && s < p.maxScale)
      .map((p) => ({
        key: `place:${p.en}`,
        kind: 'place',
        lng: p.lng,
        lat: p.lat,
        priority: p.rank,
        place: p,
      }));
  }

  return {
    setActive,
    /** 현재 배율에서 그릴 배지·마커와 지명 목록 */
    items(s) {
      const base = !index || !active.length ? [] : s < SCALE_COUNTRY ? byCountry : clusterItems(s);
      return base.concat(placeItems(s));
    },
    /** 클러스터를 펼치는 데 필요한 배율 */
    expansionScale(clusterId) {
      return scaleForZoom(index.getClusterExpansionZoom(clusterId) + 0.15);
    },
  };
}

