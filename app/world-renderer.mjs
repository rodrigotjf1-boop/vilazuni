import {TOUR_POINTS, moveAlongWalkway, walkHeight} from './tour-layout.mjs';
import {
  multiply,
  viewMatrix,
  perspective,
  orthographic,
  transform,
  screenRay,
  createPickIndex,
} from './tour-geometry.mjs';
import {buildWorld, STRIDE, SUN} from './world-scene.mjs';
import {VERTEX, fragmentShader, SHADOW_VERTEX, shadowFragment} from './world-shaders.mjs';

// Cena local em WebGL 1, sem bibliotecas: geometria em world-scene.mjs, luz e materiais em world-shaders.mjs.
export function createWorldRenderer(
  canvas,
  {onSelect = () => {}, onProject = () => {}, onChange = () => {}, onLost = () => {}} = {},
) {
  const coarse = matchMedia('(pointer:coarse)').matches,
    gl = canvas.getContext('webgl', {antialias: !coarse, alpha: false});
  if (!gl || gl.isContextLost()) throw Error('Cena 3D indisponível.');
  const world = buildWorld(),
    data = world.data,
    pick = createPickIndex(data, world.exteriorCount, world.ranges, STRIDE),
    highp = (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision || 0) > 0,
    shaders = [],
    programs = [];
  const compile = (type, source) => {
    const s = gl.createShader(type);
    shaders.push(s);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Leitura gráfica indisponível.');
    return s;
  };
  const link = (vertex, fragment) => {
    const p = gl.createProgram();
    programs.push(p);
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error('Cena 3D indisponível.');
    return p;
  };
  let program, shadowProgram, buffer;
  try {
    program = link(VERTEX, fragmentShader(highp));
    shadowProgram = link(SHADOW_VERTEX, shadowFragment(highp));
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  } catch (error) {
    if (buffer) gl.deleteBuffer(buffer);
    programs.forEach((p) => gl.deleteProgram(p));
    shaders.forEach((s) => gl.deleteShader(s));
    throw error;
  }
  shaders.forEach((s) => gl.deleteShader(s));
  const BYTES = STRIDE * 4,
    loc = (name) => gl.getUniformLocation(program, name),
    u = {
      m: loc('uM'),
      light: loc('uLight'),
      cam: loc('uCam'),
      sun: loc('uSun'),
      fog: loc('uFog'),
      fogColor: loc('uFogColor'),
      time: loc('uTime'),
      shadowOn: loc('uShadowOn'),
      shadow: loc('uShadow'),
      texel: loc('uTexel'),
      exposure: loc('uExposure'),
    },
    mainAttributes = ['aPos', 'aNormal', 'aColor', 'aMat'].map((name, i) => [
      gl.getAttribLocation(program, name),
      i,
    ]),
    shadowPos = gl.getAttribLocation(shadowProgram, 'aPos');
  function useMain() {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [a, i] of mainAttributes) {
      if (a < 0) continue;
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, i === 3 ? 1 : 3, gl.FLOAT, false, BYTES, i * 12);
    }
  }
  // Sombra do sol: a cena não se mexe e o sol é fixo, então o mapa é desenhado uma vez só.
  const SHADOW_SIZE = coarse ? 1024 : 2048,
    shadowCenter = [0, 0, -12],
    lightMatrix = multiply(
      orthographic(-66, 66, -66, 66, 1, 460),
      viewMatrix(
        shadowCenter.map((c, i) => c + SUN[i] * 220),
        shadowCenter,
      ),
    );
  let shadowTexture = null,
    shadowFbo = null,
    shadowDepth = null,
    shadowsReady = false;
  function buildShadows() {
    shadowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_SIZE, SHADOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, value] of [
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ])
      gl.texParameteri(gl.TEXTURE_2D, k, value);
    shadowDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, shadowDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW_SIZE, SHADOW_SIZE);
    shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowDepth);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (complete) {
      gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      gl.clearColor(1, 1, 1, 1);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(shadowProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (const [a] of mainAttributes) if (a >= 0) gl.disableVertexAttribArray(a);
      gl.enableVertexAttribArray(shadowPos);
      gl.vertexAttribPointer(shadowPos, 3, gl.FLOAT, false, BYTES, 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(shadowProgram, 'uLight'), false, lightMatrix);
      gl.drawArrays(gl.TRIANGLES, 0, world.exteriorCount);
      gl.drawArrays(gl.TRIANGLES, world.sceneryStart, world.sceneryCount);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return complete;
  }
  shadowsReady = buildShadows();
  useMain();
  gl.enable(gl.DEPTH_TEST);
  gl.uniform3f(u.sun, SUN[0], SUN[1], SUN[2]);
  gl.uniform3f(u.fogColor, ...world.fogColor);
  gl.uniformMatrix4fv(u.light, false, lightMatrix);
  gl.uniform1i(u.shadow, 0);
  gl.uniform1f(u.texel, 1 / SHADOW_SIZE);
  gl.uniform1f(u.exposure, 0.72);

  // ── Login: tomadas de cartão-postal que passam como slides (arco de drone entre elas) ─────────────────
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)'),
    FIRST_HOLD = 6500,
    HOLD = 5200,
    MOVE = 3600;
  const SHOTS = [
    // Vista aérea: condomínio, enseada, mar e ilha.
    {eye: [70, 64, 104], target: [0, 1, -14]},
    // Chegada pela estrada: portão, muro, coqueiros.
    {eye: [17, 8, 72], target: [-1, 3, 24]},
    // A alameda, na altura de quem caminha, até as escadas e a piscina.
    {eye: [1.4, 2.4, 24.5], target: [-0.6, 4.4, -20]},
    // Fachadas das casas, com venezianas, telhados e jardins.
    {eye: [-3, 4.8, 13], target: [11, 3.6, 3]},
    // Piscina no alto, coqueiros e o mar ao fundo.
    {eye: [-15, 13.5, -27], target: [3, 6, -58]},
    // Do mar, olhando para a praia, os coqueiros e o condomínio.
    {eye: [-34, 11, -182], target: [4, 3, -44]},
  ];
  const withoutPeople = [];
  {
    let cursor = 0;
    for (const r of world.ranges
      .filter((r) => r.id === 'syndic' || r.id === 'caretaker')
      .sort((a, b) => a.start - b.start)) {
      if (r.start > cursor) withoutPeople.push([cursor, r.start - cursor]);
      cursor = r.start + r.count;
    }
    if (cursor < world.exteriorCount) withoutPeople.push([cursor, world.exteriorCount - cursor]);
  }
  const show = {index: 0, moving: null, timer: 0};
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // A tomada vale para qualquer tela. No celular a câmera fica no lugar (recuar a faria atravessar muros e
  // árvores): usa uma lente grande-angular e a imagem é deslocada para o alto; na tela larga, para a
  // esquerda (o cartão de acesso fica à direita).
  const PHONE_LENS = 1.25;
  function shotPose(shot) {
    return shot;
  }
  function layoutShift(w) {
    return w <= 600 ? [0, 0.5] : [-448 / w, 0];
  }
  function scenicPose(w, time) {
    const from = shotPose(SHOTS[show.moving ? show.moving.from : show.index], w);
    if (!show.moving) return from;
    const to = shotPose(SHOTS[show.moving.to], w),
      t = Math.min(1, (time - show.moving.start) / MOVE),
      e = ease(t),
      arc = Math.min(30, Math.hypot(...to.eye.map((v, i) => v - from.eye[i])) * 0.22) * Math.sin(Math.PI * e);
    const eye = lerp(from.eye, to.eye, e);
    eye[1] += arc;
    return {eye, target: lerp(from.target, to.target, e), done: t >= 1};
  }
  function scheduleMove(ms) {
    clearTimeout(show.timer);
    if (!scenic || disposed || reduceMotion.matches) return;
    show.timer = setTimeout(() => {
      if (!scenic || disposed) return;
      if (document.hidden) return scheduleMove(HOLD);
      show.moving = {from: show.index, to: (show.index + 1) % SHOTS.length, start: performance.now()};
      canvas.dataset.phase = 'move';
      invalidate();
    }, ms);
  }
  function startShow() {
    show.index = 0;
    show.moving = null;
    canvas.dataset.slide = '0';
    canvas.dataset.phase = 'hold';
    scheduleMove(FIRST_HOLD);
  }
  function stopShow() {
    clearTimeout(show.timer);
    show.moving = null;
    delete canvas.dataset.phase;
    delete canvas.dataset.slide;
  }

  let scenic = false,
    yaw = 0.22,
    pitch = 0.92,
    distance = 106,
    x = 0,
    z = -8,
    walk = false,
    interior = null,
    upper = false,
    fov = (Math.PI * 2) / 7,
    matrix,
    frame = 0,
    disposed = false,
    paused = false,
    lastTime = 0,
    frames = 0,
    gesture = false;
  const held = new Set(),
    pointers = new Map(),
    listeners = [];
  let drag = null,
    pinch = 0;
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };
  const state = () => ({walk, interior, upper, x, z, yaw});
  const announce = () => onChange(state());
  // Pausado (login, painel aberto) não desenha — exceto a passagem de slides do login.
  const canDraw = () => !disposed && (!paused || scenic) && !document.hidden && !gl.isContextLost();
  function invalidate() {
    if (canDraw() && !frame) frame = requestAnimationFrame(draw);
  }
  // O login pode pausar antes do primeiro RAF; mantenha um quadro do cenário no canvas.
  function renderStill() {
    if (disposed || document.hidden || gl.isContextLost()) return;
    cancelAnimationFrame(frame);
    frame = 0;
    const wasPaused = paused;
    paused = false;
    draw(performance.now());
    paused = wasPaused;
  }
  function clearInput() {
    held.clear();
    pointers.clear();
    drag = null;
    pinch = 0;
    gesture = false;
    lastTime = 0;
  }
  function step(forward, side, amount = 0.65) {
    if (!walk || interior || paused) return;
    ({x, z} = moveAlongWalkway({x, z, yaw}, forward, side, amount));
    announce();
    invalidate();
  }
  function draw(time) {
    frame = 0;
    if (!canDraw()) return;
    if (held.size && walk) {
      const forward = Number(held.has('down')) - Number(held.has('up')),
        side = Number(held.has('right')) - Number(held.has('left')),
        elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      ({x, z} = moveAlongWalkway({x, z, yaw}, forward, side, elapsed * 3));
      announce();
    }
    lastTime = time;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const scenicMode = scenic && !interior && !walk;
    let eye, target;
    if (scenicMode) {
      const pose = scenicPose(w, time);
      ({eye, target} = pose);
      if (pose.done) {
        show.index = show.moving.to;
        show.moving = null;
        canvas.dataset.slide = String(show.index);
        canvas.dataset.phase = 'hold';
        scheduleMove(HOLD);
      }
    } else {
      const ground = walkHeight(z);
      eye = interior
        ? [Math.sin(yaw) * 3, 2.7 + pitch * 0.3, Math.max(4, Math.min(9, distance))]
        : walk
          ? [x, ground + 2.1, z]
          : [
              x + distance * Math.sin(yaw) * Math.cos(pitch),
              distance * Math.sin(pitch),
              z + distance * Math.cos(yaw) * Math.cos(pitch),
            ];
      target = interior
        ? [Math.sin(yaw) * 5, 1.8, -3]
        : walk
          ? [x - Math.sin(yaw) * 5, ground + 2.1 + Math.sin(pitch - 0.92) * 3, z - Math.cos(yaw) * 5]
          : [x, 0, z];
    }
    const view = viewMatrix(eye, target),
      lens = walk ? fov : scenicMode && w <= 600 ? PHONE_LENS : (Math.PI * 2) / 7,
      [sx, sy] = scenicMode ? layoutShift(w) : [0, 0],
      shift = (m) =>
        sx || sy ? multiply(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, sx, sy, 0, 1]), m) : m;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const fogColor = world.fogColor;
    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    useMain();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shadowsReady ? shadowTexture : null);
    gl.uniform3f(u.cam, eye[0], eye[1], eye[2]);
    gl.uniform1f(u.time, (time / 1000) % 3600);
    // Uma só profundidade para paisagem e condomínio (da praia, a duna e os coqueiros ficam na frente do
    // muro); o alcance vai até o horizonte.
    matrix = shift(
      multiply(
        perspective(w / h, lens, interior || walk ? 0.2 : scenicMode ? 1 : 0.6, interior ? 220 : 4200),
        view,
      ),
    );
    gl.uniformMatrix4fv(u.m, false, matrix);
    if (interior) {
      gl.uniform1f(u.shadowOn, 0);
      gl.uniform3f(u.fog, 0, 1, 0);
      gl.drawArrays(
        gl.TRIANGLES,
        upper ? world.upperStart : world.interiorStart,
        upper ? world.upperCount : world.interiorCount,
      );
    } else {
      gl.uniform1f(u.shadowOn, 0);
      gl.uniform3f(u.fog, 0, 1, 0);
      gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, world.skyStart, world.skyCount);
      gl.depthMask(true);
      gl.uniform1f(u.shadowOn, shadowsReady ? 1 : 0);
      gl.uniform3f(u.fog, 380, 2400, 0.78);
      gl.drawArrays(gl.TRIANGLES, world.sceneryStart, world.sceneryCount);
      gl.uniform3f(u.fog, 260, 760, 0.06);
      // Nos slides do login, os personagens simbólicos (blocos) ficam de fora; no passeio, eles são atalhos.
      for (const [start, count] of scenicMode ? withoutPeople : [[0, world.exteriorCount]])
        gl.drawArrays(gl.TRIANGLES, start, count);
    }
    onProject(
      TOUR_POINTS.map((o) => {
        const p = transform(matrix, [o.x, o.y, o.z, 1]);
        return {
          id: o.id,
          x: ((p[0] / p[3]) * 0.5 + 0.5) * w,
          y: ((-0.5 * p[1]) / p[3] + 0.5) * h,
          visible: !interior && p[3] > 0 && Math.abs(p[0] / p[3]) < 0.96 && Math.abs(p[1] / p[3]) < 0.96,
        };
      }),
    );
    canvas.dataset.frames = String(++frames);
    canvas.dataset.cameraX = x.toFixed(3);
    canvas.dataset.cameraZ = z.toFixed(3);
    canvas.dataset.mode = interior ? 'interior' : walk ? 'walk' : 'orbit';
    if ((held.size && walk) || (scenicMode && show.moving)) invalidate();
    else lastTime = 0;
  }
  function reset() {
    clearInput();
    interior = null;
    upper = false;
    yaw = 0.22;
    pitch = 0.92;
    distance = 106;
    x = 0;
    z = -8;
    walk = false;
    announce();
    invalidate();
  }
  function zoom(delta) {
    if (walk) fov = Math.max(0.5, Math.min(1.3, fov + delta * 0.006));
    else distance = Math.max(interior ? 4 : 20, Math.min(interior ? 9 : 140, distance + delta));
    invalidate();
  }
  function hold(direction, active) {
    if (paused || !walk) return;
    if (active) {
      held.add(direction);
      invalidate();
    } else {
      held.delete(direction);
      if (!held.size) lastTime = 0;
    }
  }
  const directions = {
    ArrowUp: 'up',
    w: 'up',
    ArrowDown: 'down',
    s: 'down',
    ArrowLeft: 'left',
    a: 'left',
    ArrowRight: 'right',
    d: 'right',
  };
  listen(canvas, 'keydown', (e) => {
    if (paused) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key,
      direction = directions[key];
    if (direction) {
      e.preventDefault();
      if (walk) {
        if (!e.repeat)
          step(
            direction === 'up' ? -1 : direction === 'down' ? 1 : 0,
            direction === 'left' ? -1 : direction === 'right' ? 1 : 0,
            0.2,
          );
        hold(direction, true);
      } else {
        yaw += direction === 'left' ? 0.08 : direction === 'right' ? -0.08 : 0;
        pitch = Math.max(
          0.25,
          Math.min(1.35, pitch + (direction === 'up' ? 0.05 : direction === 'down' ? -0.05 : 0)),
        );
        invalidate();
      }
    }
    if (key === '+' || key === '=' || key === '-') {
      e.preventDefault();
      zoom(key === '-' ? 1 : -1);
    }
  });
  listen(window, 'keyup', (e) => {
    const direction = directions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (direction) hold(direction, false);
  });
  listen(
    canvas,
    'wheel',
    (e) => {
      if (paused) return;
      e.preventDefault();
      zoom(e.deltaY * 0.035);
    },
    {passive: false},
  );
  listen(canvas, 'pointerdown', (e) => {
    if (paused || e.button > 0) return;
    canvas.setPointerCapture(e.pointerId);
    canvas.focus({preventScroll: true});
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size === 1) {
      drag = {x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false};
      gesture = false;
    }
    if (pointers.size > 1) {
      gesture = true;
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  listen(canvas, 'pointermove', (e) => {
    if (paused || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size > 1) {
      const [a, b] = [...pointers.values()],
        gap = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom((pinch - gap) * 0.06);
      pinch = gap;
      return;
    }
    if (!drag || gesture) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.moved ||= Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5;
    drag.x = e.clientX;
    drag.y = e.clientY;
    yaw -= dx * 0.006;
    pitch = Math.max(0.25, Math.min(1.35, pitch + dy * 0.005));
    invalidate();
  });
  listen(canvas, 'pointerup', (e) => {
    const tap = drag && !drag.moved && !gesture && !paused;
    pointers.delete(e.pointerId);
    if (!pointers.size) {
      drag = null;
      pinch = 0;
      gesture = false;
    }
    if (tap && !interior && matrix) {
      const rect = canvas.getBoundingClientRect(),
        id = pick(screenRay(matrix, e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height));
      if (id) onSelect(id);
    }
  });
  listen(canvas, 'pointercancel', clearInput);
  listen(canvas, 'lostpointercapture', () => {
    if (!pointers.size) drag = null;
  });
  listen(window, 'blur', clearInput);
  listen(document, 'visibilitychange', () => {
    clearInput();
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(show.timer);
      if (show.moving) show.moving = null;
    } else {
      if (scenic && !reduceMotion.matches) {
        canvas.dataset.phase = 'hold';
        scheduleMove(HOLD);
      }
      if (paused) renderStill();
      else invalidate();
    }
  });
  listen(canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    clearInput();
    cancelAnimationFrame(frame);
    clearTimeout(show.timer);
    frame = 0;
    onLost();
  });
  const resize = new ResizeObserver(() => {
    if (paused) renderStill();
    else invalidate();
  });
  resize.observe(canvas);
  canvas.dataset.vertices = String(data.length / STRIDE);
  canvas.dataset.geometryBytes = String(data.byteLength);
  canvas.dataset.exteriorVertices = String(world.exteriorCount);
  canvas.dataset.shadows = String(shadowsReady);
  invalidate();
  return {
    reset,
    zoom,
    step,
    hold,
    state,
    toggleWalk() {
      if (interior || paused) return;
      clearInput();
      walk = !walk;
      if (walk) {
        x = 0;
        z = 29;
        yaw = 0;
        pitch = 0.92;
      }
      announce();
      invalidate();
    },
    enterHouse(id) {
      if (!TOUR_POINTS.some((p) => p.id === id && p.kind === 'house')) return;
      clearInput();
      interior = id;
      upper = false;
      walk = false;
      distance = 8;
      yaw = -0.15;
      pitch = 0.5;
      announce();
      invalidate();
    },
    toggleFloor() {
      if (!interior) return;
      upper = !upper;
      announce();
      invalidate();
    },
    focusPoint(id) {
      const point = TOUR_POINTS.find((p) => p.id === id);
      if (!point) return;
      reset();
      x = point.x;
      z = point.z;
      distance = 48;
      announce();
      invalidate();
    },
    pause(value) {
      if (paused === !!value) return;
      clearInput();
      if (value) {
        renderStill();
        paused = true;
      } else {
        paused = false;
        invalidate();
      }
    },
    renderStill,
    // Login: tomadas de cartão-postal em sequência (slides). Com "reduzir movimento", fica na primeira.
    setScenic(on) {
      if (scenic === !!on) return;
      scenic = !!on;
      if (scenic) startShow();
      else stopShow();
      if (paused) renderStill();
      else invalidate();
    },
    dispose() {
      disposed = true;
      clearInput();
      cancelAnimationFrame(frame);
      clearTimeout(show.timer);
      resize.disconnect();
      listeners.forEach((off) => off());
      gl.deleteBuffer(buffer);
      programs.forEach((p) => gl.deleteProgram(p));
      if (shadowTexture) gl.deleteTexture(shadowTexture);
      if (shadowFbo) gl.deleteFramebuffer(shadowFbo);
      if (shadowDepth) gl.deleteRenderbuffer(shadowDepth);
      if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
