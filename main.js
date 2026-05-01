// ============================================================
//  PARALUX v3 — True Head-Coupled 3D Window
//  Cards have THICKNESS, perspective is DRAMATIC, window frame anchors it.
// ============================================================

var NEAR = 0.1, FAR = 100;
var EYE_DIST = 5;         // eye-to-screen distance
var SCREEN_W = 8;          // virtual screen width
var SMOOTHING = 0.07;
var HEAD_RANGE = 2.0;      // DRAMATIC range — key to the effect!

var scene, camera, renderer;
var targetX = 0, targetY = 0;
var curX = 0, curY = 0;
var mode = 'mouse';
var animObjects = [];
var time = 0;

function init() {
  var canvas = document.getElementById('canvas3d');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x060610);
  renderer.shadowMap.enabled = true;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060610, 0.025);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, NEAR, FAR);
  camera.position.set(0, 0, EYE_DIST);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  var sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(5, 8, 10);
  sun.castShadow = true;
  scene.add(sun);
  var blu = new THREE.PointLight(0x4488ff, 1.2, 30);
  blu.position.set(-6, 3, -2);
  scene.add(blu);
  var pur = new THREE.PointLight(0xaa44ff, 0.8, 25);
  pur.position.set(6, -2, -3);
  scene.add(pur);

  buildScene();

  window.addEventListener('mousemove', function(e) {
    if (mode !== 'mouse') return;
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener('touchmove', function(e) {
    if (mode !== 'mouse') return;
    var t = e.touches[0];
    targetX = (t.clientX / window.innerWidth - 0.5) * 2;
    targetY = -(t.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  setTimeout(function() { document.getElementById('loading').classList.add('done'); }, 800);
  animate();
}

// ==== OFF-AXIS PROJECTION — the heart of it ====
function updateProjection() {
  var aspect = window.innerWidth / window.innerHeight;
  var screenH = SCREEN_W / aspect;

  // Eye offset in world units
  var ex = curX * HEAD_RANGE;
  var ey = curY * HEAD_RANGE * 0.6;

  // Frustum at z=0 (the "glass"), shifted by eye position
  var hw = SCREEN_W / 2;
  var hh = screenH / 2;
  var d = EYE_DIST;

  var l = -(hw + ex) * (NEAR / d);
  var r =  (hw - ex) * (NEAR / d);
  var b = -(hh + ey) * (NEAR / d);
  var t =  (hh - ey) * (NEAR / d);

  camera.projectionMatrix.makePerspective(l, r, t, b, NEAR, FAR);
}

// ==== BUILD 3D SCENE ====
function buildScene() {
  // ===== WINDOW FRAME at z≈0 — the anchor =====
  var frameMat = new THREE.LineBasicMaterial({ color: 0x223355, transparent: true, opacity: 0.6 });
  var fw = 8.5, fh = 5.5, fd = 0.08;
  // Outer frame
  var frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(fw, fh, fd));
  var frame = new THREE.LineSegments(frameGeo, frameMat);
  frame.position.z = 0.2;
  scene.add(frame);
  // Inner glow edge
  var frameMat2 = new THREE.LineBasicMaterial({ color: 0x3366aa, transparent: true, opacity: 0.25 });
  var frame2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(fw-0.3, fh-0.3, fd)), frameMat2);
  frame2.position.z = 0.21;
  scene.add(frame2);

  // ===== FLOOR grid at the bottom =====
  var floorGeo = new THREE.PlaneGeometry(50, 50, 50, 50);
  var floorMat = new THREE.MeshBasicMaterial({ color: 0x112244, wireframe: true, transparent: true, opacity: 0.12 });
  var floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.5;
  floor.position.z = -10;
  scene.add(floor);

  // ===== BACKGROUND — far glow wall =====
  var bgTex = makeCanvasTex(2048, 1024, drawBg);
  var bg = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: bgTex }));
  bg.position.z = -20;
  scene.add(bg);

  // ===== HERO CARD — thick box, medium depth =====
  addCard({
    w: 5.5, h: 3.2, d: 0.12,
    x: 0, y: 0.2, z: -4,
    rx: 0, ry: 0, rz: 0,
    draw: drawHero,
    emissive: 0x001122,
  });

  // ===== CODE CARD — left, rotated, closer =====
  addCard({
    w: 3.8, h: 3, d: 0.1,
    x: -3.8, y: -0.3, z: -2.5,
    rx: 0, ry: 0.25, rz: 0,
    draw: drawCode,
    emissive: 0x110022,
  });

  // ===== PROFILE CARD — right, closer =====
  addCard({
    w: 2.8, h: 3.5, d: 0.1,
    x: 3.8, y: 0, z: -2,
    rx: 0, ry: -0.2, rz: 0,
    draw: drawProfile,
    emissive: 0x001111,
  });

  // ===== STATS PANEL — bottom, far =====
  addCard({
    w: 6, h: 1.2, d: 0.06,
    x: 0, y: -2.8, z: -7,
    rx: 0.08, ry: 0, rz: 0,
    draw: drawStats,
    emissive: 0x000811,
  });

  // ===== FLOATING TAGS — very near =====
  addCard({
    w: 1.8, h: 0.5, d: 0.04,
    x: 4.5, y: 2, z: -0.8,
    rx: 0, ry: -0.3, rz: 0,
    draw: drawTagLive,
    emissive: 0x002211,
  });
  addCard({
    w: 2, h: 0.5, d: 0.04,
    x: -4.8, y: 2.2, z: -0.5,
    rx: 0, ry: 0.25, rz: 0,
    draw: drawTagThree,
    emissive: 0x001122,
  });

  // ===== 3D WIREFRAME SHAPES =====
  // Big icosahedron far left
  var ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: 0x2244aa, wireframe: true, transparent: true, opacity: 0.3 })
  );
  ico.position.set(-8, 1, -12);
  scene.add(ico);
  animObjects.push({ mesh: ico, rs: 0.003 });

  // Torus far right
  var torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.4, 16, 32),
    new THREE.MeshBasicMaterial({ color: 0x6633cc, wireframe: true, transparent: true, opacity: 0.25 })
  );
  torus.position.set(9, -1.5, -14);
  scene.add(torus);
  animObjects.push({ mesh: torus, rs: 0.004 });

  // Octahedron near left
  var oct = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.6, 0),
    new THREE.MeshBasicMaterial({ color: 0x44ccff, wireframe: true, transparent: true, opacity: 0.45 })
  );
  oct.position.set(-2, 2.2, -1);
  scene.add(oct);
  animObjects.push({ mesh: oct, rs: 0.01 });

  // Small dodecahedron near right
  var dodec = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.4, 0),
    new THREE.MeshBasicMaterial({ color: 0xff6644, wireframe: true, transparent: true, opacity: 0.4 })
  );
  dodec.position.set(2.5, -1.8, -0.5);
  scene.add(dodec);
  animObjects.push({ mesh: dodec, rs: 0.012 });

  // ===== VERTICAL LIGHT PILLARS =====
  var pillarGeo = new THREE.PlaneGeometry(0.03, 12);
  [[-4, 0, -8, 'rgba(68,136,255,0.15)'],
   [4, 0, -10, 'rgba(170,68,255,0.1)'],
   [0, 0, -6, 'rgba(255,255,255,0.05)']
  ].forEach(function(p) {
    var tex = makeCanvasTex(32, 512, function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'transparent');
      g.addColorStop(0.3, p[3]);
      g.addColorStop(0.7, p[3]);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    var m = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(p[0], p[1], p[2]);
    scene.add(m);
  });

  // ===== PARTICLES =====
  buildParticles();
}

// ==== ADD A CARD (thick box with face texture + glowing edges) ====
function addCard(cfg) {
  var tex = makeCanvasTex(Math.round(cfg.w * 300), Math.round(cfg.h * 300), cfg.draw);

  // Front face
  var frontMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.8,
    metalness: 0.1,
    emissive: new THREE.Color(cfg.emissive || 0x000000),
    emissiveIntensity: 0.3,
  });
  var front = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), frontMat);
  front.castShadow = true;

  // Back face (dark)
  var backMat = new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.9 });
  var back = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), backMat);
  back.position.z = -cfg.d;

  // Edges (the key 3D cue!)
  var edgeMat = new THREE.LineBasicMaterial({ color: 0x3366aa, transparent: true, opacity: 0.35 });
  var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d)), edgeMat);

  // Group
  var group = new THREE.Group();
  group.add(front);
  group.add(back);
  group.add(edges);
  group.position.set(cfg.x, cfg.y, cfg.z);
  group.rotation.set(cfg.rx || 0, cfg.ry || 0, cfg.rz || 0);
  scene.add(group);
}

// ==== PARTICLES ====
function buildParticles() {
  var n = 400;
  var geo = new THREE.BufferGeometry();
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    pos[i*3]   = (Math.random()-0.5) * 30;
    pos[i*3+1] = (Math.random()-0.5) * 20;
    pos[i*3+2] = -Math.random() * 25 - 0.5;
    var c = new THREE.Color().setHSL(0.55 + Math.random()*0.2, 0.5, 0.3 + Math.random()*0.5);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.5, sizeAttenuation: true, depthWrite: false
  })));
}

// ==== CANVAS HELPERS ====
function makeCanvasTex(w, h, fn) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  var t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ==== DRAWING FUNCTIONS ====
function drawBg(ctx, w, h) {
  var g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w*0.5);
  g.addColorStop(0, '#0f1025');
  g.addColorStop(1, '#060610');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  ctx.strokeStyle = 'rgba(60,100,200,0.04)';
  ctx.lineWidth = 1;
  for (var x = 0; x < w; x += 100) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (var y = 0; y < h; y += 100) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

  [[w*0.2, h*0.4, 300, 'rgba(40,80,200,0.06)'], [w*0.8, h*0.6, 350, 'rgba(120,40,200,0.05)']].forEach(function(s) {
    var grd = ctx.createRadialGradient(s[0],s[1],0, s[0],s[1],s[2]);
    grd.addColorStop(0, s[3]); grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s[0],s[1],s[2],0,Math.PI*2); ctx.fill();
  });
}

function drawHero(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 30, 30, w-60, h-60, 22);
  ctx.fillStyle = 'rgba(10,12,28,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 56px -apple-system, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText("Hi, I'm Michal", 70, 140);

  ctx.font = '24px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Creative Developer & 3D Enthusiast', 70, 185);

  ctx.strokeStyle = 'rgba(80,160,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(70, 210); ctx.lineTo(380, 210); ctx.stroke();

  ctx.font = '20px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ['I build interactive web experiences with','Three.js, WebGL, and creative coding.','This page uses off-axis projection to','create real depth perception.'].forEach(function(l, i) {
    ctx.fillText(l, 70, 255 + i * 34);
  });

  rr(ctx, 70, 410, 160, 44, 22);
  ctx.fillStyle = 'rgba(80,160,255,0.12)'; ctx.fill();
  ctx.strokeStyle = 'rgba(80,160,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = 'bold 18px -apple-system, sans-serif'; ctx.fillStyle = '#5599ff';
  ctx.fillText('View Work', 110, 438);

  rr(ctx, 260, 410, 160, 44, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Contact Me', 295, 438);

  ctx.font = '16px monospace';
  ctx.fillStyle = 'rgba(80,160,255,0.08)';
  ['const eye = {','  x: head.x,','  y: head.y','};','updateFrustum(eye);'].forEach(function(l, i) {
    ctx.fillText(l, w - 250, 80 + i * 24);
  });
}

function drawCode(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 15, 15, w-30, h-30, 14);
  ctx.fillStyle = 'rgba(8,10,22,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();

  ['#ff5f56','#ffbd2e','#27c93f'].forEach(function(c, i) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(38 + i*20, 40, 5, 0, Math.PI*2); ctx.fill();
  });
  ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText('projection.js', 110, 44);

  ctx.font = '15px monospace';
  var lines = [
    ['function ', '#c792ea'], ['updateFrustum(eye) {', '#82aaff'],
    ['  var hw = screenW/2;', '#c3e88d'],
    ['  var d  = eye.z;', '#c3e88d'],
    ['', ''],
    ['  left  = -(hw+eye.x)', '#f78c6c'], ['    * (near/d);', '#f78c6c'],
    ['  right = (hw-eye.x)', '#f78c6c'], ['    * (near/d);', '#f78c6c'],
    ['', ''],
    ['  projMatrix.', '#82aaff'], ['makePerspective', '#ffcb6b'],
    ['    (left, right,', '#ffcb6b'], ['     top, bottom);', '#ffcb6b'],
    ['}', '#c792ea'],
  ];
  lines.forEach(function(l, i) {
    ctx.fillStyle = l[1]; ctx.fillText(l[0], 35, 85 + i * 28);
  });
}

function drawProfile(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 15, 15, w-30, h-30, 14);
  ctx.fillStyle = 'rgba(10,12,26,0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();

  var cx = w/2, cy = 140;
  ctx.beginPath(); ctx.arc(cx, cy, 55, 0, Math.PI*2);
  var ag = ctx.createRadialGradient(cx-15, cy-15, 5, cx, cy, 55);
  ag.addColorStop(0, '#4488ff'); ag.addColorStop(0.6, '#2244aa'); ag.addColorStop(1, '#0a0a33');
  ctx.fillStyle = ag; ctx.fill();
  ctx.strokeStyle = 'rgba(80,160,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = 'bold 40px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'center';
  ctx.fillText('M', cx, cy + 14);

  ctx.font = 'bold 22px -apple-system, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText('Michal F.', cx, 235);
  ctx.font = '14px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Creative Dev', cx, 260);

  [{v:'5+',l:'Projects'},{v:'3D',l:'Spec.'},{v:'∞',l:'Curious'}].forEach(function(s, i) {
    var sx = 50 + i*((w-100)/3);
    ctx.font = 'bold 20px -apple-system, sans-serif'; ctx.fillStyle = '#5599ff';
    ctx.fillText(s.v, sx, 330);
    ctx.font = '12px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(s.l, sx, 350);
  });
  ctx.textAlign = 'left';
}

function drawStats(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 8, 8, w-16, h-16, 10);
  ctx.fillStyle = 'rgba(8,10,22,0.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();

  [{l:'PROJECTION',v:'OFF-AXIS',c:'#5599ff'},{l:'TRACKING',v:'REALTIME',c:'#44ddaa'},
   {l:'DEPTH',v:'5 LAYERS',c:'#bb77ff'},{l:'FPS',v:'60',c:'#ffaa44'}
  ].forEach(function(s, i) {
    var x = 60 + i * ((w-80)/4);
    ctx.font = 'bold 24px -apple-system, sans-serif'; ctx.fillStyle = s.c;
    ctx.fillText(s.v, x, h/2 + 5);
    ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(s.l, x, h/2 + 24);
  });
}

function drawTagLive(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 6, 6, w-12, h-12, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  ctx.strokeStyle = '#44ddaa'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#44ddaa';
  ctx.textAlign = 'center'; ctx.fillText('⬤ LIVE', w/2, h/2+6); ctx.textAlign = 'left';
}

function drawTagThree(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 6, 6, w-12, h-12, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  ctx.strokeStyle = '#5599ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#5599ff';
  ctx.textAlign = 'center'; ctx.fillText('THREE.js r160', w/2, h/2+5); ctx.textAlign = 'left';
}

// ==== ANIMATION LOOP ====
function animate() {
  requestAnimationFrame(animate);

  curX += (targetX - curX) * SMOOTHING;
  curY += (targetY - curY) * SMOOTHING;

  updateProjection();

  camera.position.set(0, 0, EYE_DIST);

  time += 0.01;
  animObjects.forEach(function(o) {
    o.mesh.rotation.x += o.rs;
    o.mesh.rotation.y += o.rs * 1.3;
  });

  renderer.render(scene, camera);
}

// ==== CAMERA TRACKING ====
function toggleCamera() {
  var btn = document.getElementById('btn-cam');
  var video = document.getElementById('video-feed');
  var pill = document.getElementById('mode-pill');

  if (mode === 'camera') {
    mode = 'mouse';
    btn.classList.remove('active'); btn.textContent = '📷 Camera';
    video.style.display = 'none'; pill.textContent = '🖱️ Mouse';
    if (video.srcObject) { video.srcObject.getTracks().forEach(function(t){t.stop();}); video.srcObject = null; }
    return;
  }

  btn.textContent = '⏳ Loading...';
  var s = document.createElement('script'); s.type = 'module';
  s.textContent = "import {FaceLandmarker,FilesetResolver} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';" +
    "try{" +
    "const fs=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');" +
    "const fl=await FaceLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numFaces:1});" +
    "window._fl=fl;window._startCam();" +
    "}catch(e){document.getElementById('btn-cam').textContent='📷 Camera';alert('MediaPipe: '+e.message);}";
  document.body.appendChild(s);
}

window._startCam = function() {
  var btn = document.getElementById('btn-cam');
  var video = document.getElementById('video-feed');
  var pill = document.getElementById('mode-pill');
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:320,height:240}})
  .then(function(stream) {
    video.srcObject = stream; video.style.display = 'block'; video.play();
    mode = 'camera'; btn.classList.add('active'); btn.textContent = '🛑 Stop'; pill.textContent = '📷 Camera';
    (function loop() {
      if (mode !== 'camera') return;
      if (window._fl && video.readyState >= 2) {
        var r = window._fl.detectForVideo(video, performance.now());
        if (r.faceLandmarks && r.faceLandmarks.length) {
          var n = r.faceLandmarks[0][1];
          targetX = -(n.x - 0.5) * 3;
          targetY = -(n.y - 0.5) * 3;
        }
      }
      requestAnimationFrame(loop);
    })();
  })
  .catch(function(e) { btn.textContent = '📷 Camera'; alert('Camera: '+e.message); });
};

function toggleGrid() {}

window.toggleCamera = toggleCamera;
window.toggleGrid = toggleGrid;

init();
