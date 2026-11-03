// 마커 오버레이: 항목을 화면에 배치하고, 라벨 충돌을 해결하고, 진입·퇴장을 관리한다.
import { createMarkerEl, updateMarkerEl, measureMarker } from '../components/marker.js';
import { SCALE_LABEL } from './semantic.js';

const GAP = 3;
const LABEL_SIDES = ['bottom', 'right', 'left', 'top'];
const FADE_MS = 300;

const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function rectAt(x, y, w, h) {
  return { x: x - w / 2 - GAP, y: y - h / 2 - GAP, w: w + GAP * 2, h: h + GAP * 2 };
}

function labelRect(side, x, y, w, h, disc) {
  // 여백(GAP)까지 포함해도 자기 마커의 영역과 겹치지 않는 거리
  const off = disc / 2 + GAP * 2 + 1;
  if (side === 'bottom') return rectAt(x, y + off + h / 2, w, h);
  if (side === 'top') return rectAt(x, y - off - h / 2, w, h);
  if (side === 'right') return rectAt(x + off + w / 2, y, w, h);
  return rectAt(x - off - w / 2, y, w, h);
}

export function createOverlay(layer, { onActivate }) {
  const live = new Map();

  function ensure(item) {
    let rec = live.get(item.key);
    if (!rec) {
      const el = createMarkerEl(item);
      layer.append(el);
      rec = { el, item, sig: null, size: null, side: null, hidden: false, noLabel: true, compact: false, extra: 0, timer: 0 };
      if (el.tagName === 'BUTTON') el.addEventListener('click', () => onActivate(rec.item));
      live.set(item.key, rec);
    } else if (rec.timer) {
      clearTimeout(rec.timer);
      rec.timer = 0;
      rec.el.classList.remove('is-leaving');
    }
    rec.item = item;
    const sig = updateMarkerEl(rec.el, item);
    if (sig !== rec.sig) {
      rec.sig = sig;
      rec.size = measureMarker(rec.el, item);
    }
    return rec;
  }

  function setHidden(rec, hidden) {
    if (rec.hidden !== hidden) {
      rec.hidden = hidden;
      rec.el.classList.toggle('is-hidden', hidden);
    }
  }

  function setExtra(rec, extra) {
    if (rec.extra === extra) return;
    rec.extra = extra;
    const target = rec.el.querySelector('.mk__disc, .mk__pill');
    if (target) {
      if (extra) target.dataset.extra = extra;
      else delete target.dataset.extra;
    }
  }

  function retire(rec, key) {
    if (rec.timer) return;
    rec.el.classList.add('is-leaving');
    rec.timer = setTimeout(() => {
      rec.el.remove();
      live.delete(key);
    }, FADE_MS);
  }

  function update(items, globe) {
    const { w, h } = globe.size;
    const s = globe.scale();
    const seen = new Set();
    const nodes = [];

    for (const item of items) {
      if (!globe.isVisible(item.lng, item.lat)) continue;
      const [x, y] = globe.project(item.lng, item.lat);
      if (x < -80 || y < -80 || x > w + 80 || y > h + 80) continue;
      nodes.push({ rec: ensure(item), x, y });
      seen.add(item.key);
    }
    nodes.sort((a, b) => b.rec.item.priority - a.rec.item.priority || (a.rec.item.key < b.rec.item.key ? -1 : 1));

    const placed = [];
    const free = (r) => !placed.some((p) => hits(p, r));
    const bodies = [];

    // 1) 고정(선택·부모) 마커와 그 이름표를 가장 먼저 놓는다
    // 2) 그다음 일반 마커와 배지. 자리가 없으면 가까운 이웃에 +N으로 합친다
    for (const n of nodes) {
      const { item, size } = n.rec;
      if (item.kind === 'place') continue;
      // 배지는 먼저 숫자만 있는 축약형으로 자리를 잡아, 되도록 많은 나라가 보이게 한다
      n.compact = !!size.compactW;
      const box = rectAt(n.x, n.y, n.compact ? size.compactW : size.w, size.h);
      if (item.pinned || free(box)) {
        n.box = box;
        placed.push(box);
        bodies.push(n);
        n.extra = 0;
        n.show = true;
      } else {
        n.show = false;
        const near = bodies.reduce((best, b) => {
          const d = Math.hypot(b.x - n.x, b.y - n.y);
          return !best || d < best.d ? { b, d } : best;
        }, null);
        if (near) near.b.extra += item.count ?? 1;
      }
    }

    // 자리가 남는 배지는 이름까지 펼친다
    for (const n of bodies) {
      if (!n.compact) continue;
      const wide = rectAt(n.x, n.y, n.rec.size.w, n.rec.size.h);
      if (!placed.some((p) => p !== n.box && hits(p, wide))) {
        placed[placed.indexOf(n.box)] = wide;
        n.box = wide;
        n.compact = false;
      }
    }

    // 3) 이름표: 빈 곳을 찾아 네 방향을 시도하고, 없으면 숨긴다
    for (const n of bodies) {
      const { item, size } = n.rec;
      if (item.kind !== 'breed') continue;
      n.side = null;
      if (!item.pinned && s < SCALE_LABEL) continue;
      // 지난 프레임의 방향을 먼저 시도해 이름표가 흔들리지 않게 한다
      const sides = n.rec.side ? [n.rec.side, ...LABEL_SIDES.filter((d) => d !== n.rec.side)] : LABEL_SIDES;
      const disc = item.pinned ? size.h * 1.3 : size.h;
      for (const side of sides) {
        const r = labelRect(side, n.x, n.y, size.labelW, size.labelH, disc);
        if (free(r) && r.x >= 0 && r.x + r.w <= w && r.y >= 0 && r.y + r.h <= h) {
          placed.push(r);
          n.side = side;
          break;
        }
      }
    }

    // 4) 지명은 남는 자리에만
    for (const n of nodes) {
      const { item, size } = n.rec;
      if (item.kind !== 'place') continue;
      const box = rectAt(n.x, n.y, size.w, size.h);
      n.show = free(box);
      if (n.show) placed.push(box);
    }

    // 계산이 끝난 뒤 한꺼번에 반영한다
    for (const n of nodes) {
      const { rec } = n;
      rec.el.style.transform = `translate3d(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px, 0)`;
      setHidden(rec, !n.show);
      if (rec.item.kind !== 'place') setExtra(rec, n.show ? n.extra : 0);
      if (rec.item.kind === 'country' || rec.item.kind === 'cluster') {
        if (n.show && n.compact !== rec.compact) {
          rec.compact = n.compact;
          rec.el.classList.toggle('is-compact', n.compact);
        }
      }
      if (rec.item.kind === 'breed' && n.show) {
        const noLabel = !n.side;
        if (noLabel !== rec.noLabel) {
          rec.noLabel = noLabel;
          rec.el.classList.toggle('no-label', noLabel);
        }
        if (n.side && n.side !== rec.side) {
          rec.side = n.side;
          rec.el.querySelector('.mk__label').dataset.side = n.side;
        }
      }
    }

    for (const [key, rec] of live) {
      if (!seen.has(key)) retire(rec, key);
    }
  }

  return {
    update,
    /** 글꼴이 로드된 뒤 크기를 다시 잰다 */
    remeasure() {
      for (const rec of live.values()) rec.size = measureMarker(rec.el, rec.item);
    },
    focusBreed(id) {
      const rec = live.get(`breed:${id}`);
      if (rec && !rec.hidden) rec.el.focus({ preventScroll: true });
      return !!rec && !rec.hidden;
    },
  };
}

