// ============================================================
//  PARALUX v4 — Camera Movement + Room + Realistic Content
//  Forget off-axis projection. Move the camera. Wide FOV. Big range.
//  The secret: a ROOM gives spatial reference, and BIG camera movement
//  makes parallax undeniable.
// ============================================================

var FOV = 75;
var NEAR = 0.1, FAR = 100;
var CAM_RANGE_X = 3.5;
var CAM_RANGE_Y = 2.5;
var LOOK_Z = -5;
var SMOOTHING = 0.06;

var scene, camera, renderer;
var targetX = 0, targetY = 0;
var curX = 0, curY = 0;
var mode = 'mouse';
var anims = [];
var time = 0;

function init() {
  var canvas = document.getElementById('canvas3d');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x050508);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050508, 0.018);

  camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, NEAR, FAR);
  camera.position.set(0, 0, 0);

  // === Lighting ===
  scene.add(new THREE.AmbientLight(0x8888cc, 0.25));

  var mainLight = new THREE.SpotLight(0xffffff, 2.5, 50, Math.PI/4, 0.5, 1);
  mainLight.position.set(0, 8, 2);
  mainLight.target.position.set(0, 0, -5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  scene.add(mainLight);
  scene.add(mainLight.target);

  var blueLight = new THREE.PointLight(0x4488ff, 3, 30);
  blueLight.position.set(-5, 3, -3);
  scene.add(blueLight);

  var purpleLight = new THREE.PointLight(0xaa44ff, 2, 25);
  purpleLight.position.set(5, -1, -4);
  scene.add(purpleLight);

  var warmLight = new THREE.PointLight(0xff8844, 1, 20);
  warmLight.position.set(0, -3, -6);
  scene.add(warmLight);

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
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  setTimeout(function() { document.getElementById('loading').classList.add('done'); }, 800);
  animate();
}

function buildScene() {
  // ==========================================
  //  ROOM — gives spatial reference
  // ==========================================

  // Back wall
  var wallTex = makeCanvasTex(2048, 1200, drawBackWall);
  var backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 18),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0 })
  );
  backWall.position.set(0, 2, -18);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Floor
  var floorTex = makeCanvasTex(2048, 2048, drawFloor);
  var floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.1 });
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3;
  floor.position.z = -8;
  floor.receiveShadow = true;
  scene.add(floor);

  // ==========================================
  //  MAIN SCREEN — the hero content, deep
  // ==========================================
  var screenTex = makeCanvasTex(1920, 1080, drawMainScreen);
  var screen = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6.75),
    new THREE.MeshStandardMaterial({ map: screenTex, roughness: 0.3, metalness: 0.05, emissive: 0x111122, emissiveIntensity: 0.15 })
  );
  screen.position.set(0, 1.5, -12);
  screen.castShadow = true;
  screen.receiveShadow = true;
  scene.add(screen);

  // Screen bezel (thin box around it)
  var bezelMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.5, metalness: 0.3 });
  var bezelT = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.12, 0.2), bezelMat);
  bezelT.position.set(0, 4.9, -12);
  scene.add(bezelT);
  var bezelB = bezelT.clone(); bezelB.position.y = -1.9; scene.add(bezelB);
  var bezelL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 7, 0.2), bezelMat);
  bezelL.position.set(-6.2, 1.5, -12); scene.add(bezelL);
  var bezelR = bezelL.clone(); bezelR.position.x = 6.2; scene.add(bezelR);

  // Screen glow
  var glowMat = new THREE.MeshBasicMaterial({ color: 0x3366aa, transparent: true, opacity: 0.06 });
  var glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 7.5), glowMat);
  glow.position.set(0, 1.5, -11.9);
  scene.add(glow);

  // ==========================================
  //  FLOATING CARDS — at various depths
  // ==========================================

  // Code card — left, mid depth
  var codeTex = makeCanvasTex(900, 700, drawCodeCard);
  addFloatingCard(codeTex, -5, 2, -6, 3.5, 2.7, 0.2, 0.15, 0x110022);

  // Profile card — right, closer
  var profileTex = makeCanvasTex(700, 900, drawProfileCard);
  addFloatingCard(profileTex, 5.5, 1, -4, 2.5, 3.2, -0.15, -0.12, 0x001111);

  // Stats card — bottom center, far
  var statsTex = makeCanvasTex(1400, 300, drawStatsCard);
  addFloatingCard(statsTex, 0, -1.5, -9, 6, 1.3, 0.1, 0, 0x000811);

  // Tag cards — very near
  var tag1Tex = makeCanvasTex(500, 160, drawTagLive);
  addFloatingCard(tag1Tex, 3, 3.5, -1.5, 2, 0.6, 0, -0.2, 0x002211);

  var tag2Tex = makeCanvasTex(550, 160, drawTagThree);
  addFloatingCard(tag2Tex, -4, 3.8, -1, 2.2, 0.6, 0, 0.18, 0x001122);

  // ==========================================
  //  3D OBJECTS — wireframe geometries
  // ==========================================

  // Big icosahedron — far left
  var ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.8, 1),
    new THREE.MeshBasicMaterial({ color: 0x2244aa, wireframe: true, transparent: true, opacity: 0.25 })
  );
  ico.position.set(-9, 3, -14);
  scene.add(ico);
  anims.push({ mesh: ico, rs: 0.003 });

  // Torus — far right
  var torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.5, 16, 32),
    new THREE.MeshBasicMaterial({ color: 0x6633cc, wireframe: true, transparent: true, opacity: 0.2 })
  );
  torus.position.set(10, -1, -15);
  scene.add(torus);
  anims.push({ mesh: torus, rs: 0.004 });

  // Octahedron — near left
  var oct = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.MeshBasicMaterial({ color: 0x44ccff, wireframe: true, transparent: true, opacity: 0.4 })
  );
  oct.position.set(-2, 3.5, -0.5);
  scene.add(oct);
  anims.push({ mesh: oct, rs: 0.01 });

  // Dodecahedron — near right
  var dodec = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.5, 0),
    new THREE.MeshBasicMaterial({ color: 0xff6644, wireframe: true, transparent: true, opacity: 0.35 })
  );
  dodec.position.set(2.5, -2, 0);
  scene.add(dodec);
  anims.push({ mesh: dodec, rs: 0.012 });

  // ==========================================
  //  PARTICLES
  // ==========================================
  buildParticles(500);
}

function addFloatingCard(tex, x, y, z, w, h, ry, rz, emissive) {
  var mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.6, metalness: 0.05,
    emissive: new THREE.Color(emissive || 0x000000),
    emissiveIntensity: 0.4,
  });
  var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry || 0;
  mesh.rotation.z = rz || 0;
  mesh.castShadow = true;
  scene.add(mesh);

  // Edge glow
  var edgeMat = new THREE.LineBasicMaterial({ color: 0x3366aa, transparent: true, opacity: 0.2 });
  var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, 0.05)), edgeMat);
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  scene.add(edges);
}

function buildParticles(n) {
  var geo = new THREE.BufferGeometry();
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    pos[i*3]   = (Math.random()-0.5) * 25;
    pos[i*3+1] = (Math.random()-0.5) * 18 - 1;
    pos[i*3+2] = -Math.random() * 22;
    var c = new THREE.Color().setHSL(0.55 + Math.random()*0.2, 0.5, 0.3 + Math.random()*0.5);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0.45, sizeAttenuation: true, depthWrite: false
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
function drawBackWall(ctx, w, h) {
  // Dark gradient wall
  var g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a0a18');
  g.addColorStop(0.5, '#080810');
  g.addColorStop(1, '#060610');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(60, 100, 200, 0.03)';
  ctx.lineWidth = 1;
  for (var x = 0; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (var y = 0; y < h; y += 80) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

  // Ambient glow spots
  [[w*0.15, h*0.3, 400, 'rgba(40,80,200,0.04)'],
   [w*0.85, h*0.6, 350, 'rgba(120,40,200,0.03)'],
   [w*0.5, h*0.1, 300, 'rgba(60,160,255,0.03)']
  ].forEach(function(s) {
    var grd = ctx.createRadialGradient(s[0],s[1],0, s[0],s[1],s[2]);
    grd.addColorStop(0, s[3]); grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s[0],s[1],s[2],0,Math.PI*2); ctx.fill();
  });
}

function drawFloor(ctx, w, h) {
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, w, h);

  // Reflective grid
  ctx.strokeStyle = 'rgba(80, 120, 255, 0.05)';
  ctx.lineWidth = 1;
  for (var x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (var y = 0; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

  // Center glow
  var g = ctx.createRadialGradient(w/2, h*0.3, 0, w/2, h*0.3, 500);
  g.addColorStop(0, 'rgba(60,100,255,0.06)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawMainScreen(ctx, w, h) {
  // This is the HERO — a full webpage-like content
  ctx.clearRect(0, 0, w, h);

  // Background
  rr(ctx, 0, 0, w, h, 0);
  ctx.fillStyle = '#0c0e1c';
  ctx.fill();

  // Top nav bar
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(0, 0, w, 70);
  ctx.font = 'bold 28px -apple-system, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('fojcik.com', 60, 46);
  ctx.font = '20px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ['Work', 'About', 'Blog', 'Contact'].forEach(function(item, i) {
    ctx.fillText(item, w - 400 + i * 100, 46);
  });

  // Hero section
  var hy = 140;
  ctx.font = 'bold 72px -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText("Hi, I'm Michal", 80, hy + 60);

  ctx.font = '28px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Creative Developer building interactive 3D web experiences', 80, hy + 110);

  // Divider
  ctx.strokeStyle = 'rgba(80,160,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, hy + 140); ctx.lineTo(600, hy + 140); ctx.stroke();

  // About text
  ctx.font = '22px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ['I specialize in Three.js, WebGL, and creative coding.', 'This page uses head-coupled perspective — move your', 'mouse (or enable camera) to see the 3D depth effect.'].forEach(function(line, i) {
    ctx.fillText(line, 80, hy + 185 + i * 36);
  });

  // CTA Buttons
  rr(ctx, 80, hy + 330, 200, 54, 27);
  ctx.fillStyle = 'rgba(80,160,255,0.12)'; ctx.fill();
  ctx.strokeStyle = 'rgba(80,160,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = 'bold 22px -apple-system, sans-serif'; ctx.fillStyle = '#5599ff';
  ctx.fillText('View Projects', 120, hy + 363);

  rr(ctx, 310, hy + 330, 200, 54, 27);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Get in Touch', 350, hy + 363);

  // Project cards section
  var py = hy + 460;
  ctx.font = 'bold 32px -apple-system, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Featured Work', 80, py);

  // Project card 1
  rr(ctx, 80, py + 30, 500, 200, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = 'bold 24px -apple-system, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText('3D Portfolio', 110, py + 80);
  ctx.font = '18px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('Interactive WebGL experience with', 110, py + 115);
  ctx.fillText('head-tracked parallax effect', 110, py + 140);
  ctx.font = '16px monospace'; ctx.fillStyle = '#44ddaa';
  ctx.fillText('Three.js · MediaPipe · WebGL', 110, py + 180);

  // Project card 2
  rr(ctx, 610, py + 30, 500, 200, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = 'bold 24px -apple-system, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText('Creative Experiments', 640, py + 80);
  ctx.font = '18px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('Generative art and interactive', 640, py + 115);
  ctx.fillText('visualizations built for the web', 640, py + 140);
  ctx.font = '16px monospace'; ctx.fillStyle = '#bb77ff';
  ctx.fillText('GLSL · Canvas · SVG · D3', 640, py + 180);

  // Right side — decorative code snippet
  ctx.font = '17px monospace';
  ctx.fillStyle = 'rgba(80,160,255,0.08)';
  var codeLines = [
    '// off-axis projection',
    'var l = -(hw + ex) * (near/d);',
    'var r =  (hw - ex) * (near/d);',
    '',
    'camera.projectionMatrix',
    '  .makePerspective(',
    '    l, r, t, b, near, far',
    '  );',
  ];
  codeLines.forEach(function(line, i) {
    ctx.fillText(line, w - 450, 200 + i * 26);
  });

  // Bottom — tech stack icons placeholder
  ctx.font = '16px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillText('Built with Three.js · MediaPipe · WebGL · Canvas', 80, h - 40);
}

function drawCodeCard(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  rr(ctx, 15, 15, w-30, h-30, 14);
  ctx.fillStyle = 'rgba(8,10,22,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();

  ['#ff5f56','#ffbd2e','#27c93f'].forEach(function(c, i) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(40 + i*22, 44, 5, 0, Math.PI*2); ctx.fill();
  });
  ctx.font = '14px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText('frustum.js', 120, 48);

  ctx.font = '16px monospace';
  [
    ['function ', '#c792ea'], ['shiftPerspective(eye) {', '#82aaff'],
    ['  // screen is a fixed window', '#546e7a'],
    ['  var hw = screenW / 2;', '#c3e88d'],
    ['  var d  = eyeDistance;', '#c3e88d'],
    ['', ''],
    ['  // asymmetric frustum', '#546e7a'],
    ['  left  = -(hw + eye.x)', '#f78c6c'],
    ['    * (near / d);', '#f78c6c'],
    ['  right =  (hw - eye.x)', '#f78c6c'],
    ['    * (near / d);', '#f78c6c'],
    ['', ''],
    ['  projMatrix.makePerspective(', '#82aaff'],
    ['    left, right,', '#ffcb6b'],
    ['    top, bottom,', '#ffcb6b'],
    ['    near, far', '#ffcb6b'],
    ['  );', '#82aaff'],
    ['}', '#c792ea'],
  ].forEach(function(l, i) {
    ctx.fillStyle = l[1]; ctx.fillText(l[0], 38, 90 + i * 30);
  });
}

function drawProfileCard(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  rr(ctx, 15, 15, w-30, h-30, 14);
  ctx.fillStyle = 'rgba(10,12,26,0.88)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();

  var cx = w/2, cy = 150;
  ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI*2);
  var ag = ctx.createRadialGradient(cx-15, cy-15, 5, cx, cy, 60);
  ag.addColorStop(0, '#4488ff'); ag.addColorStop(0.6, '#2244aa'); ag.addColorStop(1, '#0a0a33');
  ctx.fillStyle = ag; ctx.fill();
  ctx.strokeStyle = 'rgba(80,160,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = 'bold 44px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'center';
  ctx.fillText('M', cx, cy + 16);

  ctx.font = 'bold 24px -apple-system, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText('Michal Fojcik', cx, 255);
  ctx.font = '16px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Creative Developer', cx, 285);

  ctx.strokeStyle = 'rgba(80,160,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 310); ctx.lineTo(w-40, 310); ctx.stroke();

  [{v:'5+',l:'Projects'},{v:'3D',l:'Spec.'},{v:'∞',l:'Curious'}].forEach(function(s, i) {
    var sx = 55 + i*((w-110)/3);
    ctx.font = 'bold 22px -apple-system, sans-serif'; ctx.fillStyle = '#5599ff';
    ctx.fillText(s.v, sx, 360);
    ctx.font = '13px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(s.l, sx, 385);
  });
  ctx.textAlign = 'left';
}

function drawStatsCard(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  rr(ctx, 8, 8, w-16, h-16, 10);
  ctx.fillStyle = 'rgba(8,10,22,0.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();

  [{l:'PROJECTION',v:'OFF-AXIS',c:'#5599ff'},{l:'TRACKING',v:'REALTIME',c:'#44ddaa'},
   {l:'DEPTH',v:'5 LAYERS',c:'#bb77ff'},{l:'FPS',v:'60',c:'#ffaa44'}
  ].forEach(function(s, i) {
    var x = 50 + i * ((w-60)/4);
    ctx.font = 'bold 26px -apple-system, sans-serif'; ctx.fillStyle = s.c;
    ctx.fillText(s.v, x, h/2 + 6);
    ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(s.l, x, h/2 + 28);
  });
}

function drawTagLive(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 6, 6, w-12, h-12, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();
  ctx.strokeStyle = '#44ddaa'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#44ddaa';
  ctx.textAlign = 'center'; ctx.fillText('⬤ LIVE', w/2, h/2+6); ctx.textAlign = 'left';
}

function drawTagThree(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  rr(ctx, 6, 6, w-12, h-12, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();
  ctx.strokeStyle = '#5599ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#5599ff';
  ctx.textAlign = 'center'; ctx.fillText('THREE.js r160', w/2, h/2+5); ctx.textAlign = 'left';
}

// ==== ANIMATION LOOP ====
function animate() {
  requestAnimationFrame(animate);

  curX += (targetX - curX) * SMOOTHING;
  curY += (targetY - curY) * SMOOTHING;

  // === CAMERA MOVEMENT — the key! ===
  // Move camera, look at a point in the scene
  camera.position.x = curX * CAM_RANGE_X;
  camera.position.y = curY * CAM_RANGE_Y;
  camera.lookAt(0, 1, LOOK_Z);

  time += 0.01;
  anims.forEach(function(o) {
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
