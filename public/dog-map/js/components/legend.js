// 그룹 색상 범례.
import { groupIcon } from './icons.js';
import { escapeHtml, groupColor } from './marker.js';

export function createLegend(root, { taxonomy }) {
  root.innerHTML = `
    <ul class="legend" id="legend-list" hidden>
      ${Object.entries(taxonomy.groups).map(([key, g]) => `
        <li style="--group-color:${groupColor(key)}">
          <span class="legend__art">${groupIcon(key)}</span>${escapeHtml(g.ko)}
        </li>`).join('')}
    </ul>
    <button type="button" class="legend-btn" aria-expanded="false" aria-controls="legend-list">범례</button>`;
  const btn = root.querySelector('button');
  const list = root.querySelector('ul');
  const setOpen = (open) => {
    list.hidden = !open;
    btn.setAttribute('aria-expanded', open);
  };
  btn.addEventListener('click', () => setOpen(list.hidden));
  return {
    isOpen: () => !list.hidden,
    close() {
      setOpen(false);
      btn.focus();
    },
  };
}

