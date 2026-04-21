// ─────────────────────────────────────────────────────────────
//  Camera View  —  p5.js + QRCode.js
//
//  邏輯很簡單：
//    不管哪台裝置開這個網頁，就顯示「那台裝置的鏡頭」
//    QR Code = 當前網址，掃了就在手機上開同一頁 → 顯示手機鏡頭
//    完全靜態，丟 GitHub Pages 就能用，零後端
// ─────────────────────────────────────────────────────────────

let capture;   // 裝置鏡頭 或 fallback 影片
let pulseT = 0;
let camReady = false;

// Hybrid Camera additions
let mode = "0";      // 0: 原色鏡像, 1: 彩色方塊, 2: 灰階馬賽克(20x20), 3: 文字雲
let span = 15;       // 像素採樣間距（模式1/3 使用）
let noiseTexture;
let txt = "一二三四五田雷電龕龘";

let bubbles = [];
const BUBBLE_COUNT = 24;
let lastBox = null; // 儲存目前畫面中鏡頭盒位置，給 snapshot 與按鈕定位用

async function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  textFont('serif');

  // 先偵測是否有可用的攝影機裝置，若沒有就載入 fallback 影片檔
  const hasCamera = await checkHasCamera();

  if (hasCamera) {
    capture = createCapture(VIDEO, () => { camReady = true; });
    capture.size(640, 480);
    capture.hide();
  } else {
    // fallback 影片 - 使用正確的路徑與播放邏輯
    capture = createVideo('14204294_1920_1080_25fps.mp4');
    capture.size(640, 480);
    capture.hide();
    
    // 延遲確保影片已加載
    capture.onended(() => capture.play()); // 循環播放
    
    // 等待影片可以播放後設定 camReady
    capture.elt.oncanplay = () => {
      if (!camReady) {
        capture.elt.play().catch(err => console.log('自動播放被阻擋:', err));
        camReady = true;
      }
    };
    
    // 主動觸發播放
    setTimeout(() => {
      try {
        capture.play();
      } catch (e) {
        console.log('播放失敗:', e);
      }
    }, 500);
  }

  // 產生雜訊材質
  noiseTexture = createGraphics(windowWidth, windowHeight);
  generateNoiseTexture();

  // 建立分享按鈕 + Modal 行為 + snapshot 按鈕
  initInterface();

  // 產生泡泡
  generateBubbles();

  // Modal 關閉事件
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

async function checkHasCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(d => d.kind === 'videoinput');
  } catch (e) {
    return false;
  }
}

// ── Draw ───────────────────────────────────────────────────────
function draw() {
  background('#297BB2');
  pulseT += 0.035;

  if (!camReady) {
    drawWaiting();
    return;
  }

  // 確保影片持續播放
  if (capture.elt && capture.elt.paused) {
    try {
      capture.play();
    } catch (e) {
      // 靜默處理
    }
  }

  // 自動根據螢幕大小計算顯示區塊
  const BOX_W = width  * 0.70;
  const BOX_H = height * 0.70;
  const BOX_X = (width  - BOX_W) / 2;
  const BOX_Y = (height - BOX_H) / 2;

  const vw = capture.elt && capture.elt.videoWidth  ? capture.elt.videoWidth  : 640;
  const vh = capture.elt && capture.elt.videoHeight ? capture.elt.videoHeight : 480;
  const { x, y, w, h } = fitKeepRatio(vw, vh, BOX_W, BOX_H, BOX_X, BOX_Y);

  // 儲存給按鈕與 snapshot 使用（取整數）
  lastBox = { x: int(x), y: int(y), w: int(w), h: int(h) };

  // 將 snapshot 按鈕定位在畫面外（右側）
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn && lastBox) {
    saveBtn.style.position = 'absolute';
    saveBtn.style.left = (lastBox.x + lastBox.w + 12) + 'px';
    saveBtn.style.top  = (lastBox.y) + 'px';
    saveBtn.style.zIndex = 9999;
  }

  // 滑鼠 X 軸控制 span 大小（影響某些模式）
  span = int(map(mouseX, 0, width, 8, 40));

  // 外光暈
  drawGlow(x, y, w, h);

  // 核心渲染：鏡像或像素化處理
  if (mode === "0") {
    // 模式 0：原始鏡像
    push();
      translate(x + w, y);
      scale(-1, 1);
      image(capture, 0, 0, w, h);
    pop();
  } else {
    // 模式 1/2/3：像素處理（mode 2 為 20x20 馬賽克灰階）
    renderPixelArt(x, y, w, h);
  }

  // 鏡頭框內的泡泡效果（疊在畫面上）
  drawBubbles(x, y, w, h);

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

// ── 泡泡效果 ───────────────────────────────────────────────────
function generateBubbles() {
  bubbles = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    bubbles.push({
      x: random(0, 1),       // relative 0..1 inside box
      y: random(0, 1),       // relative 0..1 inside box
      r: random(6, 28),
      vy: random(0.2, 1.2),
      alpha: random(30, 100),
      wobble: random(0.2, 1.2),
      wobbleOffset: random(TWO_PI)
    });
  }
}

function drawBubbles(boxX, boxY, boxW, boxH) {
  push();
  noStroke();
  
  for (let b of bubbles) {
    // update position
    b.y -= b.vy * 0.01; // 簡化更新速度
    b.x += sin(pulseT * b.wobble + b.wobbleOffset) * 0.003; // 改進搖晃邏輯

    // wrap around - 重新出現在上方
    if (b.y < -0.2) {
      b.y = 1.2;
      b.x = random(0, 1);
      b.r = random(6, 28);
      b.vy = random(0.2, 1.2);
      b.alpha = random(30, 100);
      b.wobbleOffset = random(TWO_PI);
    }

    // constrain x 在框內
    b.x = constrain(b.x, -0.1, 1.1);

    // draw bubble
    const px = boxX + b.x * boxW;
    const py = boxY + b.y * boxH;
    
    fill(255, 255, 255, b.alpha);
    ellipse(px, py, b.r, b.r);
  }
  pop();
}

// ── 像素處理核心 ──────────────────────────────────────────────
function renderPixelArt(targetX, targetY, targetW, targetH) {
  capture.loadPixels();
  if (!capture.pixels || capture.pixels.length === 0) return;

  // 若為模式 2，採用 20x20 的馬賽克灰階（依顯示區域切分）
  if (mode === "2") {
    const COLS = 20;
    const ROWS = 20;
    const cellW_src = capture.width / COLS;
    const cellH_src = capture.height / ROWS;
    const cellW_draw = targetW / COLS;
    const cellH_draw = targetH / ROWS;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // 計算該 cell 在 source 視訊像素上的範圍（整數）
        const sx = floor(col * cellW_src);
        const sy = floor(row * cellH_src);
        const sw = max(1, floor(cellW_src));
        const sh = max(1, floor(cellH_src));

        // 累計該區域的顏色
        let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
        for (let yy = sy; yy < min(sy + sh, capture.height); yy++) {
          for (let xx = sx; xx < min(sx + sw, capture.width); xx++) {
            const idx = (xx + yy * capture.width) * 4;
            rSum += capture.pixels[idx];
            gSum += capture.pixels[idx + 1];
            bSum += capture.pixels[idx + 2];
            cnt++;
          }
        }
        if (cnt === 0) cnt = 1;
        const rAvg = rSum / cnt;
        const gAvg = gSum / cnt;
        const bAvg = bSum / cnt;
        const gray = (rAvg + gAvg + bAvg) / 3;

        // 計算繪製位置（鏡像效果與原先畫面一致 → 保持 horizontal mirror）
        const drawX = targetX + (COLS - 1 - col) * cellW_draw;
        const drawY = targetY + row * cellH_draw;

        noStroke();
        fill(gray);
        rect(drawX, drawY, cellW_draw + 1, cellH_draw + 1); // +1 防止間隙
      }
    }
    return;
  }

  // 其餘模式維持原本像素化邏輯（mode 1 與 3）
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

  // 建立 snapshot 按鈕（在視訊框外）
  if (!document.getElementById('save-btn')) {
    const sb = document.createElement('button');
    sb.id = 'save-btn';
    sb.innerHTML = '📸 儲存鏡頭截圖';
    sb.onclick = captureSnapshot;
    document.body.appendChild(sb);
  }

  // 建立模式切換按鈕容器
  if (!document.getElementById('mode-buttons')) {
    const container = document.createElement('div');
    container.id = 'mode-buttons';
    container.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.4);
      padding: 10px;
      border-radius: 8px;
      backdrop-filter: blur(10px);
    `;

    const modes = [
      { id: '0', label: '🪞 原色鏡像', desc: 'Mirror' },
      { id: '1', label: '🟨 彩色方塊', desc: 'Color' },
      { id: '2', label: '⬛ 灰階馬賽克', desc: 'Mosaic' },
      { id: '3', label: '✍️ 文字雲', desc: 'Text' }
    ];

    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.id = `mode-btn-${m.id}`;
      btn.innerHTML = m.label;
      btn.title = m.desc;
      btn.style.cssText = `
        padding: 10px 14px;
        border: 2px solid #fff;
        background: rgba(41, 123, 178, 0.6);
        color: #fff;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        transition: all 0.3s ease;
        white-space: nowrap;
      `;
      btn.onmouseover = () => {
        btn.style.background = 'rgba(41, 123, 178, 0.9)';
        btn.style.transform = 'scale(1.05)';
      };
      btn.onmouseout = () => {
        if (mode !== m.id) {
          btn.style.background = 'rgba(41, 123, 178, 0.6)';
        }
        btn.style.transform = 'scale(1)';
      };
      btn.onclick = () => switchMode(m.id, container);
      container.appendChild(btn);
    });

    document.body.appendChild(container);
    updateModeButtons(container);
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

// 切換模式函數
function switchMode(newMode, container) {
  mode = newMode;
  updateModeButtons(container);
}

// 更新按鈕外觀
function updateModeButtons(container) {
  const modes = ['0', '1', '2', '3'];
  modes.forEach(m => {
    const btn = document.getElementById(`mode-btn-${m}`);
    if (btn) {
      if (mode === m) {
        btn.style.background = 'rgba(255, 215, 0, 0.8)';
        btn.style.borderColor = '#FFD700';
        btn.style.transform = 'scale(1.1)';
      } else {
        btn.style.background = 'rgba(41, 123, 178, 0.6)';
        btn.style.borderColor = '#fff';
        btn.style.transform = 'scale(1)';
      }
    }
  });
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

// ── Snapshot / 儲存截圖 ─────────────────────────────────────────
function captureSnapshot() {
  if (!lastBox) return;
  // 使用 get() 從 canvas 擷取目前鏡頭框的影像，並存為 JPG
  const img = get(lastBox.x, lastBox.y, lastBox.w, lastBox.h);
  if (img) save(img, 'snapshot.jpg');
}

// ── 視窗縮放 ───────────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新產生雜訊材質以符合新畫布大小
  noiseTexture = createGraphics(windowWidth, windowHeight);
  generateNoiseTexture();
  generateBubbles();
}
