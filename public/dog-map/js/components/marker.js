// 마커 컴포넌트. 실제 일러스트로 바꿀 때는 artMarkup만 손대면 된다.
import { groupIcon } from './icons.js';

const DISC = 34;

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 견종 그림: art 경로가 있으면 일러스트, 없으면 그룹 실루엣 */
export function artMarkup(breed) {
  return breed.art
    ? `<img src="${escapeHtml(breed.art)}" alt="" loading="lazy">`
    : groupIcon(breed.group);
}

export const groupColor = (group) => `var(--group-${group})`;

export function createMarkerEl(item) {
  if (item.kind === 'place') {
    const el = document.createElement('div');
    el.className = `place place--${item.place.kind}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span>${escapeHtml(item.place.ko)}</span>`;
    return el;
  }

  const el = document.createElement('button');
  el.type = 'button';
  if (item.kind === 'breed') {
    const { breed } = item;
    el.className = 'mk mk--breed no-label';
    el.style.setProperty('--group-color', groupColor(breed.group));
    el.dataset.breed = breed.id;
    el.innerHTML = `<span class="mk__disc">${artMarkup(breed)}</span>`
      + `<span class="mk__label" data-side="bottom">${escapeHtml(breed.name.ko)}</span>`;
    el.setAttribute('aria-label', `${breed.name.ko} (${breed.name.en}) 상세 정보 열기`);
  } else {
    el.className = `mk mk--${item.kind}`;
    el.innerHTML = '<span class="mk__pill"></span>';
  }
  return el;
}

/** 내용을 갱신하고, 크기를 다시 재야 하는지 판단할 서명을 돌려준다 */
export function updateMarkerEl(el, item) {
  if (item.kind === 'breed') {
    el.classList.toggle('is-selected', item.role === 'selected');
    el.classList.toggle('is-parent', item.role === 'parent');
    el.setAttribute('aria-pressed', item.role === 'selected');
    return item.key;
  }
  if (item.kind === 'place') return item.key;

  const sig = `${item.name ?? ''}|${item.count}`;
  if (el.dataset.sig !== sig) {
    el.dataset.sig = sig;
    const pill = el.firstElementChild;
    pill.innerHTML = item.name
      ? `<span class="mk__name">${escapeHtml(item.name)}<span class="mk__sep">·</span></span><b>${item.count}</b>`
      : `<b>${item.count}</b>`;
    el.title = item.name ?? '';
    const where = item.name ?? '이 지역';
    el.setAttribute('aria-label', `${where}의 견종 ${item.count}종. 눌러서 확대`);
  }
  return sig;
}

export function measureMarker(el, item) {
  if (item.kind === 'breed') {
    const label = el.querySelector('.mk__label');
    return { w: DISC, h: DISC, labelW: label.offsetWidth, labelH: label.offsetHeight };
  }
  const inner = el.firstElementChild;
  if (item.kind === 'place') return { w: inner.offsetWidth, h: inner.offsetHeight };
  // 이름 없이 숫자만 보이는 축약형의 크기도 함께 재 둔다
  const wasCompact = el.classList.contains('is-compact');
  el.classList.remove('is-compact');
  const full = { w: inner.offsetWidth, h: inner.offsetHeight };
  el.classList.add('is-compact');
  full.compactW = inner.offsetWidth;
  el.classList.toggle('is-compact', wasCompact);
  return full;
}

