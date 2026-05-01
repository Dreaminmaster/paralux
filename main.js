// ============================================================
//  Head-Tracked 3D Parallax — main.js
//  Three.js + Canvas-texture layers + mouse/MediaPipe parallax
// ============================================================

// ---- Config ----
var PARALLAX_STRENGTH = { x: 0.6, y: 0.35 };
var SMOOTHING = 0.08;
var LAYER_Z = [-4, -2, 0, 0.5, 1.0]; // far → near

// ---- State ----
var scene, camera, renderer;
var targetX = 0, targetY = 0;
var currentX = 0, currentY = 0;
var trackingMode = 'mouse'; // 'mouse' | 'camera'
var faceLandmarker = null;
var videoEl = null;
var layers = [];
var time = 0;

// ---- Init ----
function init() {
  var canvas = document.getElementById('canvas3d');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a0a1a);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6);

  var ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  var dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  buildLayers();
  buildParticles();

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('resize', onResize);

  // Hide loading after a short delay
  setTimeout(function() {
    document.getElementById('loading').classList.add('hide');
  }, 800);

  animate();
}

// ---- Build 3D texture from Canvas ----
function createCanvasTexture(width, height, drawFn) {
  var c = document.createElement('canvas');
  c.width = width; c.height = height;
  var ctx = c.getContext('2d');
  drawFn(ctx, width, height);
  var tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ---- Layer builders ----
function buildLayers() {
  // Layer 0 — Far background: gradient + grid
  var bgTex = createCanvasTexture(2048, 1200, function(ctx, w, h) {
    var grad = ctx.createRadialGradient(w/2, h/2, 100, w/2, h/2, 700);
    grad.addColorStop(0, '#1a1a3e');
    grad.addColorStop(0.5, '#0f0f2a');
    grad.addColorStop(1, '#060612');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(100, 140, 255, 0.06)';
    ctx.lineWidth = 1;
    var x, y;
    for (x = 0; x < w; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (y = 0; y < h; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    drawGlow(ctx, w * 0.2, h * 0.3, 200, 'rgba(80, 120, 255, 0.08)');
    drawGlow(ctx, w * 0.8, h * 0.7, 250, 'rgba(200, 100, 255, 0.06)');
    drawGlow(ctx, w * 0.5, h * 0.1, 180, 'rgba(100, 220, 255, 0.05)');
  });
  addLayer(bgTex, LAYER_Z[0], 18, 10.5);

  // Layer 1 — Mid-far: code glass panel
  var midBackTex = createCanvasTexture(1600, 900, function(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    drawGlassCard(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.8, 20, 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.08)');
    ctx.font = '28px monospace';
    ctx.fillStyle = 'rgba(100, 200, 255, 0.12)';
    var codeLines = [
      'const scene = new THREE.Scene();',
      'camera.position.set(0, 0, 6);',
      'renderer.render(scene, camera);',
      '// head-tracked parallax ✨',
      'faceLandmarker.detect(video);',
      'currentX += (targetX - currentX) * 0.08;',
    ];
    codeLines.forEach(function(line, i) {
      ctx.fillText(line, w * 0.14, h * 0.25 + i * 42);
    });
  });
  addLayer(midBackTex, LAYER_Z[1], 14, 8);

  // Layer 2 — Mid: main content card
  var mainTex = createCanvasTexture(1800, 1100, function(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);

    drawGlassCard(ctx, w * 0.05, h * 0.05, w * 0.9, h * 0.9, 24, 'rgba(20, 20, 50, 0.75)', 'rgba(255,255,255,0.12)');

    ctx.font = 'bold 64px -apple-system, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('3D Parallax Web', w * 0.1, h * 0.18);

    ctx.font = '24px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Head-Tracked Perspective Shift', w * 0.1, h * 0.24);

    // Decorative line
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.28);
    ctx.lineTo(w * 0.45, h * 0.28);
    ctx.stroke();

    // Feature cards
    var features = [
      { icon: '🎯', title: 'Face Tracking', desc: 'MediaPipe Face Landmarker' },
      { icon: '🌐', title: 'WebGL 3D', desc: 'Three.js multi-layer scene' },
      { icon: '✨', title: 'Parallax', desc: 'Off-axis projection' },
    ];
    features.forEach(function(f, i) {
      var cx = w * 0.1 + i * (w * 0.27);
      var cy = h * 0.35;
      drawGlassCard(ctx, cx, cy, w * 0.24, h * 0.26, 16, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.1)');
      ctx.font = '48px serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(f.icon, cx + 24, cy + 56);
      ctx.font = 'bold 28px -apple-system, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(f.title, cx + 24, cy + 105);
      ctx.font = '20px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(f.desc, cx + 24, cy + 140);
    });

    // Bottom stats
    var stats = [
      { label: 'Depth Layers', value: '5' },
      { label: 'Frame Rate', value: '60fps' },
      { label: 'Tracking', value: 'Realtime' },
    ];
    stats.forEach(function(s, i) {
      var sx = w * 0.1 + i * (w * 0.27);
      ctx.font = 'bold 36px -apple-system, sans-serif';
      ctx.fillStyle = '#64c8ff';
      ctx.fillText(s.value, sx, h * 0.78);
      ctx.font = '18px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(s.label, sx, h * 0.82);
    });
  });
  addLayer(mainTex, LAYER_Z[2], 14, 8.5);

  // Layer 3 — Near: floating accent cards
  var nearTex = createCanvasTexture(1400, 800, function(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);

    drawGlassCard(ctx, w * 0.55, h * 0.05, w * 0.38, h * 0.18, 14, 'rgba(100, 200, 255, 0.08)', 'rgba(100, 200, 255, 0.2)');
    ctx.font = '22px monospace';
    ctx.fillStyle = '#64c8ff';
    ctx.fillText('⬤ LIVE TRACKING', w * 0.6, h * 0.16);

    drawGlassCard(ctx, w * 0.05, h * 0.65, w * 0.35, h * 0.28, 14, 'rgba(200, 100, 255, 0.06)', 'rgba(200, 100, 255, 0.15)');
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.fillStyle = '#c880ff';
    ctx.fillText('Mouse / Camera', w * 0.1, h * 0.78);
    ctx.font = '18px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Drag to explore or', w * 0.1, h * 0.83);
    ctx.fillText('enable face tracking', w * 0.1, h * 0.88);
  });
  addLayer(nearTex, LAYER_Z[3], 12, 7);

  // Layer 4 — Nearest: decorative dots / light spots
  var decoTex = createCanvasTexture(1200, 700, function(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    var dots = [
      { x: 0.15, y: 0.2, r: 6, color: 'rgba(100,200,255,0.4)' },
      { x: 0.85, y: 0.15, r: 4, color: 'rgba(200,100,255,0.35)' },
      { x: 0.7, y: 0.8, r: 8, color: 'rgba(100,200,255,0.25)' },
      { x: 0.3, y: 0.7, r: 5, color: 'rgba(255,200,100,0.3)' },
      { x: 0.5, y: 0.5, r: 3, color: 'rgba(255,255,255,0.3)' },
      { x: 0.9, y: 0.5, r: 5, color: 'rgba(100,200,255,0.3)' },
      { x: 0.1, y: 0.9, r: 4, color: 'rgba(200,150,255,0.3)' },
    ];
    dots.forEach(function(d) {
      var grd = ctx.createRadialGradient(w*d.x, h*d.y, 0, w*d.x, h*d.y, d.r * 8);
      grd.addColorStop(0, d.color);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(w*d.x, h*d.y, d.r * 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(w*d.x, h*d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  addLayer(decoTex, LAYER_Z[4], 10, 5.8);
}

function addLayer(texture, z, w, h) {
  var geo = new THREE.PlaneGeometry(w, h);
  var mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = z;
  scene.add(mesh);
  layers.push({ mesh: mesh, baseZ: z });
}

// ---- Particles ----
function buildParticles() {
  var count = 200;
  var geo = new THREE.BufferGeometry();
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);

  for (var i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;

    var c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.6, 0.5 + Math.random() * 0.3);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  var mat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });
  var points = new THREE.Points(geo, mat);
  scene.add(points);
  layers.push({ mesh: points, isParticles: true });
}

// ---- Drawing helpers ----
function drawGlassCard(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGlow(ctx, x, y, radius, color) {
  var grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Input handlers ----
function onMouseMove(e) {
  if (trackingMode !== 'mouse') return;
  targetX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
}

function onTouchMove(e) {
  if (trackingMode !== 'mouse') return;
  var t = e.touches[0];
  targetX = (t.clientX / window.innerWidth - 0.5) * 2;
  targetY = -(t.clientY / window.innerHeight - 0.5) * 2;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---- Animation ----
function animate() {
  requestAnimationFrame(animate);

  currentX += (targetX - currentX) * SMOOTHING;
  currentY += (targetY - currentY) * SMOOTHING;

  camera.position.x = currentX * PARALLAX_STRENGTH.x;
  camera.position.y = currentY * PARALLAX_STRENGTH.y;
  camera.lookAt(0, 0, 0);

  // Subtle animation for particles
  time += 0.002;
  layers.forEach(function(layer) {
    if (layer.isParticles) {
      layer.mesh.rotation.y = time * 0.3;
      layer.mesh.rotation.x = time * 0.1;
    }
  });

  renderer.render(scene, camera);
}

// ---- Camera / MediaPipe ----
function toggleCamera() {
  var btn = document.getElementById('cam-btn');
  var video = document.getElementById('video-feed');
  var modeTag = document.getElementById('mode-tag');

  if (trackingMode === 'camera') {
    trackingMode = 'mouse';
    btn.classList.remove('active');
    btn.textContent = '📷 开启摄像头追踪';
    video.style.display = 'none';
    modeTag.textContent = '🖱️ 鼠标视差模式';
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(function(t) { t.stop(); });
      video.srcObject = null;
    }
    return;
  }

  btn.textContent = '⏳ 加载中...';

  // Load MediaPipe dynamically
  var script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      window._faceLandmarker = landmarker;
      window._startCameraTracking();
    } catch(e) {
      document.getElementById('cam-btn').textContent = '📷 开启摄像头追踪';
      alert('MediaPipe 加载失败: ' + e.message);
    }
  `;
  document.body.appendChild(script);
}

window._startCameraTracking = function() {
  var btn = document.getElementById('cam-btn');
  var video = document.getElementById('video-feed');
  var modeTag = document.getElementById('mode-tag');

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 320, height: 240 }
  }).then(function(stream) {
    video.srcObject = stream;
    video.style.display = 'block';
    video.play();
    trackingMode = 'camera';
    btn.classList.add('active');
    btn.textContent = '🛑 关闭摄像头追踪';
    modeTag.textContent = '📷 摄像头追踪模式';
    detectFaceLoop(video);
  }).catch(function(err) {
    btn.textContent = '📷 开启摄像头追踪';
    alert('摄像头启动失败: ' + err.message);
  });
};

function detectFaceLoop(video) {
  if (trackingMode !== 'camera') return;
  if (!window._faceLandmarker || video.readyState < 2) {
    requestAnimationFrame(function() { detectFaceLoop(video); });
    return;
  }

  var results = window._faceLandmarker.detectForVideo(video, performance.now());
  if (results.faceLandmarks && results.faceLandmarks.length > 0) {
    var nose = results.faceLandmarks[0][1]; // nose tip
    targetX = -(nose.x - 0.5) * 2.5;
    targetY = -(nose.y - 0.5) * 2.5;
  }

  requestAnimationFrame(function() { detectFaceLoop(video); });
}

// ---- Start ----
init();
