// 필터 팝오버: 그룹, 크기, 믹스견만 보기.
import { escapeHtml, groupColor } from './marker.js';

export function createFilters(root, { breeds, taxonomy, onChange }) {
  const state = { groups: new Set(), sizes: new Set(), mixOnly: false };
  const countBy = (key) => breeds.reduce((m, b) => m.set(b[key], (m.get(b[key]) ?? 0) + 1), new Map());
  const groupCounts = countBy('group');
  const sizeCounts = countBy('size');

  root.innerHTML = `
    <button type="button" class="icon-btn" aria-label="필터 열기" aria-expanded="false" aria-controls="filter-pop">
      <svg viewBox="0 0 24 24"><path d="M4 7h16M7 12h10M10 17h4"/></svg>
    </button>
    <div class="filters__pop" id="filter-pop" role="group" aria-label="견종 필터" hidden>
      <p class="filters__title">그룹</p>
      <div class="chips" data-chips="groups">
        ${Object.entries(taxonomy.groups).map(([key, g]) => {
          const n = groupCounts.get(key) ?? 0;
          return `<button type="button" class="chip" data-value="${key}" aria-pressed="false" ${n ? '' : 'disabled'} style="--group-color:${groupColor(key)}">
            <span class="chip__dot"></span>${escapeHtml(g.ko)}<span class="chip__n">${n}</span></button>`;
        }).join('')}
      </div>
      <p class="filters__title">크기</p>
      <div class="chips" data-chips="sizes">
        ${Object.entries(taxonomy.sizes).map(([key, s]) => `
          <button type="button" class="chip" data-value="${key}" aria-pressed="false">${escapeHtml(s.ko)}<span class="chip__n">${sizeCounts.get(key) ?? 0}</span></button>`).join('')}
      </div>
      <p class="filters__title">종류</p>
      <div class="chips">
        <button type="button" class="chip" data-mix aria-pressed="false">믹스견만 보기</button>
      </div>
      <div class="filters__foot">
        <span data-count></span>
        <button type="button" class="link-btn" data-reset>초기화</button>
      </div>
    </div>`;

  const toggle = root.querySelector('.icon-btn');
  const pop = root.querySelector('.filters__pop');
  const badge = document.createElement('span');
  badge.className = 'filters__badge';
  badge.hidden = true;
  toggle.append(badge);

  const matches = (b) =>
    (!state.groups.size || state.groups.has(b.group))
    && (!state.sizes.size || state.sizes.has(b.size))
    && (!state.mixOnly || b.mix);

  function apply() {
    const active = breeds.filter(matches);
    root.querySelector('[data-count]').textContent = `${breeds.length}종 중 ${active.length}종 표시`;
    const n = state.groups.size + state.sizes.size + (state.mixOnly ? 1 : 0);
    badge.hidden = !n;
    badge.textContent = n;
    toggle.setAttribute('aria-label', n ? `필터 열기, ${n}개 적용 중` : '필터 열기');
    root.querySelectorAll('[data-chips] .chip').forEach((chip) => {
      const set = state[chip.parentElement.dataset.chips];
      chip.setAttribute('aria-pressed', set.has(chip.dataset.value));
    });
    root.querySelector('[data-mix]').setAttribute('aria-pressed', state.mixOnly);
    onChange(active);
  }

  function setOpen(open) {
    pop.hidden = !open;
    toggle.setAttribute('aria-expanded', open);
  }

  toggle.addEventListener('click', () => setOpen(pop.hidden));
  pop.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip?.dataset.value) {
      const set = state[chip.parentElement.dataset.chips];
      if (set.has(chip.dataset.value)) set.delete(chip.dataset.value);
      else set.add(chip.dataset.value);
      apply();
    } else if (chip?.hasAttribute('data-mix')) {
      state.mixOnly = !state.mixOnly;
      apply();
    } else if (e.target.closest('[data-reset]')) {
      state.groups.clear();
      state.sizes.clear();
      state.mixOnly = false;
      apply();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!root.contains(e.target)) setOpen(false);
  });

  apply();
  return {
    isOpen: () => !pop.hidden,
    close() {
      setOpen(false);
      toggle.focus();
    },
  };
}

