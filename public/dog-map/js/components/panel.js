// 상세 패널: 데스크톱은 오른쪽 패널, 모바일은 드래그 가능한 아래쪽 시트.
import { loadDetails } from '../data/loader.js';
import { artMarkup, escapeHtml, groupColor } from './marker.js';

const MOBILE = '(max-width: 720px)';

const RELATED_MAX = 8;
const FCI_STATUS = { definitive: '정식 인정', provisional: '잠정 인정' };

export function createPanel(root, { breeds, breedsById, countries, taxonomy, favorites, onClose, onNavigate, onSheetChange, onShare }) {
  let requestId = 0;
  let current = null;
  let sheet = 'half';

  const sameCountry = (breed) => breeds
    .filter((b) => b.country === breed.country && b.id !== breed.id)
    .sort((a, b) => (b.group === breed.group) - (a.group === breed.group) || a.name.ko.localeCompare(b.name.ko, 'ko'));

  function syncFavorite() {
    const btn = root.querySelector('[data-favorite]');
    if (!btn || !current) return;
    const on = favorites.has(current.id);
    btn.setAttribute('aria-pressed', on);
    btn.lastElementChild.textContent = on ? '즐겨찾기됨' : '즐겨찾기';
  }

  /** 사진을 못 불러오면 그룹 실루엣을 그대로 둔다 */
  function showPhoto(data) {
    const art = root.querySelector('.panel__art');
    if (!data.photo || !art) return;
    const img = new Image();
    img.alt = '';
    img.className = 'panel__photo';
    img.addEventListener('load', () => {
      art.classList.add('has-photo');
      art.append(img);
      const credit = document.createElement('a');
      credit.className = 'panel__credit';
      credit.href = data.photo.page;
      credit.target = '_blank';
      credit.rel = 'noopener';
      credit.textContent = '사진: Wikimedia Commons · 저작자와 라이선스 보기';
      art.append(credit);
    });
    img.src = data.photo.src;
  }

  function fciFacts(fci) {
    if (!fci) return '';
    const group = fci.group ? `제${fci.group}그룹 · ` : '';
    return `<dl class="facts facts--registry">
      <dt>FCI 등록</dt><dd>제${fci.num}호 · ${group}${FCI_STATUS[fci.status]}</dd>
      <dt>FCI 원산국</dt><dd>${escapeHtml(fci.country)}</dd>
    </dl>`;
  }

  const isMobile = () => matchMedia(MOBILE).matches;

  function setSheet(state) {
    sheet = state;
    root.classList.toggle('is-half', state === 'half');
    root.style.setProperty('--sheet-y', state === 'half' ? '50%' : '0%');
    const grip = root.querySelector('.panel__grip');
    grip?.setAttribute('aria-label', state === 'half' ? '패널 크게 보기' : '패널 작게 보기');
    onSheetChange?.();
  }

  function renderDetails(breed, data) {
    const box = root.querySelector('[data-details]');
    const paragraphs = data.description.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    const sources = data.sources.length
      ? data.sources.map((s) => {
          const label = escapeHtml(s.label);
          return `<li>${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${label}</a>` : label}</li>`;
        }).join('')
      : '<li>등록된 출처가 없습니다.</li>';
    box.innerHTML = `
      <p class="panel__summary">${escapeHtml(data.summary)}</p>
      <div class="panel__desc">${paragraphs}</div>
      ${data.origin_note ? `<div class="note"><strong>기원 참고</strong>${escapeHtml(data.origin_note)}</div>` : ''}
      ${fciFacts(data.fci)}
      <h3>출처</h3>
      <ul class="sources">${sources}</ul>`;
    showPhoto(data);
  }

  function fetchDetails(breed) {
    const box = root.querySelector('[data-details]');
    const token = ++requestId;
    box.innerHTML = '<div class="skeleton" aria-label="설명을 불러오는 중"><i></i><i></i><i></i></div>';
    loadDetails(breed.id).then(
      (data) => { if (token === requestId) renderDetails(breed, data); },
      () => {
        if (token !== requestId) return;
        box.innerHTML = '<div class="panel__error"><p>설명을 불러오지 못했습니다.</p><button type="button" class="link-btn" data-retry>다시 시도</button></div>';
      },
    );
  }

  function render(breed) {
    const country = countries[breed.country];
    const group = taxonomy.groups[breed.group];
    const size = taxonomy.sizes[breed.size];
    const parents = breed.parents.map((id) => breedsById.get(id)).filter(Boolean);
    const related = sameCountry(breed);

    root.style.setProperty('--group-color', groupColor(breed.group));
    root.innerHTML = `
      <button type="button" class="panel__grip"></button>
      <button type="button" class="icon-btn panel__close" aria-label="패널 닫기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="panel__scroll">
        <div class="panel__art">${artMarkup(breed)}</div>
        <div class="panel__body">
          <h2 class="panel__title" tabindex="-1">${escapeHtml(breed.name.ko)}</h2>
          <p class="panel__en" lang="en">${escapeHtml(breed.name.en)}</p>
          <div class="panel__tags">
            ${breed.mix ? '<span class="tag tag--mix">믹스견</span>' : ''}
            ${breed.mix ? '' : `<span class="tag"><span class="chip__dot"></span>${escapeHtml(group.ko)}</span>`}
            <span class="tag">${escapeHtml(size.ko)}</span>
          </div>
          <div class="panel__actions">
            <button type="button" class="action-btn" data-favorite aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg><span>즐겨찾기</span></button>
            <button type="button" class="action-btn" data-share><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg><span>링크 복사</span></button>
          </div>
          <dl class="facts">
            <dt>출신지</dt><dd>${escapeHtml(breed.region)}</dd>
            ${breed.region === country.ko ? '' : `<dt>국가</dt><dd>${escapeHtml(country.ko)}</dd>`}
          </dl>
          ${parents.length ? `
            <div class="parents">
              <h3>부모 견종</h3>
              <div class="parents__list">
                ${parents.map((p) => `
                  <button type="button" class="parent-btn" data-parent="${escapeHtml(p.id)}" style="--group-color:${groupColor(p.group)}">
                    <span class="parent-btn__art">${artMarkup(p)}</span>${escapeHtml(p.name.ko)}
                  </button>`).join('')}
              </div>
            </div>` : ''}
          <div data-details></div>
          ${related.length ? `
            <div class="related">
              <h3>${escapeHtml(country.ko)}의 다른 견종 <span>${related.length}</span></h3>
              <div class="parents__list">
                ${related.slice(0, RELATED_MAX).map((b) => `
                  <button type="button" class="parent-btn" data-parent="${escapeHtml(b.id)}" style="--group-color:${groupColor(b.group)}">
                    <span class="parent-btn__art">${artMarkup(b)}</span>${escapeHtml(b.name.ko)}
                  </button>`).join('')}
              </div>
            </div>` : ''}
        </div>
      </div>`;
    fetchDetails(breed);
    syncFavorite();
  }

  favorites.subscribe(syncFavorite);

  root.addEventListener('click', (e) => {
    const parent = e.target.closest('[data-parent]');
    if (parent) onNavigate(parent.dataset.parent);
    else if (e.target.closest('[data-favorite]')) favorites.toggle(current.id);
    else if (e.target.closest('[data-share]')) onShare(current);
    else if (e.target.closest('.panel__close')) onClose();
    else if (e.target.closest('[data-retry]')) fetchDetails(current);
    else if (e.target.closest('.panel__grip') && !dragMoved) setSheet(sheet === 'half' ? 'full' : 'half');
  });

  // ─── 시트 드래그 ───
  let dragMoved = false;
  root.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.panel__grip');
    if (!grip || !isMobile()) return;
    const startY = e.clientY;
    const height = root.offsetHeight;
    const base = sheet === 'half' ? height / 2 : 0;
    let y = base;
    let lastY = startY;
    let lastT = e.timeStamp;
    let speed = 0;
    dragMoved = false;
    grip.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');

    const move = (ev) => {
      if (Math.abs(ev.clientY - startY) > 4) dragMoved = true;
      y = Math.max(0, base + ev.clientY - startY);
      speed = (ev.clientY - lastY) / Math.max(ev.timeStamp - lastT, 1);
      lastY = ev.clientY;
      lastT = ev.timeStamp;
      root.style.setProperty('--sheet-y', `${y}px`);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      root.classList.remove('is-dragging');
      if (!dragMoved) {
        setSheet(sheet);
        return;
      }
      const flung = y + speed * 180;
      if (flung > height * 0.72) onClose();
      else setSheet(flung < height * 0.25 ? 'full' : 'half');
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });

  return {
    open(breed, { focus = true } = {}) {
      const wasOpen = root.classList.contains('is-open');
      current = breed;
      render(breed);
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('panel-open');
      if (!wasOpen) setSheet('half');
      else setSheet(sheet);
      if (focus) root.querySelector('.panel__title').focus({ preventScroll: true });
    },
    close() {
      requestId++;
      current = null;
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('panel-open');
    },
    /** 지구본 중심을 옮길 때 쓰는, 패널이 가리는 영역 크기 */
    insets() {
      if (!current) return { right: 0, bottom: 0 };
      if (isMobile()) return { right: 0, bottom: innerHeight * 0.5 };
      return { right: root.offsetWidth, bottom: 0 };
    },
  };
}

