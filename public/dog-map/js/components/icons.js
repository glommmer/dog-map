// 그룹별 임시 실루엣. 둥근 도형을 조합한 옆모습이며, 색은 currentColor로 입힌다.
const legs = (x, top, bottom, w) =>
  x.map((lx) => `<rect x="${lx}" y="${top}" width="${w}" height="${bottom - top}" rx="${w / 2}"/>`).join('');

function ear(type, hx, hy, r) {
  if (type === 'prick') {
    const b = hx - r * 0.75;
    return `<path d="M${b} ${hy - r * 0.45}L${b + r * 0.25} ${hy - r * 1.4}L${b + r * 1.05} ${hy - r * 0.75}Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`;
  }
  const len = type === 'long' ? r * 2.1 : r * 1.35;
  return `<rect x="${hx - r * 1.05}" y="${hy - r * 0.6}" width="${r * 0.95}" height="${len}" rx="${r * 0.47}" class="ear"/>`;
}

function dog({ body: [bx, by, bw, bh], legX, legW = 4.4, floor = 40, head: [hx, hy, hr], snout: [sw, sh], ear: earType, tail, extra = '' }) {
  return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}"/>`
    + legs(legX, by + bh / 2, floor, legW)
    + `<circle cx="${hx}" cy="${hy}" r="${hr}"/>`
    + `<rect x="${hx + hr * 0.2}" y="${hy - sh * 0.15}" width="${sw}" height="${sh}" rx="${sh / 2}"/>`
    + ear(earType, hx, hy, hr)
    + `<path d="${tail}" fill="none" stroke="currentColor" stroke-width="${tail.includes('!') ? 0 : 4}" stroke-linecap="round"/>`
    + extra;
}

const SHAPES = {
  sheepdog: dog({ body: [9, 21, 25, 11], legX: [11, 28], head: [33, 17, 6], snout: [8, 4.6], ear: 'prick', tail: 'M11 26C6 28 5 33 6 36' }),
  'pinscher-molosser': dog({ body: [8, 19, 26, 14], legX: [10, 28], legW: 5.4, head: [33, 17, 8], snout: [8, 7], ear: 'drop', tail: 'M10 23L5 19' }),
  terrier: dog({ body: [10, 20, 24, 12], legX: [12, 28], head: [34, 15, 6], snout: [8, 6.4], ear: 'prick', tail: 'M12 22L9 12', extra: '<rect x="35" y="19" width="6" height="6" rx="2.5"/>' }),
  dachshund: dog({ body: [5, 24, 33, 9], legX: [8, 31], legW: 4, floor: 38, head: [37, 20, 5.4], snout: [8, 4], ear: 'drop', tail: 'M7 27L2 23' }),
  spitz: dog({ body: [10, 20, 23, 13], legX: [12, 27], head: [33, 17, 7], snout: [7, 4.6], ear: 'prick', tail: 'M12 24C4 24 4 14 11 15C15 16 14 20 12 20' }),
  scenthound: dog({ body: [9, 21, 26, 11], legX: [11, 29], head: [34, 17, 5.8], snout: [8, 5], ear: 'long', tail: 'M11 24L6 13' }),
  pointer: dog({ body: [9, 20, 26, 10], legX: [11, 29], head: [34, 15, 5.4], snout: [9, 4.2], ear: 'drop', tail: 'M10 23L2 21', extra: '<path d="M31 28L37 29L39 34" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' }),
  retriever: dog({ body: [8, 20, 27, 12], legX: [10, 29], head: [34, 16, 6.4], snout: [8, 5.2], ear: 'drop', tail: 'M10 24C5 26 3 30 3 33', extra: '<path d="M6 30L3 36" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' }),
  companion: dog({ body: [12, 24, 19, 11], legX: [14, 26], legW: 4, floor: 39, head: [31, 18, 9], snout: [5, 5], ear: 'drop', tail: 'M14 27C8 26 8 20 13 21' }),
  sighthound: dog({ body: [10, 18, 24, 8], legX: [12, 28], legW: 3.2, floor: 42, head: [36, 12, 4.4], snout: [9, 3.2], ear: 'drop', tail: 'M11 21C6 25 5 31 8 35', extra: '<path d="M31 21L35 13" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M14 26C20 22 26 22 31 25L31 19L14 19Z"/>' }),
  mixed: dog({ body: [10, 21, 23, 12], legX: [12, 27], legW: 5, head: [33, 17, 7], snout: [7, 5], ear: 'drop', tail: 'M12 25C7 25 6 20 9 18', extra: '<circle cx="14" cy="20" r="4"/><circle cx="21" cy="19" r="4"/><circle cx="28" cy="20" r="4"/><circle cx="33" cy="10" r="3.6"/><circle cx="28" cy="12" r="3"/><circle cx="8" cy="17" r="3.4"/>' }),
};

export function groupIcon(group) {
  const shape = SHAPES[group] ?? SHAPES.mixed;
  return `<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">${shape}</svg>`;
}

