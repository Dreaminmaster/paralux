// ============================================================
//  PARALUX — Head-Coupled Off-Axis Projection
//  The screen IS the window. Projection shifts with your head.
// ============================================================

// ---- Config ----
var NEAR = 0.1;
var FAR = 100;
var EYE_Z = 6;           // viewer distance from screen
var SCREEN_W = 10;        // virtual screen width in world units
var SCREEN_H = 6;         // virtual screen height in world units
var HEAD_RANGE_X = 0.5;   // max head offset X mapped from input
var HEAD_RANGE_Y = 0.4;   // max head offset Y mapped from input
var SMOOTHING = 0.06;

// ---- State ----
var scene, camera, renderer;
var targetEyeX = 0, targetEyeY = 0;
var eyeX = 0, eyeY = 0;
var trackingMode = 'mouse';
var layers = [];
var time = 0;
var gridVisible = true;

// ---- Init ----
function init() {
  var canvas = document.getElementById('canvas3d');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x08080f);

  scene = new THREE.Scene();

  // Camera sits at z = EYE_Z, looking toward -z
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, NEAR, FAR);
  camera.position.set(0, 0, EYE_Z);

  // Fog for depth
  scene.fog = new THREE.FogExp2(0x08080f, 0.04);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(3, 5, 8);
  scene.add(dir);
  var point1 = new THREE.PointLight(0x4488ff, 0.8, 30);
  point1.position.set(-5, 3, 2);
  scene.add(point1);
  var point2 = new THREE.PointLight(0xcc66ff, 0.5, 25);
  point2.position.set(5, -2, 1);
  scene.add(point2);

  buildScene();

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('resize', onResize);

  setTimeout(function() {
    document.getElementById('loading').classList.add('done');
  }, 1000);

  animate();
}

// ---- Off-Axis Projection ----
// This is the core: the screen is a fixed window in world space.
// Moving the eye changes the frustum asymmetrically.
function updateProjection() {
  var aspect = window.innerWidth / window.innerHeight;
  SCREEN_H = SCREEN_W / aspect;

  // Eye position relative to screen center (in world units)
  var ex = eyeX * HEAD_RANGE_X * (SCREEN_W / 2);
  var ey = eyeY * HEAD_RANGE_Y * (SCREEN_H / 2);

  // Frustum boundaries at z=0 (the screen plane)
  // Shifted by eye position
  var hw = SCREEN_W / 2;
  var hh = SCREEN_H / 2;
  var d = EYE_Z; // distance from eye to screen

  var left   = -(hw + ex) * (NEAR / d);
  var right  =  (hw - ex) * (NEAR / d);
  var bottom = -(hh + ey) * (NEAR / d);
  var top    =  (hh - ey) * (NEAR / d);

  camera.projectionMatrix.makePerspective(left, right, top, bottom, NEAR, FAR);
}

// ---- Build 3D Scene ----
function buildScene() {
  // === Background grid plane (far) ===
  var gridTex = makeCanvasTex(2048, 2048, drawGrid);
  var gridMat = new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, opacity: 0.6 });
  var gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), gridMat);
  gridPlane.position.z = -15;
  scene.add(gridPlane);
  layers.push(gridPlane);

  // === Deep background glow ===
  var glowGeo = new THREE.PlaneGeometry(30, 20);
  var glowMat = new THREE.MeshBasicMaterial({
    map: makeCanvasTex(1024, 680, drawDeepGlow),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  var glowPlane = new THREE.Mesh(glowGeo, glowMat);
  glowPlane.position.z = -14;
  scene.add(glowPlane);

  // === Main hero card (mid depth) ===
  var heroTex = makeCanvasTex(1800, 1000, drawHeroCard);
  var heroPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5),
    new THREE.MeshBasicMaterial({ map: heroTex, transparent: true })
  );
  heroPlane.position.set(0, 0.3, -5);
  scene.add(heroPlane);

  // === Code snippet card (left, slightly forward) ===
  var codeTex = makeCanvasTex(900, 700, drawCodeCard);
  var codePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 3.5),
    new THREE.MeshBasicMaterial({ map: codeTex, transparent: true })
  );
  codePlane.position.set(-4.5, -0.5, -3);
  codePlane.rotation.y = 0.15;
  scene.add(codePlane);

  // === Profile card (right, forward) ===
  var profileTex = makeCanvasTex(800, 900, drawProfileCard);
  var profilePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4),
    new THREE.MeshBasicMaterial({ map: profileTex, transparent: true })
  );
  profilePlane.position.set(4.2, 0, -2.5);
  profilePlane.rotation.y = -0.12;
  scene.add(profilePlane);

  // === Stats bar (bottom, mid) ===
  var statsTex = makeCanvasTex(1600, 350, drawStatsBar);
  var statsPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.75),
    new THREE.MeshBasicMaterial({ map: statsTex, transparent: true })
  );
  statsPlane.position.set(0, -3.2, -6);
  scene.add(statsPlane);

  // === Floating tags (near) ===
  var tag1Tex = makeCanvasTex(600, 200, drawTag.bind(null, '⬤ LIVE', '#44ffaa'));
  var tag1 = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.8),
    new THREE.MeshBasicMaterial({ map: tag1Tex, transparent: true, depthWrite: false })
  );
  tag1.position.set(5, 2.5, -1.5);
  tag1.rotation.y = -0.2;
  scene.add(tag1);

  var tag2Tex = makeCanvasTex(700, 200, drawTag.bind(null, 'THREE.js r160', '#64c8ff'));
  var tag2 = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.8),
    new THREE.MeshBasicMaterial({ map: tag2Tex, transparent: true, depthWrite: false })
  );
  tag2.position.set(-5.5, 2.8, -1);
  tag2.rotation.y = 0.18;
  scene.add(tag2);

  // === 3D geometric objects ===
  // Wireframe icosahedron (far left)
  var icoGeo = new THREE.IcosahedronGeometry(1.2, 1);
  var icoMat = new THREE.MeshBasicMaterial({ color: 0x2244aa, wireframe: true, transparent: true, opacity: 0.4 });
  var ico = new THREE.Mesh(icoGeo, icoMat);
  ico.position.set(-7, 1, -10);
  scene.add(ico);
  layers.push({ mesh: ico, rotSpeed: 0.003 });

  // Wireframe torus (far right)
  var torusGeo = new THREE.TorusGeometry(0.8, 0.3, 12, 24);
  var torusMat = new THREE.MeshBasicMaterial({ color: 0x6633cc, wireframe: true, transparent: true, opacity: 0.35 });
  var torus = new THREE.Mesh(torusGeo, torusMat);
  torus.position.set(8, -1, -11);
  scene.add(torus);
  layers.push({ mesh: torus, rotSpeed: 0.005 });

  // Small octahedron (near right)
  var octGeo = new THREE.OctahedronGeometry(0.5, 0);
  var octMat = new THREE.MeshBasicMaterial({ color: 0x44ccff, wireframe: true, transparent: true, opacity: 0.5 });
  var oct = new THREE.Mesh(octGeo, octMat);
  oct.position.set(3, 2, -1);
  scene.add(oct);
  layers.push({ mesh: oct, rotSpeed: 0.008 });

  // === Particles ===
  buildParticles();
}

// ---- Particles ----
function buildParticles() {
  var count = 300;
  var geo = new THREE.BufferGeometry();
  var pos = new Float32Array(count * 3);
  var col = new Float32Array(count * 3);

  for (var i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 24;
    pos[i*3+1] = (Math.random() - 0.5) * 16;
    pos[i*3+2] = -Math.random() * 18 - 1;

    var c = new THREE.Color().setHSL(0.55 + Math.random() * 0.2, 0.5, 0.4 + Math.random() * 0.4);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  var mat = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geo, mat));
}

// ---- Canvas texture helpers ----
function makeCanvasTex(w, h, drawFn) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var ctx = c.getContext('2d');
  drawFn(ctx, w, h);
  var t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// ---- Drawing functions ----
function drawGrid(ctx, w, h) {
  // Dark gradient
  var g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w*0.6);
  g.addColorStop(0, '#111128');
  g.addColorStop(0.5, '#0a0a1a');
  g.addColorStop(1, '#050510');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Grid lines with perspective fade
  ctx.lineWidth = 1;
  var spacing = 80;
  for (var x = 0; x < w; x += spacing) {
    var dist = Math.abs(x - w/2) / (w/2);
    ctx.strokeStyle = 'rgba(80, 120, 255, ' + (0.08 - dist * 0.04) + ')';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (var y = 0; y < h; y += spacing) {
    var dist = Math.abs(y - h/2) / (h/2);
    ctx.strokeStyle = 'rgba(80, 120, 255, ' + (0.08 - dist * 0.04) + ')';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Glow spots
  [[w*0.25, h*0.3, 280, 'rgba(60,100,255,0.06)'],
   [w*0.75, h*0.65, 320, 'rgba(160,80,255,0.05)'],
   [w*0.5, h*0.15, 200, 'rgba(80,200,255,0.04)']
  ].forEach(function(s) {
    var grd = ctx.createRadialGradient(s[0],s[1],0, s[0],s[1],s[2]);
    grd.addColorStop(0, s[3]);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s[0],s[1],s[2],0,Math.PI*2); ctx.fill();
  });
}

function drawDeepGlow(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  var g = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, 400);
  g.addColorStop(0, 'rgba(40, 60, 120, 0.15)');
  g.addColorStop(0.5, 'rgba(20, 30, 80, 0.08)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);
}

function drawHeroCard(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  // Glass card background
  roundRect(ctx, 40, 40, w-80, h-80, 28);
  ctx.fillStyle = 'rgba(12, 14, 30, 0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner subtle glow
  var ig = ctx.createRadialGradient(w*0.3, h*0.3, 0, w*0.3, h*0.3, 400);
  ig.addColorStop(0, 'rgba(60,100,255,0.06)');
  ig.addColorStop(1, 'transparent');
  ctx.fillStyle = ig;
  ctx.fillRect(40, 40, w-80, h-80);

  // Title
  ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Hi, I\'m Michal', 100, 180);

  // Subtitle
  ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('Creative Developer & 3D Enthusiast', 100, 240);

  // Divider
  ctx.strokeStyle = 'rgba(100,180,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, 280);
  ctx.lineTo(500, 280);
  ctx.stroke();

  // Description text
  ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  var lines = [
    'I build interactive web experiences with',
    'Three.js, WebGL, and creative coding.',
    'This page uses head-coupled off-axis',
    'projection to create real depth perception.'
  ];
  lines.forEach(function(line, i) {
    ctx.fillText(line, 100, 330 + i * 40);
  });

  // CTA buttons
  roundRect(ctx, 100, 520, 200, 52, 26);
  ctx.fillStyle = 'rgba(100, 200, 255, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 22px -apple-system, sans-serif';
  ctx.fillStyle = '#64c8ff';
  ctx.fillText('View Work', 155, 552);

  roundRect(ctx, 330, 520, 200, 52, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Contact Me', 375, 552);

  // Side decorative code
  ctx.font = '18px monospace';
  ctx.fillStyle = 'rgba(100,200,255,0.1)';
  var sideCode = ['const eye = {', '  x: head.x,', '  y: head.y', '};', '', 'updateFrustum(', '  eye', ');'];
  sideCode.forEach(function(line, i) {
    ctx.fillText(line, w - 320, 120 + i * 28);
  });
}

function drawCodeCard(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  roundRect(ctx, 20, 20, w-40, h-40, 18);
  ctx.fillStyle = 'rgba(10, 12, 24, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Title bar dots
  var dotColors = ['#ff5f56', '#ffbd2e', '#27c93f'];
  dotColors.forEach(function(color, i) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(50 + i * 24, 52, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText('projection.js', 140, 57);

  // Code lines
  ctx.font = '18px monospace';
  var lines = [
    { t: 'function', c: '#c792ea' },
    { t: ' updateFrustum(eye) {', c: '#82aaff' },
    { t: '  var hw = screenW / 2;', c: '#c3e88d' },
    { t: '  var d  = eye.z;', c: '#c3e88d' },
    { t: '', c: '' },
    { t: '  left  = -(hw+eye.x)', c: '#f78c6c' },
    { t: '    * (near / d);', c: '#f78c6c' },
    { t: '  right = (hw-eye.x)', c: '#f78c6c' },
    { t: '    * (near / d);', c: '#f78c6c' },
    { t: '', c: '' },
    { t: '  projMatrix.makePerspective', c: '#82aaff' },
    { t: '    (left, right, top, bottom);', c: '#ffcb6b' },
    { t: '}', c: '#c792ea' },
  ];
  lines.forEach(function(line, i) {
    ctx.fillStyle = line.c || 'transparent';
    ctx.fillText(line.t, 45, 100 + i * 36);
  });
}

function drawProfileCard(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  roundRect(ctx, 20, 20, w-40, h-40, 18);
  ctx.fillStyle = 'rgba(12, 14, 28, 0.8)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Avatar circle
  var cx = w/2, cy = 180;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  var ag = ctx.createRadialGradient(cx-20, cy-20, 10, cx, cy, 70);
  ag.addColorStop(0, '#4488ff');
  ag.addColorStop(0.5, '#2244aa');
  ag.addColorStop(1, '#111133');
  ctx.fillStyle = ag;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,200,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Avatar letter
  ctx.font = 'bold 52px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('M', cx, cy + 18);

  // Name
  ctx.font = 'bold 28px -apple-system, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Michal Fojcik', cx, 300);

  // Role
  ctx.font = '18px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Creative Developer', cx, 335);

  // Stats
  var stats = [
    { v: '5+', l: 'Projects' },
    { v: '3D', l: 'Specialist' },
    { v: '∞', l: 'Curiosity' },
  ];
  stats.forEach(function(s, i) {
    var sx = 70 + i * (w - 140) / 3;
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.fillStyle = '#64c8ff';
    ctx.fillText(s.v, sx, 420);
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(s.l, sx, 445);
  });

  // Social icons placeholder
  ctx.font = '24px serif';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('𝕏  ◆  ▣', cx, 520);

  ctx.textAlign = 'left';
}

function drawStatsBar(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  roundRect(ctx, 10, 10, w-20, h-20, 14);
  ctx.fillStyle = 'rgba(10, 12, 24, 0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  var items = [
    { label: 'PROJECTION', value: 'OFF-AXIS', color: '#64c8ff' },
    { label: 'TRACKING', value: 'REALTIME', color: '#44ffaa' },
    { label: 'LAYERS', value: '5 DEPTH', color: '#c880ff' },
    { label: 'FPS', value: '60', color: '#ffaa44' },
  ];
  items.forEach(function(item, i) {
    var x = 80 + i * (w - 100) / 4;
    ctx.font = 'bold 30px -apple-system, sans-serif';
    ctx.fillStyle = item.color;
    ctx.fillText(item.value, x, h/2 + 8);
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(item.label, x, h/2 + 32);
  });
}

function drawTag(text, color, ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 10, 10, w-20, h-20, 30);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, w/2, h/2 + 7);
  ctx.textAlign = 'left';
}

// ---- Input ----
function onMouseMove(e) {
  if (trackingMode !== 'mouse') return;
  targetEyeX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetEyeY = -(e.clientY / window.innerHeight - 0.5) * 2;
}

function onTouchMove(e) {
  if (trackingMode !== 'mouse') return;
  var t = e.touches[0];
  targetEyeX = (t.clientX / window.innerWidth - 0.5) * 2;
  targetEyeY = -(t.clientY / window.innerHeight - 0.5) * 2;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---- Animation ----
function animate() {
  requestAnimationFrame(animate);

  // Smooth eye position
  eyeX += (targetEyeX - eyeX) * SMOOTHING;
  eyeY += (targetEyeY - eyeY) * SMOOTHING;

  // Update off-axis projection
  updateProjection();

  // Camera stays fixed at (0, 0, EYE_Z)
  camera.position.set(0, 0, EYE_Z);

  // Animate wireframe objects
  time += 0.01;
  layers.forEach(function(layer) {
    if (layer.rotSpeed) {
      layer.mesh.rotation.x += layer.rotSpeed;
      layer.mesh.rotation.y += layer.rotSpeed * 1.3;
    }
  });

  renderer.render(scene, camera);
}

// ---- Grid toggle ----
function toggleGrid() {
  gridVisible = !gridVisible;
  var btn = document.getElementById('btn-grid');
  if (gridVisible) {
    btn.classList.remove('active');
    if (layers[0]) layers[0].visible = true;
  } else {
    btn.classList.add('active');
    if (layers[0]) layers[0].visible = false;
  }
}

// ---- Camera tracking ----
function toggleCamera() {
  var btn = document.getElementById('btn-cam');
  var video = document.getElementById('video-feed');
  var pill = document.getElementById('mode-pill');

  if (trackingMode === 'camera') {
    trackingMode = 'mouse';
    btn.classList.remove('active');
    btn.textContent = '📷 Camera';
    video.style.display = 'none';
    pill.textContent = '🖱️ Mouse';
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(function(t) { t.stop(); });
      video.srcObject = null;
    }
    return;
  }

  btn.textContent = '⏳ Loading...';

  var script = document.createElement('script');
  script.type = 'module';
  script.textContent = [
    "import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';",
    "try {",
    "  const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');",
    "  const fl = await FaceLandmarker.createFromOptions(fs, {",
    "    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task', delegate: 'GPU' },",
    "    runningMode: 'VIDEO', numFaces: 1",
    "  });",
    "  window._fl = fl;",
    "  window._startCam();",
    "} catch(e) {",
    "  document.getElementById('btn-cam').textContent = '📷 Camera';",
    "  alert('MediaPipe failed: ' + e.message);",
    "}"
  ].join('\n');
  document.body.appendChild(script);
}

window._startCam = function() {
  var btn = document.getElementById('btn-cam');
  var video = document.getElementById('video-feed');
  var pill = document.getElementById('mode-pill');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } })
  .then(function(stream) {
    video.srcObject = stream;
    video.style.display = 'block';
    video.play();
    trackingMode = 'camera';
    btn.classList.add('active');
    btn.textContent = '🛑 Stop';
    pill.textContent = '📷 Camera';
    faceLoop(video);
  })
  .catch(function(err) {
    btn.textContent = '📷 Camera';
    alert('Camera failed: ' + err.message);
  });
};

function faceLoop(video) {
  if (trackingMode !== 'camera') return;
  if (!window._fl || video.readyState < 2) {
    requestAnimationFrame(function() { faceLoop(video); });
    return;
  }
  var r = window._fl.detectForVideo(video, performance.now());
  if (r.faceLandmarks && r.faceLandmarks.length > 0) {
    var nose = r.faceLandmarks[0][1];
    targetEyeX = -(nose.x - 0.5) * 3;
    targetEyeY = -(nose.y - 0.5) * 3;
  }
  requestAnimationFrame(function() { faceLoop(video); });
}

// ---- Global bindings ----
window.toggleCamera = toggleCamera;
window.toggleGrid = toggleGrid;

// ---- Start ----
init();
