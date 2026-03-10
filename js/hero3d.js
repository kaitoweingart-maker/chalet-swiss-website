(function () {
'use strict';

var canvas = document.getElementById('heroCanvas');
if (!canvas) return;

if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
if (!gl) return;

function init() {
  if (typeof THREE === 'undefined') return;

  var hero = document.getElementById('hero');
  if (!hero) return;

  var isMobile = window.innerWidth <= 768;
  var W = hero.offsetWidth;
  var H = hero.offsetHeight;
  var dpr = Math.min(window.devicePixelRatio, 2);
  var rW = Math.floor(W * dpr);
  var rH = Math.floor(H * dpr);

  // ========== RENDERER ==========
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: false,
    powerPreference: 'low-power',
    alpha: false
  });
  renderer.setClearColor(0xF5F3F0, 1);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  renderer.autoClear = false;

  // ========== SHARED ==========
  var fullscreenGeo = new THREE.PlaneGeometry(2, 2);
  var orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var vertSrc = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  // ========== RENDER TARGETS ==========
  var rtOpts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  };

  var reliefRT = new THREE.WebGLRenderTarget(rW, rH, rtOpts);
  var maskRT_A = new THREE.WebGLRenderTarget(rW, rH, rtOpts);
  var maskRT_B = new THREE.WebGLRenderTarget(rW, rH, rtOpts);
  var pingPong = 0;

  // ========== LOAD TEXTURE ==========
  var loader = new THREE.TextureLoader();
  loader.load(
    './assets/images/exterior/Interlaken_Dengler_Matthias_893.jpg',
    function (texture) {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      var imgW = texture.image.width;
      var imgH = texture.image.height;

      // ============================================================
      // PASS 1: BAS-RELIEF SCENE
      // Converts hotel photo into a sculpted plaster/mineral surface
      // using heightfield normals + directional lighting
      // ============================================================
      var reliefScene = new THREE.Scene();

      var reliefFragSrc = [
        'precision highp float;',
        '',
        'uniform sampler2D uTexture;',
        'uniform vec2 uRes;',
        'uniform vec2 uImgRes;',
        'uniform vec2 uMouse;',
        'uniform float uTime;',
        '',
        'varying vec2 vUv;',
        '',
        '// object-fit: cover in shader',
        'vec2 coverUV(vec2 uv) {',
        '  float sa = uRes.x / uRes.y;',
        '  float ia = uImgRes.x / uImgRes.y;',
        '  vec2 s = vec2(1.0);',
        '  if (sa > ia) s.y = ia / sa;',
        '  else s.x = sa / ia;',
        '  return (uv - 0.5) * s + 0.5;',
        '}',
        '',
        'float hash(vec2 p) {',
        '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
        '}',
        '',
        'void main() {',
        '  // Subtle parallax shift from cursor',
        '  vec2 shift = (uMouse - 0.5) * 0.015;',
        '  vec2 uv = coverUV(vUv + shift);',
        '',
        '  // Sample full-color photo',
        '  vec3 col = texture2D(uTexture, uv).rgb;',
        '',
        '  // Warm cinematic color grading',
        '  col.r *= 1.06;',
        '  col.g *= 1.01;',
        '  col.b *= 0.92;',
        '',
        '  // Slight saturation boost',
        '  float luma = dot(col, vec3(0.299, 0.587, 0.114));',
        '  col = mix(vec3(luma), col, 1.15);',
        '',
        '  // Cinematic vignette',
        '  float vig = 1.0 - smoothstep(0.3, 1.4, length((vUv - 0.5) * vec2(2.0, 2.2)));',
        '  col *= mix(0.4, 1.0, vig);',
        '',
        '  // Film grain',
        '  float grain = hash(vUv * uRes + uTime * 100.0) * 0.03 - 0.015;',
        '  col += grain;',
        '',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n');

      var reliefUniforms = {
        uTexture: { value: texture },
        uRes: { value: new THREE.Vector2(rW, rH) },
        uImgRes: { value: new THREE.Vector2(imgW, imgH) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0 }
      };

      reliefScene.add(new THREE.Mesh(fullscreenGeo, new THREE.ShaderMaterial({
        uniforms: reliefUniforms,
        vertexShader: vertSrc,
        fragmentShader: reliefFragSrc
      })));

      // ============================================================
      // PASS 2: MASK ACCUMULATION (ping-pong render targets)
      // Brush-like cursor reveal with organic noise on edge
      // ============================================================
      var maskScene = new THREE.Scene();

      var maskFragSrc = [
        'precision highp float;',
        '',
        'uniform sampler2D uPrevMask;',
        'uniform vec2 uCursor;',
        'uniform float uCursorActive;',
        'uniform float uTime;',
        'uniform vec2 uRes;',
        'uniform float uBrushSize;',
        '',
        'varying vec2 vUv;',
        '',
        'float hash(vec2 p) {',
        '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
        '}',
        '',
        '// Value noise for organic edge',
        'float noise(vec2 p) {',
        '  vec2 i = floor(p);',
        '  vec2 f = fract(p);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  float a = hash(i);',
        '  float b = hash(i + vec2(1.0, 0.0));',
        '  float c = hash(i + vec2(0.0, 1.0));',
        '  float d = hash(i + vec2(1.0, 1.0));',
        '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
        '}',
        '',
        'void main() {',
        '  // Read previous mask — decays so white covers back (~2s fade)',
        '  float prev = texture2D(uPrevMask, vUv).r * 0.985;',
        '',
        '  // Aspect-corrected distance to cursor',
        '  float aspect = uRes.x / uRes.y;',
        '  vec2 uvA = vUv * vec2(aspect, 1.0);',
        '  vec2 curA = uCursor * vec2(aspect, 1.0);',
        '  float d = distance(uvA, curA);',
        '',
        '  // Organic noise on the reveal edge',
        '  float n1 = noise(vUv * 8.0 + uTime * 0.3) * 0.025;',
        '  float n2 = noise(vUv * 22.0 - uTime * 0.5) * 0.012;',
        '',
        '  // Soft brush with noisy radius',
        '  float radius = uBrushSize + n1 + n2;',
        '  float inner = radius * 0.2;',
        '  float brush = smoothstep(radius, inner, d) * uCursorActive;',
        '',
        '  // Accumulate (max blend — never erase)',
        '  float mask = max(prev, brush);',
        '',
        '  gl_FragColor = vec4(mask, mask, mask, 1.0);',
        '}'
      ].join('\n');

      var maskUniforms = {
        uPrevMask: { value: null },
        uCursor: { value: new THREE.Vector2(-1, -1) },
        uCursorActive: { value: 0 },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(rW, rH) },
        uBrushSize: { value: isMobile ? 0.16 : 0.13 }
      };

      maskScene.add(new THREE.Mesh(fullscreenGeo, new THREE.ShaderMaterial({
        uniforms: maskUniforms,
        vertexShader: vertSrc,
        fragmentShader: maskFragSrc
      })));

      // ============================================================
      // PASS 3: FINAL COMPOSITE
      // finalColor = mix(white, reliefColor, mask)
      // ============================================================
      var compScene = new THREE.Scene();

      var compFragSrc = [
        'precision highp float;',
        '',
        'uniform sampler2D uRelief;',
        'uniform sampler2D uMask;',
        'uniform float uAlpha;',
        '',
        'varying vec2 vUv;',
        '',
        'void main() {',
        '  vec3 relief = texture2D(uRelief, vUv).rgb;',
        '  float mask = texture2D(uMask, vUv).r;',
        '',
        '  // Smooth mask edges for elegant transition',
        '  mask = smoothstep(0.0, 0.85, mask);',
        '',
        '  // Warm white cover (plaster/mineral)',
        '  vec3 cover = vec3(0.96, 0.953, 0.937);',
        '',
        '  // Blend: white cover -> relief reveal',
        '  vec3 col = mix(cover, relief, mask);',
        '',
        '  // Subtle warm edge glow at mask transition',
        '  float edge = smoothstep(0.3, 0.5, mask) - smoothstep(0.5, 0.7, mask);',
        '  col += edge * vec3(0.015, 0.012, 0.008);',
        '',
        '  gl_FragColor = vec4(col, uAlpha);',
        '}'
      ].join('\n');

      var compUniforms = {
        uRelief: { value: reliefRT.texture },
        uMask: { value: null },
        uAlpha: { value: 0 }
      };

      compScene.add(new THREE.Mesh(fullscreenGeo, new THREE.ShaderMaterial({
        uniforms: compUniforms,
        vertexShader: vertSrc,
        fragmentShader: compFragSrc,
        transparent: true
      })));

      // Mark WebGL active (switches hero/nav to light theme)
      hero.classList.add('webgl-active');
      document.body.classList.add('hero-light');

      // ========== MOUSE TRACKING ==========
      var tMouse = { x: 0.5, y: 0.5 };
      var currentMouse = { x: 0.5, y: 0.5 };
      var tIntensity = 0;
      var cursorActive = 0;

      hero.addEventListener('mousemove', function (e) {
        var rect = hero.getBoundingClientRect();
        tMouse.x = (e.clientX - rect.left) / rect.width;
        tMouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
        tIntensity = 1;
      });

      hero.addEventListener('mouseleave', function () {
        tIntensity = 0;
      });

      if (isMobile) {
        hero.addEventListener('touchmove', function (e) {
          var t = e.touches[0];
          var rect = hero.getBoundingClientRect();
          tMouse.x = (t.clientX - rect.left) / rect.width;
          tMouse.y = 1.0 - (t.clientY - rect.top) / rect.height;
          tIntensity = 1;
        }, { passive: true });

        hero.addEventListener('touchend', function () {
          tIntensity = 0;
        });
      }

      // ========== VISIBILITY ==========
      var isVisible = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          isVisible = entries[0].isIntersecting;
        }, { threshold: 0.05 }).observe(hero);
      }

      var tabHidden = false;
      document.addEventListener('visibilitychange', function () {
        tabHidden = document.hidden;
      });

      // ========== RESIZE ==========
      var rTimer;
      window.addEventListener('resize', function () {
        clearTimeout(rTimer);
        rTimer = setTimeout(function () {
          isMobile = window.innerWidth <= 768;
          W = hero.offsetWidth;
          H = hero.offsetHeight;
          rW = Math.floor(W * dpr);
          rH = Math.floor(H * dpr);
          renderer.setSize(W, H);
          reliefRT.setSize(rW, rH);
          maskRT_A.setSize(rW, rH);
          maskRT_B.setSize(rW, rH);
          reliefUniforms.uRes.value.set(rW, rH);
          maskUniforms.uRes.value.set(rW, rH);
          maskUniforms.uBrushSize.value = isMobile ? 0.22 : 0.18;
        }, 200);
      });

      // ========== RENDER LOOP ==========
      var last = performance.now();
      var elapsed = 0;

      function tick() {
        requestAnimationFrame(tick);
        if (!isVisible || tabHidden) { last = performance.now(); return; }

        var now = performance.now();
        var dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        elapsed += dt;

        // Smooth mouse lerp
        currentMouse.x += (tMouse.x - currentMouse.x) * 0.08;
        currentMouse.y += (tMouse.y - currentMouse.y) * 0.08;

        // Smooth cursor activity
        cursorActive += (tIntensity - cursorActive) * 0.06;

        // Fade-in on load
        if (compUniforms.uAlpha.value < 1) {
          compUniforms.uAlpha.value = Math.min(1, compUniforms.uAlpha.value + dt * 0.6);
        }

        // Update uniforms
        reliefUniforms.uMouse.value.set(currentMouse.x, currentMouse.y);
        reliefUniforms.uTime.value = elapsed;
        maskUniforms.uCursor.value.set(currentMouse.x, currentMouse.y);
        maskUniforms.uCursorActive.value = cursorActive;
        maskUniforms.uTime.value = elapsed;

        // --- PASS 1: Render bas-relief to texture ---
        renderer.setRenderTarget(reliefRT);
        renderer.clear();
        renderer.render(reliefScene, orthoCamera);

        // --- PASS 2: Update mask (ping-pong) ---
        var readMask = pingPong === 0 ? maskRT_A : maskRT_B;
        var writeMask = pingPong === 0 ? maskRT_B : maskRT_A;
        maskUniforms.uPrevMask.value = readMask.texture;
        renderer.setRenderTarget(writeMask);
        renderer.clear();
        renderer.render(maskScene, orthoCamera);
        pingPong = 1 - pingPong;

        // --- PASS 3: Composite to screen ---
        compUniforms.uMask.value = writeMask.texture;
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(compScene, orthoCamera);
      }

      tick();
    },
    undefined,
    function () {
      // Texture load failed — fallback image stays visible
    }
  );
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 50); });
} else {
  setTimeout(init, 50);
}

})();
