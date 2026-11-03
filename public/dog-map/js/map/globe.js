// 지구본 모듈: 정사영 투영, 드래그 회전, 줌, 비행 전환, 시점 관리를 맡는다.
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { CONTINENTS, continentOf } from './continents.js';

const K_MIN = 0.75;
const K_MAX = 90;
const LAT_LIMIT = 85;
const DEG = 180 / Math.PI;
const HOME = { lng: 62, lat: 28, k: 1 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapLng = (v) => ((v + 540) % 360) - 180;
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function buildLayers(topo) {
  const { countries } = topo.objects;
  const land = CONTINENTS.map((name) => ({
    name,
    shape: topojson.merge(topo, countries.geometries.filter((g) => continentOf(g) === name)),
  }));
  return {
    land,
    borders: topojson.mesh(topo, countries, (a, b) => a !== b),
    features: new Map(topojson.feature(topo, countries).features.map((f) => [f.id, f])),
  };
}

export function createGlobe({ stage, svgEl, topoDetail, topoCoarse }) {
  const detail = buildLayers(topoDetail);
  // 드래그 중에는 가벼운 1:110m를 그려 프레임을 유지한다
  const coarse = buildLayers(topoCoarse);

  const view = { lng: HOME.lng, lat: HOME.lat, k: HOME.k, ox: 0, oy: 0 };
  const size = { w: 0, h: 0, r0: 0 };
  const listeners = new Set();

  const projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
  const path = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();

  const svg = d3.select(svgEl);
  const defs = svg.append('defs');
  const atmosphere = defs.append('radialGradient').attr('id', 'atmosphere');
  atmosphere.append('stop').attr('offset', '83%').attr('stop-color', 'var(--atmosphere)').attr('stop-opacity', 0.5);
  atmosphere.append('stop').attr('offset', '100%').attr('stop-color', 'var(--atmosphere)').attr('stop-opacity', 0);
  const rim = defs.append('radialGradient').attr('id', 'ocean-rim');
  rim.append('stop').attr('offset', '62%').attr('stop-color', 'var(--ocean-rim)').attr('stop-opacity', 0);
  rim.append('stop').attr('offset', '100%').attr('stop-color', 'var(--ocean-rim)').attr('stop-opacity', 0.6);

  const glowEl = svg.append('circle').attr('fill', 'url(#atmosphere)');
  const oceanEl = svg.append('path').attr('class', 'globe__ocean');
  const graticuleEl = svg.append('path').attr('class', 'globe__graticule');
  const landEls = new Map(CONTINENTS.map((name) => [name, svg.append('path').attr('class', `land--${name}`)]));
  const highlightEl = svg.append('path').attr('class', 'globe__highlight');
  const bordersEl = svg.append('path').attr('class', 'globe__border');
  const rimEl = svg.append('circle').attr('fill', 'url(#ocean-rim)').attr('pointer-events', 'none');
  const arcLayer = svg.append('g').attr('class', 'arcs');

  let highlight = null;
  let interacting = false;
  let frame = 0;
  let flight = null;
  let inertia = null;

  const scale = () => size.r0 * view.k;
  const center = () => [size.w / 2 + view.ox, size.h / 2 + view.oy];

  function syncProjection() {
    projection
      .rotate([-view.lng, -view.lat])
      .scale(scale())
      .translate(center())
      .clipExtent([[-2, -2], [size.w + 2, size.h + 2]]);
  }

  function draw() {
    frame = 0;
    syncProjection();
    const s = scale();
    const [cx, cy] = center();
    const layers = interacting && s < 1600 ? coarse : detail;

    oceanEl.attr('d', path({ type: 'Sphere' }));
    graticuleEl.attr('d', s < 2600 ? path(graticule) : null);
    for (const { name, shape } of layers.land) landEls.get(name).attr('d', path(shape));
    bordersEl.attr('d', path(layers.borders));
    highlightEl.attr('d', highlight ? path(detail.features.get(highlight)) : null);

    // 크게 확대하면 지구 테두리가 화면 밖이므로 효과를 끈다
    const showRim = s < Math.max(size.w, size.h) * 1.6;
    glowEl.attr('display', showRim ? null : 'none').attr('cx', cx).attr('cy', cy).attr('r', s * 1.2);
    rimEl.attr('display', showRim ? null : 'none').attr('cx', cx).attr('cy', cy).attr('r', s);

    for (const fn of listeners) fn(api);
  }

  function invalidate() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function rotateByScreen(dx, dy) {
    const deg = DEG / scale();
    view.lat = clamp(view.lat + dy * deg, -LAT_LIMIT, LAT_LIMIT);
    view.lng = wrapLng(view.lng - (dx * deg) / Math.max(Math.cos(view.lat / DEG), 0.35));
  }

  // ─── 입력: d3-zoom의 이동량을 지구 회전으로 바꾼다 ───
  let prev = d3.zoomIdentity;
  const zoom = d3.zoom()
    .scaleExtent([K_MIN, K_MAX])
    .on('start', () => {
      cancelFlight();
      cancelInertia();
      interacting = true;
    })
    .on('zoom', (event) => {
      const t = event.transform;
      // 지구 중심점이 평면 변환에서 얼마나 옮겨지는지를 구하면
      // 드래그와 포인터 기준 확대를 하나의 식으로 처리할 수 있다
      const [cx, cy] = center();
      const dx = t.x + (t.k * (cx - prev.x)) / prev.k - cx;
      const dy = t.y + (t.k * (cy - prev.y)) / prev.k - cy;
      prev = t;
      view.k = t.k;
      rotateByScreen(dx, dy);
      trackVelocity(event, dx, dy);
      invalidate();
    })
    .on('end', (event) => {
      interacting = false;
      startInertia(event);
      invalidate();
    });

  const stageSel = d3.select(stage).call(zoom);

  function syncZoomState() {
    prev = d3.zoomIdentity.translate(prev.x, prev.y).scale(view.k);
    stageSel.property('__zoom', prev);
  }

  // ─── 관성 ───
  let velocity = { x: 0, y: 0, t: 0 };
  function trackVelocity(event, dx, dy) {
    const now = performance.now();
    const dt = Math.max(now - velocity.t, 1);
    const isDrag = event.sourceEvent && event.sourceEvent.type !== 'wheel';
    velocity = isDrag
      ? { x: velocity.x * 0.4 + (dx / dt) * 0.6, y: velocity.y * 0.4 + (dy / dt) * 0.6, t: now }
      : { x: 0, y: 0, t: now };
  }
  function startInertia() {
    const idle = performance.now() - velocity.t;
    if (prefersReducedMotion() || idle > 60 || Math.hypot(velocity.x, velocity.y) < 0.15) return;
    let { x, y } = velocity;
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      rotateByScreen(x * dt, y * dt);
      const decay = Math.exp(-dt / 320);
      x *= decay;
      y *= decay;
      draw();
      inertia = Math.hypot(x, y) > 0.015 ? requestAnimationFrame(tick) : null;
    };
    inertia = requestAnimationFrame(tick);
  }
  function cancelInertia() {
    if (inertia) cancelAnimationFrame(inertia);
    inertia = null;
  }

  // ─── 비행 전환 ───
  function cancelFlight() {
    if (flight) cancelAnimationFrame(flight);
    flight = null;
  }

  function flyTo({ lng = view.lng, lat = view.lat, k = view.k, insets, duration } = {}) {
    cancelFlight();
    cancelInertia();
    k = clamp(k, K_MIN, K_MAX);
    lat = clamp(lat, -LAT_LIMIT, LAT_LIMIT);
    const ox1 = insets ? -insets.right / 2 : view.ox;
    const oy1 = insets ? -insets.bottom / 2 : view.oy;
    const from = { ...view };
    const dist = d3.geoDistance([from.lng, from.lat], [lng, lat]);
    const logK = Math.log(k / from.k);
    const ms = prefersReducedMotion()
      ? 0
      : duration ?? clamp(420 + dist * 480 + Math.abs(logK) * 170, 420, 1900);

    if (ms === 0) {
      Object.assign(view, { lng, lat, k, ox: ox1, oy: oy1 });
      syncZoomState();
      invalidate();
      return;
    }

    const along = d3.geoInterpolate([from.lng, from.lat], [lng, lat]);
    // 멀리 갈수록 잠시 물러났다 다가가 방향감을 잃지 않게 한다
    const dip = Math.min(dist * 1.3, Math.max(0, Math.log(Math.max(from.k, k))));
    const start = performance.now();
    const ease = d3.easeCubicInOut;
    const tick = (now) => {
      const p = Math.min((now - start) / ms, 1);
      const e = ease(p);
      const [l, a] = dist > 1e-6 ? along(e) : [lng, lat];
      view.lng = l;
      view.lat = a;
      view.k = from.k * Math.exp(logK * e - dip * Math.sin(Math.PI * e));
      view.ox = from.ox + (ox1 - from.ox) * e;
      view.oy = from.oy + (oy1 - from.oy) * e;
      draw();
      if (p < 1) {
        flight = requestAnimationFrame(tick);
      } else {
        flight = null;
        syncZoomState();
      }
    };
    flight = requestAnimationFrame(tick);
  }

  // ─── 크기 ───
  function resize() {
    size.w = stage.clientWidth;
    size.h = stage.clientHeight;
    size.r0 = Math.min(size.w, size.h) * 0.46;
    svg.attr('viewBox', `0 0 ${size.w} ${size.h}`);
    invalidate();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ─── 키보드 ───
  stage.addEventListener('keydown', (e) => {
    if (e.target !== stage) return;
    const step = 60;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      rotateByScreen(...moves[e.key]);
      invalidate();
    } else if (e.key === '+' || e.key === '=') {
      api.zoomBy(1.6);
    } else if (e.key === '-' || e.key === '_') {
      api.zoomBy(1 / 1.6);
    } else if (e.key === '0') {
      api.reset();
    }
  });

  const api = {
    view,
    size,
    arcLayer,
    scale,
    center,
    invalidate,
    flyTo,
    onRender(fn) { listeners.add(fn); },
    zoomBy(f) { flyTo({ k: view.k * f, duration: prefersReducedMotion() ? 0 : 320 }); },
    reset(insets) { flyTo({ ...HOME, insets }); },
    /** 원하는 화면 배율(반지름 픽셀)을 k 값으로 바꾼다 */
    kForScale(s) { return clamp(s / size.r0, K_MIN, K_MAX); },
    project(lng, lat) { return projection([lng, lat]); },
    isVisible(lng, lat) { return d3.geoDistance([view.lng, view.lat], [lng, lat]) < Math.PI / 2 - 0.02; },
    setHighlight(iso) {
      const next = iso && detail.features.has(iso) ? iso : null;
      if (next !== highlight) {
        highlight = next;
        invalidate();
      }
    },
  };
  return api;
}

