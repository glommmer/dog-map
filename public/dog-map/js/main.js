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

  const panel = createPanel($('panel'), {
    breedsById,
    countries,
    taxonomy,
    onClose: () => deselect(),
    onNavigate: (id) => select(breedsById.get(id)),
    onSheetChange: () => {},
  });

  createSearch($('search'), { breeds, onChoose: (b) => select(b) });

  const filters = createFilters($('filters'), {
    breeds,
    taxonomy,
    onChange(active) {
      semantic.setActive(active);
      globe.invalidate();
      if (!active.length) announce('조건에 맞는 견종이 없습니다.');
    },
  });
  const legend = createLegend($('legend'), { taxonomy });

  // ─── 컨트롤 ───
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

