// ─────────────────────────────────────────────────────────────
//  Camera View  —  p5.js + QRCode.js
//
//  邏輯很簡單：
//    不管哪台裝置開這個網頁，就顯示「那台裝置的鏡頭」
//    QR Code = 當前網址，掃了就在手機上開同一頁 → 顯示手機鏡頭
//    完全靜態，丟 GitHub Pages 就能用，零後端
// ─────────────────────────────────────────────────────────────

let capture;   // 裝置鏡頭
let pulseT = 0;
let camReady = false;

// ── Setup ──────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);

  // 取得當前裝置的鏡頭（電腦就電腦鏡頭，手機就手機鏡頭）
  capture = createCapture(VIDEO, () => {
    camReady = true;
  });
  capture.hide(); // 隱藏 DOM 元素，改在 canvas 上自行繪製

  // 建立分享按鈕
  const btn = document.createElement('button');
  btn.id = 'share-btn';
  btn.innerHTML = '🔗 在其他裝置開啟';
  btn.onclick = openModal;
  document.body.appendChild(btn);

  // Modal 關閉事件
  document.getElementById('close-modal').onclick = closeModal;
  document.getElementById('qr-modal').onclick = (e) => {
    if (e.target.id === 'qr-modal') closeModal();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// ── Draw ───────────────────────────────────────────────────────
function draw() {
  background('#297BB2');
  pulseT += 0.035;

  if (!camReady) {
    // 等待鏡頭啟動
    drawWaiting();
    return;
  }

  // ── 計算顯示區塊（畫布的 60%，維持鏡頭比例）──
  const BOX_W = width  * 0.60;
  const BOX_H = height * 0.60;
  const BOX_X = (width  - BOX_W) / 2;
  const BOX_Y = (height - BOX_H) / 2;

  const vw = capture.elt.videoWidth  || 640;
  const vh = capture.elt.videoHeight || 480;
  const { x, y, w, h } = fitKeepRatio(vw, vh, BOX_W, BOX_H, BOX_X, BOX_Y);

  // 外光暈
  drawGlow(x, y, w, h);

  // 鏡頭畫面（水平翻轉 = mirror 效果）
  push();
    translate(x + w, y);
    scale(-1, 1);
    image(capture, 0, 0, w, h);
  pop();

  // 細邊框
  noFill();
  stroke(255, 255, 255, 55);
  strokeWeight(1.5);
  rect(x, y, w, h, 3);

  // 底部狀態列
  drawStatusBar();
}

// ── 等待畫面 ───────────────────────────────────────────────────
function drawWaiting() {
  const r = 12 + 4 * sin(pulseT * 2);
  noStroke();
  fill(255, 255, 255, 80 + 40 * sin(pulseT * 2));
  ellipse(width / 2, height / 2 - 20, r, r);

  fill(255, 255, 255, 160);
  textAlign(CENTER, CENTER);
  textFont('DM Mono, monospace');
  textSize(14);
  text('鏡頭啟動中...', width / 2, height / 2 + 16);
}

// ── 光暈效果 ───────────────────────────────────────────────────
function drawGlow(x, y, w, h) {
  const a = 30 + 15 * sin(pulseT);
  noStroke();
  for (let i = 3; i >= 1; i--) {
    fill(255, 255, 255, a * (i / 3) * 0.25);
    const p = i * 7;
    rect(x - p, y - p, w + p * 2, h + p * 2, 4 + p);
  }
}

// ── 狀態列 ─────────────────────────────────────────────────────
function drawStatusBar() {
  noStroke();
  fill(0, 0, 0, 38);
  rect(0, height - 46, width, 46);

  fill(255, 255, 255, 75);
  textAlign(LEFT, CENTER);
  textFont('DM Mono, monospace');
  textSize(11);

  // 判斷是否為行動裝置
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  text(isMobile ? '📱 Mobile Camera' : '💻 Desktop Camera', 18, height - 23);

  fill(255, 255, 255, 140);
  textAlign(RIGHT, CENTER);
  textSize(12);
  text('🟢 Live', width - 18, height - 23);
}

// ── 保持比例填入盒子（letterbox）──────────────────────────────
function fitKeepRatio(srcW, srcH, boxW, boxH, offsetX, offsetY) {
  const srcR = srcW / srcH;
  const boxR = boxW / boxH;
  let w, h;
  if (srcR > boxR) { w = boxW; h = boxW / srcR; }
  else             { h = boxH; w = boxH * srcR;  }
  return {
    x: offsetX + (boxW - w) / 2,
    y: offsetY + (boxH - h) / 2,
    w, h
  };
}

// ── QR Code Modal ──────────────────────────────────────────────
function openModal() {
  const modal  = document.getElementById('qr-modal');
  const qrEl   = document.getElementById('qr-code');
  const urlEl  = document.getElementById('url-display');
  const url    = location.href;  // 就是當前網址，不需要附加任何參數

  urlEl.textContent = url;
  qrEl.innerHTML = '';

  new QRCode(qrEl, {
    text:         url,
    width:        184,
    height:       184,
    colorDark:    '#297BB2',
    colorLight:   '#f4f8fc',
    correctLevel: QRCode.CorrectLevel.M
  });

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('qr-modal').classList.add('hidden');
}

// ── 視窗縮放 ───────────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
