// 배경의 희미한 별가루. 처음과 창 크기가 바뀔 때만 그린다.
export function paintStars(canvas) {
  function paint() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth;
    const h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--star');

    // 창 크기가 바뀌어도 같은 무늬가 나오도록 고정 시드 난수를 쓴다
    let seed = 20261030;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const count = Math.round((w * h) / 9000);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = 0.08 + rand() * 0.4;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, 0.4 + rand() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  addEventListener('resize', paint);
  paint();
}

