// 즐겨찾기: 이 브라우저에만 저장한다. 저장소를 못 쓰면 새로고침 전까지만 기억한다.
const KEY = 'dog-map:favorites';

export function createFavorites() {
  const ids = new Set();
  const listeners = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) saved.forEach((id) => ids.add(id));
  } catch { /* 저장소를 쓸 수 없는 환경 */ }

  return {
    has: (id) => ids.has(id),
    toggle(id) {
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...ids]));
      } catch { /* 저장소를 쓸 수 없는 환경 */ }
      listeners.forEach((fn) => fn());
      return ids.has(id);
    },
    subscribe: (fn) => listeners.add(fn),
  };
}
