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

// Hybrid Camera additions
let mode = "0";      // 0: 原色鏡像, 1: 彩色方塊, 2: 灰階方塊, 3: 文字雲
let span = 15;       // 像素採樣間距
let noiseTexture;
let txt = "一二三四五田雷電龕龘";

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  textFont('serif');

  // 取得當前裝置的鏡頭（電腦就電腦鏡頭，手機就手機鏡頭）
  capture = createCapture(VIDEO, () => {
    camReady = true;
  });
  capture.size(640, 480); // 固定擷取解析度以維持效能
  capture.hide(); // 隱藏 DOM 元素，改在 canvas 上自行繪製

  // 產生雜訊材質
  noiseTexture = createGraphics(windowWidth, windowHeight);
  generateNoiseTexture();

  // 建立分享按鈕 + Modal 行為
  initInterface();

  // Modal 關閉事件（initInterface 也會設，但保留這裡以確保存在）
  const closeBtn = document.getElementById('close-modal');
  if (closeBtn) closeBtn.onclick = closeModal;
  const modalEl = document.getElementById('qr-modal');
  if (modalEl) {
    modalEl.onclick = (e) => {
      if (e.target.id === 'qr-modal') closeModal();
    };
  }

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

  // 自動根據螢幕大小計算顯示區塊
  const BOX_W = width  * 0.70;
  const BOX_H = height * 0.70;
  const BOX_X = (width  - BOX_W) / 2;
  const BOX_Y = (height - BOX_H) / 2;

  const vw = capture.elt.videoWidth  || 640;
  const vh = capture.elt.videoHeight || 480;
  const { x, y, w, h } = fitKeepRatio(vw, vh, BOX_W, BOX_H, BOX_X, BOX_Y);

  // 滑鼠 X 軸控制 span 大小
  span = int(map(mouseX, 0, width, 8, 40));

  // 外光暈
  drawGlow(x, y, w, h);

  // 核心渲染：鏡像或像素化處理
  if (mode === "0") {
    // 模式 0：原始鏡像 (原本程式)
    push();
      translate(x + w, y);
      scale(-1, 1);
      image(capture, 0, 0, w, h);
    pop();
  } else {
    // 模式 1/2/3：像素處理
    renderPixelArt(x, y, w, h);
  }

  // 疊加雜訊質感
  push();
    blendMode(MULTIPLY);
    image(noiseTexture, 0, 0, width, height);
  pop();

  // 細邊框與狀態列，以及模式提示
  drawUIElements(x, y, w, h);
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

// ── 像素處理核心 ──────────────────────────────────────────────
function renderPixelArt(targetX, targetY, targetW, targetH) {
  capture.loadPixels();
  if (!capture.pixels || capture.pixels.length === 0) return;

  // 計算縮放比例，將原本的攝像頭像素映射到畫布的目標區域
  let scaleX = targetW / capture.width;
  let scaleY = targetH / capture.height;

  for (let py = 0; py < capture.height; py += span) {
    for (let px = 0; px < capture.width; px += span) {

      // 鏡像讀取像素位置
      let mirroredX = capture.width - 1 - px;
      let index = (mirroredX + py * capture.width) * 4;

      let r = capture.pixels[index];
      let g = capture.pixels[index + 1];
      let b = capture.pixels[index + 2];
      let bk = (r + g + b) / 3;

      // 計算在畫布上的實際繪製位置
      let drawX = targetX + px * scaleX;
      let drawY = targetY + py * scaleY;
      let drawSpan = span * scaleX;

      push();
      translate(drawX, drawY);
      noStroke();

      if (mode === "1") {
        let s = map(bk, 0, 255, 0, drawSpan);
        fill(r, g, b);
        rect(0, 0, s);
      } else if (mode === "2") {
        let s = map(bk, 0, 255, 0, drawSpan);
        fill(bk);
        rect(0, 0, s * 0.9);
      } else if (mode === "3") {
        let bkId = int(map(bk, 0, 255, txt.length - 1, 0));
        fill(r, g, b);
        textSize(drawSpan);
        textAlign(LEFT, TOP);
        text(txt[bkId], 0, 0);
      }
      pop();
    }
  }
}

// ── 輔助功能 (整合自 Code 1 & 2) ──────────────────────────────
function generateNoiseTexture() {
  noiseTexture.loadPixels();
  for (let i = 0; i < noiseTexture.pixels.length; i += 4) {
    let v = random(255);
    noiseTexture.pixels[i] = v;
    noiseTexture.pixels[i + 1] = v;
    noiseTexture.pixels[i + 2] = v;
    noiseTexture.pixels[i + 3] = random(15, 45);
  }
  noiseTexture.updatePixels();
}

function keyPressed() {
  if (['0', '1', '2', '3'].includes(key)) {
    mode = key;
  }
}

function drawUIElements(x, y, w, h) {
  // 繪製細邊框
  noFill();
  stroke(255, 255, 255, 80);
  rect(x, y, w, h, 4);

  // 底部狀態列
  drawStatusBar();

  // 額外提示目前模式
  fill(255);
  textAlign(CENTER);
  textSize(14);
  text(`模式: ${mode} (按 0-3 切換) | 間距: ${span}px`, width/2, height - 70);
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

// ── QR Code Modal / 介面初始化 ─────────────────────────────────
function initInterface() {
  // 建立分享按鈕（如果已存在則不重複建立）
  if (!document.getElementById('share-btn')) {
    const btn = document.createElement('button');
    btn.id = 'share-btn';
    btn.innerHTML = '🔗 在其他裝置開啟';
    btn.onclick = openModal;
    document.body.appendChild(btn);
  }

  // 若 HTML 裡有 #close-modal 與 #qr-modal，綁定事件（若無則不會出錯）
  const closeEl = document.getElementById('close-modal');
  if (closeEl) closeEl.onclick = closeModal;

  const modal = document.getElementById('qr-modal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target.id === 'qr-modal') closeModal();
    };
  }
}

function openModal() {
  const modal  = document.getElementById('qr-modal');
  const qrEl   = document.getElementById('qr-code');
  const urlEl  = document.getElementById('url-display');
  const url    = location.href;  // 就是當前網址，不需要附加任何參數

  if (!modal || !qrEl || !urlEl) return;

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
  const modal = document.getElementById('qr-modal');
  if (modal) modal.classList.add('hidden');
}

// ── 視窗縮放 ───────────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新產生雜訊材質以符合新畫布大小
  noiseTexture = createGraphics(windowWidth, windowHeight);
  generateNoiseTexture();
}
