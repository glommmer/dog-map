// 앱 진입점: 데이터를 불러와 각 모듈을 연결한다.
import * as d3 from 'd3';
import { loadStartupData, loadWorld } from './data/loader.js';
import { createGlobe } from './map/globe.js';
import { createSemantic, breedItem, SCALE_COUNTRY } from './map/semantic.js';
import { createOverlay } from './map/overlay.js';
import { createArcs } from './map/arcs.js';
import { createPanel } from './components/panel.js';
import { createSearch } from './components/search.js';
import { createFilters } from './components/filters.js';
import { createLegend } from './components/legend.js';
import { createBrowse } from './components/browse.js';
import { createFavorites } from './data/favorites.js';
import { paintStars } from './stars.js';

const SELECT_SCALE = 2600;
const $ = (id) => document.getElementById(id);

async function start() {
  paintStars($('stars'));
  const loadState = $('load-state');

  let startup;
  let world;
  try {
    [startup, world] = await Promise.all([loadStartupData(), loadWorld()]);
  } catch (err) {
    console.error(err);
    loadState.textContent = '지도를 불러오지 못했습니다. 네트워크를 확인하고 새로고침해 주세요.';
    return;
  }
  loadState.hidden = true;

  const { breeds, countries, places, taxonomy } = startup;
  const breedsById = new Map(breeds.map((b) => [b.id, b]));
  const favorites = createFavorites();
  $('breed-count').textContent = `세계 견종 ${breeds.length}종이 태어난 곳`;

  const globe = createGlobe({
    stage: $('stage'),
    svgEl: $('globe'),
    topoDetail: world[0],
    topoCoarse: world[1],
  });
  const semantic = createSemantic({ countries, places });
  const arcs = createArcs(globe);
  const overlay = createOverlay($('markers'), { onActivate: activate });

  let selected = null;
  let returnFocusId = null;

  // ─── 상태 알림 ───
  let statusTimer = 0;
  function announce(text) {
    const el = $('status');
    el.textContent = text;
    el.classList.add('is-on');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => el.classList.remove('is-on'), 2400);
  }

  // ─── 렌더 ───
  function pinnedItems() {
    if (!selected) return [];
    const parents = selected.parents.map((id) => breedsById.get(id)).filter(Boolean);
    return [
      breedItem(selected, { pinned: true, role: 'selected' }),
      ...parents.map((p) => breedItem(p, { pinned: true, role: 'parent' })),
    ];
  }

  globe.onRender(() => {
    const pins = pinnedItems();
    const pinKeys = new Set(pins.map((p) => p.key));
    const items = semantic.items(globe.scale()).filter((i) => !pinKeys.has(i.key));
    overlay.update(pins.concat(items), globe);
  });

  // ─── 선택 ───
  /** 믹스견은 출신지와 부모가 함께 보이는 시점을 계산한다 */
  function viewForMix(breed) {
    const points = [breed, breed, ...breed.parents.map((id) => breedsById.get(id)).filter(Boolean)]
      .map((b) => [b.lng, b.lat]);
    const center = d3.geoCentroid({ type: 'MultiPoint', coordinates: points });
    const reach = Math.max(...points.map((p) => d3.geoDistance(center, p)));
    if (reach > 1.35) return { lng: breed.lng, lat: breed.lat, k: 1 };
    const room = Math.min(globe.size.w - panel.insets().right, globe.size.h - panel.insets().bottom) * 0.38;
    return { lng: center[0], lat: center[1], k: globe.kForScale(room / Math.max(Math.sin(reach), 0.08)) };
  }

  function select(breed, { push = true, focus = true, instant = false } = {}) {
    selected = breed;
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set('breed', breed.id);
      history.pushState({ breed: breed.id }, '', url);
    }
    document.title = `${breed.name.ko} · 견종 지도`;
    panel.open(breed, { focus });
    globe.setHighlight(countries[breed.country]?.iso);

    const target = breed.mix
      ? viewForMix(breed)
      : { lng: breed.lng, lat: breed.lat, k: Math.max(globe.view.k, globe.kForScale(SELECT_SCALE)) };
    globe.flyTo({ ...target, insets: panel.insets(), duration: instant ? 0 : undefined });

    const parents = breed.parents.map((id) => breedsById.get(id)).filter(Boolean);
    arcs.show(parents.length ? breed : null, parents);
    globe.invalidate();
  }

  function deselect({ push = true } = {}) {
    if (!selected) return;
    returnFocusId = selected.id;
    selected = null;
    if (push) {
      const url = new URL(location.href);
      url.searchParams.delete('breed');
      history.pushState({}, '', url);
    }
    document.title = '견종 지도';
    panel.close();
    arcs.show(null);
    globe.setHighlight(null);
    globe.flyTo({ insets: { right: 0, bottom: 0 } });
    if (!overlay.focusBreed(returnFocusId)) $('stage').focus({ preventScroll: true });
  }

  /** 마커·배지를 눌렀을 때 */
  function activate(item) {
    if (item.kind === 'breed') {
      select(item.breed);
      return;
    }
    if (item.count === 1) {
      select(item.breeds[0]);
      return;
    }
    if (item.kind === 'cluster') {
      globe.flyTo({ lng: item.lng, lat: item.lat, k: globe.kForScale(semantic.expansionScale(item.clusterId)) });
      return;
    }
    // 국가 배지: 그 나라 견종이 한눈에 들어오게 확대한다
    const coords = item.breeds.map((b) => [b.lng, b.lat]);
    const center = d3.geoCentroid({ type: 'MultiPoint', coordinates: coords });
    const reach = Math.max(...coords.map((p) => d3.geoDistance(center, p)), 0.02);
    const fit = (Math.min(globe.size.w, globe.size.h) * 0.3) / Math.sin(Math.min(reach, 1.2));
    globe.flyTo({ lng: center[0], lat: center[1], k: globe.kForScale(Math.max(fit, SCALE_COUNTRY * 1.2)) });
  }

  async function share(breed) {
    const url = new URL(location.href);
    url.searchParams.set('breed', breed.id);
    try {
      await navigator.clipboard.writeText(url.href);
      announce('링크를 복사했습니다.');
    } catch {
      announce('링크를 복사하지 못했습니다. 주소창의 주소를 이용해 주세요.');
    }
  }

  const panel = createPanel($('panel'), {
    breeds,
    breedsById,
    countries,
    taxonomy,
    favorites,
    onClose: () => deselect(),
    onNavigate: (id) => select(breedsById.get(id)),
    onSheetChange: () => {},
    onShare: share,
  });

  createSearch($('search'), { breeds, countries, onChoose: (b) => select(b) });

  const browse = createBrowse($('browse'), {
    countries,
    favorites,
    onChoose: (id) => select(breedsById.get(id)),
  });

  let activeBreeds = breeds;
  const filters = createFilters($('filters'), {
    breeds,
    countries,
    taxonomy,
    onChange(active) {
      activeBreeds = active;
      semantic.setActive(active);
      browse.setActive(active);
      globe.invalidate();
      if (!active.length) announce('조건에 맞는 견종이 없습니다.');
    },
  });
  const legend = createLegend($('legend'), { taxonomy });

  // ─── 컨트롤 ───
  /** 지금 필터 안에서 하나를 고르되, 방금 보던 견종은 피한다 */
  $('random').addEventListener('click', () => {
    const pool = activeBreeds.filter((b) => b !== selected);
    if (pool.length) select(pool[Math.floor(Math.random() * pool.length)]);
    else announce('조건에 맞는 견종이 없습니다.');
  });
  $('zoom-in').addEventListener('click', () => globe.zoomBy(1.7));
  $('zoom-out').addEventListener('click', () => globe.zoomBy(1 / 1.7));
  $('zoom-reset').addEventListener('click', () => globe.reset(panel.insets()));

  // 지도의 빈 곳을 누르면 패널을 닫는다 (드래그 뒤의 클릭은 d3-zoom이 막아 준다)
  $('stage').addEventListener('click', (e) => {
    if (!e.target.closest('.mk')) deselect();
  });

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (filters.isOpen()) filters.close();
    else if (browse.isOpen()) browse.close();
    else if (legend.isOpen()) legend.close();
    else deselect();
  });

  // ─── URL 상태 ───
  const breedFromUrl = () => breedsById.get(new URLSearchParams(location.search).get('breed'));
  addEventListener('popstate', () => {
    const breed = breedFromUrl();
    if (breed) select(breed, { push: false });
    else deselect({ push: false });
  });

  document.fonts?.ready.then(() => {
    overlay.remeasure();
    globe.invalidate();
  });

  const initial = breedFromUrl();
  if (initial) select(initial, { push: false, focus: false, instant: true });
  else globe.invalidate();
}

start();

