// 목록 보기: 지금 필터에 맞는 견종을 이름·나라별로 훑어보고, 즐겨찾기만 모아 본다.
import { artMarkup, escapeHtml, groupColor } from './marker.js';

const byName = (a, b) => a.name.ko.localeCompare(b.name.ko, 'ko');

export function createBrowse(root, { countries, favorites, onChoose }) {
  let active = [];
  let tab = 'all';
  let sort = 'name';

  root.innerHTML = `
    <button type="button" class="icon-btn" aria-label="견종 목록 열기" aria-expanded="false" aria-controls="browse-pop">
      <svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>
    </button>
    <div class="browse__pop" id="browse-pop" role="group" aria-label="견종 목록" hidden>
      <div class="chips browse__tabs">
        <button type="button" class="chip" data-tab="all" aria-pressed="true">전체</button>
        <button type="button" class="chip" data-tab="favorites" aria-pressed="false">즐겨찾기</button>
        <span class="browse__spacer"></span>
        <button type="button" class="chip" data-sort="name" aria-pressed="true">이름순</button>
        <button type="button" class="chip" data-sort="country" aria-pressed="false">나라별</button>
      </div>
      <p class="browse__count" data-count></p>
      <div class="browse__list" data-list></div>
    </div>`;

  const toggle = root.querySelector('.icon-btn');
  const pop = root.querySelector('.browse__pop');
  const list = root.querySelector('[data-list]');

  const row = (b) => `
    <button type="button" class="browse__item" data-id="${escapeHtml(b.id)}" style="--group-color:${groupColor(b.group)}">
      <span class="search__art">${artMarkup(b)}</span>
      <span class="search__names">
        <span class="search__ko">${escapeHtml(b.name.ko)}</span>
        <span class="search__en" lang="en">${escapeHtml(b.name.en)}</span>
      </span>
      <span class="browse__country">${escapeHtml(countries[b.country].ko)}</span>
    </button>`;

  function render() {
    if (pop.hidden) return;
    const shown = (tab === 'favorites' ? active.filter((b) => favorites.has(b.id)) : active).slice().sort(byName);
    root.querySelector('[data-count]').textContent = `${shown.length}종`;
    root.querySelectorAll('[data-tab]').forEach((el) => el.setAttribute('aria-pressed', el.dataset.tab === tab));
    root.querySelectorAll('[data-sort]').forEach((el) => el.setAttribute('aria-pressed', el.dataset.sort === sort));

    if (!shown.length) {
      list.innerHTML = `<p class="browse__empty">${tab === 'favorites' ? '아직 즐겨찾기한 견종이 없습니다.' : '조건에 맞는 견종이 없습니다.'}</p>`;
    } else if (sort === 'country') {
      const groups = new Map();
      for (const b of shown) {
        if (!groups.has(b.country)) groups.set(b.country, []);
        groups.get(b.country).push(b);
      }
      list.innerHTML = [...groups]
        .sort(([a], [b]) => countries[a].ko.localeCompare(countries[b].ko, 'ko'))
        .map(([code, items]) => `<h3 class="browse__head">${escapeHtml(countries[code].ko)} <span>${items.length}</span></h3>${items.map(row).join('')}`)
        .join('');
    } else {
      list.innerHTML = shown.map(row).join('');
    }
  }

  function setOpen(open) {
    pop.hidden = !open;
    toggle.setAttribute('aria-expanded', open);
    render();
  }

  toggle.addEventListener('click', () => setOpen(pop.hidden));
  pop.addEventListener('click', (e) => {
    const tabEl = e.target.closest('[data-tab]');
    const sortEl = e.target.closest('[data-sort]');
    const item = e.target.closest('[data-id]');
    if (tabEl) {
      tab = tabEl.dataset.tab;
      list.scrollTop = 0;
      render();
    } else if (sortEl) {
      sort = sortEl.dataset.sort;
      list.scrollTop = 0;
      render();
    } else if (item) {
      onChoose(item.dataset.id);
      // 모바일은 시트가 화면을 차지하므로 목록을 닫는다
      if (matchMedia('(max-width: 720px)').matches) setOpen(false);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!root.contains(e.target) && !e.target.closest('#panel')) setOpen(false);
  });
  favorites.subscribe(render);

  return {
    setActive(breeds) {
      active = breeds;
      render();
    },
    isOpen: () => !pop.hidden,
    close() {
      setOpen(false);
      toggle.focus();
    },
  };
}
