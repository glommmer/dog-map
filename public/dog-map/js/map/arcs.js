// 믹스견의 출신지에서 부모 견종 출신지로 이어지는 호. 지표면 위로 떠오른 대권 곡선으로 그린다.
import * as d3 from 'd3';
import { prefersReducedMotion } from './globe.js';

const SAMPLES = 72;
const DRAW_MS = 950;
const STAGGER_MS = 220;
const RAD = Math.PI / 180;
const BOW = 0.14;

export function createArcs(globe) {
  let arcs = [];
  let raf = 0;

  function pathFor(arc, progress) {
    const { lng, lat } = globe.view;
    const rotate = d3.geoRotation([-lng, -lat]);
    const s = globe.scale();
    const [cx, cy] = globe.center();
    const lift = Math.min(0.32, arc.dist * 0.2);
    const point = (t) => {
      const [l, a] = rotate(arc.along(t));
      const r = 1 + lift * Math.sin(Math.PI * t);
      const cosA = Math.cos(a * RAD);
      return { x: r * cosA * Math.sin(l * RAD), y: -r * Math.sin(a * RAD), z: cosA * Math.cos(l * RAD) };
    };
    // 위에서 내려다보면 대권이 직선처럼 보이므로 화면에서 옆으로 살짝 휘게 한다
    const p0 = point(0);
    const p1 = point(1);
    const bowX = -(p1.y - p0.y) * BOW * arc.side;
    const bowY = (p1.x - p0.x) * BOW * arc.side;

    let d = '';
    let pen = false;
    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i / SAMPLES) * progress;
      const p = point(t);
      // 지구 뒤편으로 넘어간 구간은 그리지 않는다
      const visible = p.z > 0 || Math.hypot(p.x, p.y) > 1;
      if (visible) {
        const bend = Math.sin(Math.PI * t);
        const x = cx + (p.x + bowX * bend) * s;
        const y = cy + (p.y + bowY * bend) * s;
        d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      pen = visible;
    }
    return d;
  }

  function draw(now = performance.now()) {
    const sel = globe.arcLayer.selectAll('g.arc-group').data(arcs, (a) => a.key);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('class', 'arc-group');
    enter.append('path').attr('class', 'arc arc--glow');
    enter.append('path').attr('class', 'arc arc--core');
    const merged = enter.merge(sel);
    merged.each(function (arc) {
      const raw = (now - arc.start) / DRAW_MS;
      const p = arc.instant ? 1 : d3.easeCubicOut(Math.min(Math.max(raw, 0), 1));
      const d = p > 0 ? pathFor(arc, p) : '';
      d3.select(this).selectAll('path').attr('d', d);
    });
  }

  function animate() {
    cancelAnimationFrame(raf);
    const tick = (now) => {
      draw(now);
      if (arcs.some((a) => !a.instant && now - a.start < DRAW_MS)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  globe.onRender(() => draw());

  return {
    /** 출신지 하나와 도착지 목록을 받아 호를 다시 그린다. 빈 값이면 지운다. */
    show(origin, targets = []) {
      const instant = prefersReducedMotion();
      const start = performance.now();
      arcs = origin
        ? targets.map((t, i) => {
            const a = [origin.lng, origin.lat];
            const b = [t.lng, t.lat];
            return {
              key: `${origin.id}>${t.id}`,
              along: d3.geoInterpolate(a, b),
              dist: d3.geoDistance(a, b),
              side: i % 2 ? 1 : -1,
              start: start + i * STAGGER_MS,
              instant,
            };
          })
        : [];
      draw();
      if (arcs.length) animate();
    },
  };
}

