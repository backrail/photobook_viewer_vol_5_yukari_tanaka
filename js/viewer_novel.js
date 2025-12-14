document.addEventListener("DOMContentLoaded", init);

async function init() {

  let blockPageTurnClick = false;

  // ----------------------------------------------------
  // ① ページ画像の自動ロード
  // ----------------------------------------------------
  async function imageExists(url) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  const pages = [];
  let index = 1;
  while (true) {
    const url = `pages/${index}.jpg`;
    const exists = await imageExists(url);
    if (!exists) break;
    pages.push(url);
    index++;
  }

  if (pages.length === 0) return;

  // ----------------------------------------------------
  // ② 画面フィット（90%余白）
  // ----------------------------------------------------
  function calcBookSize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const baseRatio = 800 / 1200;

    let width = vw;
    let height = vw / baseRatio;

    if (height > vh) {
      height = vh;
      width = vh * baseRatio;
    }

    width *= 0.90;
    height *= 0.90;

    return { width, height };
  }

  const size = calcBookSize();
  const flipBookElement = document.getElementById("flip-book");

  const flip = new St.PageFlip(flipBookElement, {
    width: size.width,
    height: size.height,
    size: "stretch",
    maxShadowOpacity: 0.9,
    showCover: true,
    drawShadow: true,
    mobileScrollSupport: true,
    direction: "rtl"   // ★ 小説は右→左（和書）
  });

  flip.loadFromImages([...pages].reverse());
  // ★ 最後のページへ移動（右開きにするため）
  setTimeout(() => {
    flip.turnToPage(pages.length - 1);
  }, 50);


  window.addEventListener("resize", () => {
    const newSize = calcBookSize();
    flip.update(newSize.width, newSize.height);
  });


  // ----------------------------------------------------
  // ③ PC：右クリック無効＋メニュー表示
  // ----------------------------------------------------
  flipBookElement.addEventListener(
    "mousedown",
    (e) => {
      if (e.button === 2) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );

  flipBookElement.addEventListener(
    "click",
    (e) => {
      if (blockPageTurnClick) {
        blockPageTurnClick = false;
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      if (e.button === 2) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );

  flipBookElement.addEventListener(
    "contextmenu",
    (e) => e.preventDefault(),
    true
  );



  // ----------------------------------------------------
  // ④ 拡大オーバーレイ（contain）
  // ----------------------------------------------------
  if (!document.getElementById("zoom-overlay")) {

    const overlay = document.createElement("div");
    overlay.id = "zoom-overlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      padding: 16px;
    `;

    const stopProp = (e) => e.stopImmediatePropagation();

    overlay.addEventListener('mousedown', stopProp);
    overlay.addEventListener('touchstart', stopProp);
    overlay.addEventListener('click', stopProp);

    const img = document.createElement("img");
    img.id = "zoom-img";
    img.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      margin: auto;
    `;

    const closeBtn = document.createElement("div");
    closeBtn.innerText = "✕";
    closeBtn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      color: white;
      font-size: 32px;
      cursor: pointer;
    `;

    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    closeBtn.onclick = () => overlay.style.display = "none";

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = "none";
    };
  }



  // ----------------------------------------------------
  // ⑤ 拡大メニュー
  // ----------------------------------------------------
  const menu = document.createElement("div");
  menu.style.cssText = `
    position: fixed;
    display: none;
    background: rgba(30,30,30,0.96);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 9999;
    font-size: 16px;
    cursor: pointer;
  `;
  menu.innerText = "🔍 拡大して見る";
  document.body.appendChild(menu);



  // ----------------------------------------------------
  // ⑥ ★ RTL版：左右ページ判定は LTR の逆！
  // ----------------------------------------------------
  let lastPressEvent = null;

  function getClickedPageIndex(event) {
    const rect = flipBookElement.getBoundingClientRect();
    const clientX = (event.touches?.[0]?.clientX ?? event.clientX) - rect.left;

    const mid = rect.width / 2;

    const leftPage = flip.getCurrentPageIndex();       // RTLでも左ページは index
    const rightPage = leftPage + 1;

    // ★ RTL：左側タップ＝ 右ページ ／ 右側タップ＝ 左ページ
    return clientX < mid ? rightPage : leftPage;
  }



  // ----------------------------------------------------
  // ⑦ 拡大メニューから拡大
  // ----------------------------------------------------
  menu.onclick = () => {
    let pageFlipIndex = getClickedPageIndex(lastPressEvent);

    let realIndex = pageFlipIndex;

    if (flip.getCurrentPageIndex() === 0) {
      // 表紙は右側にある → realIndex = 0
      realIndex = 0;
    }

    if (realIndex < 0) realIndex = 0;

    document.getElementById("zoom-img").src = pages[realIndex];
    document.getElementById("zoom-overlay").style.display = "flex";
    menu.style.display = "none";
  };



  // ----------------------------------------------------
  // ⑧ PC右クリック
  // ----------------------------------------------------
  flipBookElement.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    const rect = flipBookElement.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const mid = rect.width / 2;

    // ★ RTL版：表紙は右側のみ有効
    if (flip.getCurrentPageIndex() === 0) {
      // 左側は空白
      if (clientX > mid) return;
    }

    lastPressEvent = e;
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.display = "block";
  });



  // ----------------------------------------------------
  // ⑨ スマホ：タップ／長押し（RTL版）
  // ----------------------------------------------------
  let touchStartTime = 0;
  let longPressTriggered = false;
  let pressTimer;

  flipBookElement.addEventListener("touchstart", (e) => {
    touchStartTime = Date.now();
    longPressTriggered = false;

    const rect = flipBookElement.getBoundingClientRect();
    const clientX = e.touches[0].clientX - rect.left;
    const mid = rect.width / 2;

    // ★ RTL版：表紙の有効範囲は右側
    if (flip.getCurrentPageIndex() === 0) {
      if (clientX > mid) return; // 右半分クリックは無効
    }

    pressTimer = setTimeout(() => {
      longPressTriggered = true;

      const t = e.touches[0];
      lastPressEvent = { clientX: t.clientX, clientY: t.clientY };

      menu.style.left = `${t.clientX}px`;
      menu.style.top = `${t.clientY}px`;
      menu.style.display = "block";
    }, 500);
  });

  flipBookElement.addEventListener("touchend", (e) => {
    clearTimeout(pressTimer);
    const elapsed = Date.now() - touchStartTime;

    if (longPressTriggered) {
      e.stopImmediatePropagation();
      e.preventDefault();
      blockPageTurnClick = true;
      return;
    }

    if (elapsed < 300) return;

    e.preventDefault();
    e.stopImmediatePropagation();
  });



  // ----------------------------------------------------
  // ⑩ メニュー外クリックで閉じる
  // ----------------------------------------------------
  document.addEventListener("click", (e) => {
    if (e.target !== menu) menu.style.display = "none";
  });

}
