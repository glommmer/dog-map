// 검색 상자: 한글·영어 부분 일치, 키보드 탐색을 지원하는 콤보박스.
import { artMarkup, escapeHtml, groupColor } from './marker.js';

const MAX_RESULTS = 8;
const normalize = (s) => s.normalize('NFC').toLowerCase().replace(/[\s\-·]+/g, '');

export function createSearch(root, { breeds, countries, onChoose }) {
  const indexed = breeds.map((b) => ({
    breed: b,
    ko: normalize(b.name.ko),
    en: normalize(b.name.en),
    place: normalize(`${countries[b.country].ko} ${countries[b.country].en} ${b.region}`),
  }));

  root.innerHTML = `
    <svg class="search__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
    <input class="search__input" type="search" placeholder="견종·나라 검색" autocomplete="off" spellcheck="false"
           role="combobox" aria-label="견종 이름이나 나라 검색" aria-expanded="false" aria-controls="search-list" aria-autocomplete="list">
    <ul class="search__list" id="search-list" role="listbox" aria-label="검색 결과" hidden></ul>`;
  const input = root.querySelector('input');
  const list = root.querySelector('ul');

  let results = [];
  let active = -1;

  function find(query) {
    const q = normalize(query);
    if (!q) return [];
    const score = ({ ko, en, place }) => {
      if (ko.startsWith(q) || en.startsWith(q)) return 0;
      if (ko.includes(q) || en.includes(q)) return 1;
      if (place.includes(q)) return 2;
      return -1;
    };
    return indexed
      .map((row) => ({ row, s: score(row) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => a.s - b.s || a.row.ko.localeCompare(b.row.ko, 'ko'))
      .slice(0, MAX_RESULTS)
      .map((r) => r.row.breed);
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function setActive(i) {
    active = i;
    list.querySelectorAll('[role=option]').forEach((el, idx) => {
      el.setAttribute('aria-selected', idx === i);
      if (idx === i) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function render() {
    results = find(input.value);
    if (!input.value.trim()) {
      close();
      return;
    }
    list.innerHTML = results.length
      ? results.map((b, i) => `
        <li class="search__item" role="option" id="search-opt-${i}" data-i="${i}" aria-selected="false" style="--group-color:${groupColor(b.group)}">
          <span class="search__art">${artMarkup(b)}</span>
          <span class="search__names">
            <span class="search__ko">${escapeHtml(b.name.ko)}</span>
            <span class="search__en" lang="en">${escapeHtml(b.name.en)}</span>
          </span>
          <span class="browse__country">${escapeHtml(countries[b.country].ko)}</span>
        </li>`).join('')
      : '<li class="search__empty">일치하는 견종이 없습니다.</li>';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
    if (results.length) setActive(0);
  }

  function choose(i) {
    const breed = results[i];
    if (!breed) return;
    input.value = '';
    close();
    onChoose(breed);
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('keydown', (e) => {
    // 한글 조합 중의 Enter는 글자 확정에 쓰인다
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setActive((active + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setActive((active - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape' && !list.hidden) {
      e.stopPropagation();
      close();
    }
  });
  // 입력창 포커스를 잃기 전에 선택되도록 pointerdown을 쓴다
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) {
      e.preventDefault();
      choose(Number(li.dataset.i));
    }
  });
  input.addEventListener('blur', close);
}

