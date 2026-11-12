import {TOUR_POINTS, moveAlongWalkway, walkHeight} from './tour-layout.mjs';
import {multiply, viewMatrix, perspective, transform, screenRay, createPickIndex} from './tour-geometry.mjs';
export function createWorldRenderer(
  canvas,
  {onSelect = () => {}, onProject = () => {}, onChange = () => {}, onLost = () => {}} = {},
) {
  const gl = canvas.getContext('webgl', {antialias: !matchMedia('(pointer:coarse)').matches, alpha: false});
  if (!gl || gl.isContextLost()) throw Error('Cena 3D indisponível.');
  const vertices = [];
  const color = (hex) => [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
  function tri(a, b, c, col, shade = 1) {
    for (const p of [a, b, c]) vertices.push(...p, ...col.map((v) => v * shade));
  }
  function box(x, y, z, w, h, d, hex) {
    const c = color(hex),
      p = [
        [x - w / 2, y, z - d / 2],
        [x + w / 2, y, z - d / 2],
        [x + w / 2, y + h, z - d / 2],
        [x - w / 2, y + h, z - d / 2],
        [x - w / 2, y, z + d / 2],
        [x + w / 2, y, z + d / 2],
        [x + w / 2, y + h, z + d / 2],
        [x - w / 2, y + h, z + d / 2],
      ];
    for (const [a, b, c1, d1, s] of [
      [0, 1, 2, 3, 0.82],
      [4, 7, 6, 5, 1],
      [0, 3, 7, 4, 0.68],
      [1, 5, 6, 2, 0.91],
      [3, 2, 6, 7, 1.08],
    ]) {
      tri(p[a], p[b], p[c1], c, s);
      tri(p[a], p[c1], p[d1], c, s);
    }
  }
  function roof(x, y, z, w, d) {
    const c = color('aa613b'),
      a = [x - w / 2, y, z - d / 2],
      b = [x + w / 2, y, z - d / 2],
      c1 = [x + w / 2, y, z + d / 2],
      d1 = [x - w / 2, y, z + d / 2],
      e = [x, y + 1.4, z - d / 2],
      f = [x, y + 1.4, z + d / 2];
    tri(a, b, e, c, 0.8);
    tri(d1, f, c1, c);
    tri(a, e, f, c, 0.75);
    tri(a, f, d1, c, 0.75);
    tri(e, b, c1, c, 1.05);
    tri(e, c1, f, c, 1.05);
  }
  function foliage(x, y, z, r, hex) {
    const c = color(hex),
      rings = 5,
      segs = 9;
    const point = (i, j) => {
      const v = (Math.PI * i) / rings,
        t = (2 * Math.PI * j) / segs;
      return [
        x + Math.sin(v) * Math.cos(t) * r,
        y + Math.cos(v) * r * 0.9,
        z + Math.sin(v) * Math.sin(t) * r,
      ];
    };
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < segs; j++) {
        tri(point(i, j), point(i + 1, j), point(i + 1, j + 1), c, 0.78 + i * 0.055);
        tri(point(i, j), point(i + 1, j + 1), point(i, j + 1), c, 0.78 + i * 0.055);
      }
  }
  function tree(x, z, size = 1) {
    box(x, 0.1, z, 0.22, 2.2 * size, 0.22, '887a61');
    foliage(x, 2.2 * size, z, 1.05 * size, '628959');
    foliage(x - 0.55 * size, 1.8 * size, z + 0.25 * size, 0.7 * size, '769b62');
    foliage(x + 0.45 * size, 2.6 * size, z, 0.65 * size, '89a96c');
  }
  function palm(x, y, z) {
    box(x, y, z, 0.2, 4, 0.2, '927857');
    for (let j = 0; j < 8; j++) {
      const t = (j * Math.PI) / 4,
        c = color(j % 2 ? '6f9358' : '567c4a');
      const tip = [x + Math.cos(t) * 2.1, y + 3.5, z + Math.sin(t) * 2.1],
        mid = [x + Math.cos(t) * 0.9, y + 4.6, z + Math.sin(t) * 0.9];
      tri([x, y + 4, z], [mid[0] + 0.35 * Math.sin(t), mid[1], mid[2] - 0.35 * Math.cos(t)], tip, c);
      tri([x, y + 4, z], tip, [mid[0] - 0.35 * Math.sin(t), mid[1], mid[2] + 0.35 * Math.cos(t)], c, 0.85);
    }
  }

  // Organização informada pelo usuário; dimensões apenas ilustrativas.
  const objects = [],
    ranges = [];
  let objectStart = 0;
  const mark = (id) => {
    ranges.push({id, start: objectStart, count: vertices.length / 6 - objectStart});
    objectStart = vertices.length / 6;
  };
  box(0, -0.7, -7, 34, 0.6, 92, 'a4b995');
  box(0, -0.1, 2, 32, 0.18, 66, 'b6b39f');
  for (let z = -28; z < 34; z += 1.2)
    for (let x = -5; x < 5; x += 1.1)
      box(x, 0.1, z, 1.04, 0.03, 1.1, Math.round((x + 5) * 10 + z * 10) % 3 === 0 ? 'aaa897' : 'c3bdab');
  function house(n, x, z) {
    objectStart = vertices.length / 6;
    const id = 'c' + String(n).padStart(2, '0'),
      face = x > 0 ? -1 : 1;
    box(x, 0.2, z, 7.8, 5.3, 6.4, 'd8aa39');
    roof(x, 5.5, z, 8.4, 6.8);
    box(x + face * 4.2, 0.12, z, 2.5, 0.15, 6.5, '898b80');
    roof(x + face * 4.2, 2.6, z, 2.8, 6.6);
    for (const dz of [-2.9, 2.9]) box(x + face * 5.1, 0.25, z + dz, 0.16, 2.35, 0.16, '684730');
    box(x + face * 3.94, 0.3, z + 1.65, 0.08, 1.9, 1.1, '6a4933');
    for (const level of [1.1, 3.6])
      for (const dz of [-1.7, 1.5]) {
        box(x + face * 3.94, level, z + dz, 0.12, 1.2, 1.4, 'f4eee0');
        box(x + face * 4.02, level + 0.1, z + dz, 0.1, 1, 1.2, '715646');
      }
    mark(id);
    objects.push({
      id,
      title: 'Casa ' + String(n).padStart(2, '0'),
      type: 'house',
      x: x + face * 3,
      y: 6.3,
      z,
      description: 'Dois andares · ' + (x > 0 ? 'direita' : 'esquerda') + ' de quem entra',
    });
  }
  for (let i = 0; i < 7; i++) {
    house(i + 1, 11, 27 - i * 8);
    house(i + 8, -11, 27 - i * 8);
  }
  // Churrasqueira após a casa 14, ainda no nível residencial.
  objectStart = vertices.length / 6;
  box(-11, 0.2, -28, 8, 0.2, 6, 'b6b09c');
  box(-13, 0.4, -29, 1.5, 2.2, 1.3, '9b6244');
  box(-13, 1.3, -28.3, 1.1, 0.7, 0.1, '3b3e35');
  box(-13, 2.6, -29, 0.8, 1.2, 0.8, 'a37353');
  box(-9, 0.9, -28, 3, 0.15, 1.4, '8c7354');
  for (const z of [-27, -29]) box(-9, 0.45, z, 3, 0.15, 0.45, '8c7354');
  mark('bbq');
  objects.push({
    id: 'bbq',
    title: 'Churrasqueira',
    type: 'space',
    x: -19,
    y: 3.6,
    z: -28,
    description: 'Entre a casa 14 e o salão de festas · churrasqueira e área reservada',
  });
  // Primeiro patamar: festas à esquerda, jogos à direita.
  box(0, -0.1, -38, 32, 3.1, 14, '969a87');
  box(0, 3, -38, 32, 0.15, 14, 'd0c8b2');
  for (let i = 0; i < 12; i++) box(0, 0.1, -27 - i * 0.45, 5, (i + 1) * 0.25, 0.48, 'b5b09f');
  for (const [id, title, x] of [
    ['party', 'Salão de festas', -10],
    ['games', 'Salão de jogos', 10],
  ]) {
    objectStart = vertices.length / 6;
    box(x, 3.15, -38, 9, 3, 8, 'd7ad49');
    roof(x, 6.15, -38, 9.6, 8.6);
    box(x, 3.2, -33.95, 3, 2.3, 0.12, '715c40');
    mark(id);
    objects.push({
      id,
      title,
      type: 'space',
      x,
      y: 7.8,
      z: -38,
      description: 'Primeiro patamar acima das casas · ' + (x < 0 ? 'lado esquerdo' : 'lado direito'),
    });
  }
  // Segundo lance e piscina no patamar mais alto.
  box(0, -0.1, -49, 32, 6.1, 10, '979d88');
  box(0, 6, -49, 32, 0.2, 10, 'e0d7be');
  for (let i = 0; i < 12; i++) box(0, 3.15, -41 - i * 0.3, 5, (i + 1) * 0.25, 0.33, 'bab5a4');
  objectStart = vertices.length / 6;
  box(0, 6.2, -49, 13, 0.25, 6, 'f3e9d2');
  box(0, 6.46, -49, 11.8, 0.03, 4.8, '55b5bc');
  mark('pool');
  objects.push({
    id: 'pool',
    title: 'Piscina',
    type: 'space',
    x: 0,
    y: 8,
    z: -49,
    description: 'Patamar superior · após o segundo lance de escadas',
  });
  // Portão de entrada na extremidade da circulação central.
  objectStart = vertices.length / 6;
  for (const x of [-4.7, 4.7]) box(x, 0.15, 33, 0.65, 3.2, 0.7, 'f0eee3');
  roof(0, 3.5, 33, 10.5, 2.8);
  for (let x = -4.2; x <= 4.2; x += 0.34) box(x, 0.15, 33, 0.23, 2.8, 0.17, '65452e');
  for (const x of [-11, 11]) {
    box(x, 0.1, 33, 12, 1.1, 0.5, '929080');
    box(x, 1.2, 33, 12, 1.05, 0.45, 'eeeade');
  }
  mark('gate');
  objects.push({
    id: 'gate',
    title: 'Entrada e portaria',
    type: 'gate',
    x: 0,
    y: 4.5,
    z: 33,
    description: 'Direita: casas 01–07 · esquerda: casas 08–14 · nenhum portão conectado',
  });
  for (const x of [-16, 16]) for (let z = -28; z < 33; z += 7) tree(x, z, 0.9);
  // Jardins, jardineiras floridas, bancos e iluminação de escala humana.
  for (const x of [-15.7, 15.7]) {
    box(x, 0.1, 1, 1, 0.18, 60, '7b9965');
    for (let z = -27; z < 31; z += 2) foliage(x, 0.65, z, 0.65, '5f854d');
  }
  for (let i = 0; i < 7; i++)
    for (const side of [-1, 1]) {
      const x = side * 5.6,
        z = 29.8 - i * 8;
      box(x, 0.15, z, 0.85, 0.55, 1.5, 'a69577');
      box(x, 0.71, z, 0.7, 0.04, 1.35, '6b6749');
      for (let j = 0; j < 3; j++) {
        foliage(x, 0.98, z - 0.45 + j * 0.45, 0.38, j % 2 ? '6b9452' : '82a365');
        foliage(x + 0.12, 1.2, z - 0.4 + j * 0.4, 0.12, i % 2 ? 'e8cf89' : 'c98d8b');
      }
    }
  for (const x of [-5.3, 5.3])
    for (const z of [24, 8, -8, -24]) {
      box(x, 0.15, z, 0.09, 1.65, 0.09, '4d5a48');
      box(x, 1.8, z, 0.4, 0.15, 0.4, 'eee0b0');
      box(x, 1.95, z, 0.5, 0.08, 0.5, '59654c');
    }
  for (const x of [-13, 13]) {
    palm(x, 6.2, -49);
    box(x, 6.2, -45.5, 2.4, 0.2, 0.9, 'd6c4a2');
    box(x, 6.4, -45.7, 2.2, 0.3, 0.6, 'e6ddbf');
  }
  for (const x of [-5.5, 5.5]) {
    box(x, 3.2, -36, 1.5, 0.6, 2.5, 'b4ad95');
    foliage(x, 4.1, -36, 0.85, '658d58');
  }
  for (const x of [-14, 14]) palm(x, 0.2, 31);
  box(-7, 0.2, -28, 1.4, 0.12, 3, '9ab280');
  foliage(-7, 0.8, -28, 0.7, '71975e');
  // Personagens simbólicos, sem representar a aparência de pessoas reais.
  function person(id, x, z, shirt) {
    objectStart = vertices.length / 6;
    for (const side of [-1, 1]) {
      box(x + side * 0.2, 0.18, z, 0.27, 1.2, 0.32, '334d46');
      box(x + side * 0.2, 0.17, z + 0.1, 0.32, 0.18, 0.55, '344039');
      box(x + side * 0.55, 1.32, z, 0.24, 0.95, 0.3, shirt);
      foliage(x + side * 0.55, 1.28, z, 0.16, 'bc906c');
    }
    box(x, 1.3, z, 0.83, 1.1, 0.44, shirt);
    box(x, 2.4, z, 0.22, 0.2, 0.22, 'bc906c');
    foliage(x, 2.91, z, 0.4, 'bc906c');
    foliage(x, 3.15, z - 0.04, 0.34, '53483d');
    if (id === 'caretaker') {
      box(x, 3.3, z, 0.9, 0.12, 0.65, 'd9b65b');
      box(x, 3.35, z, 0.65, 0.2, 0.55, 'd9b65b');
      box(x + 0.32, 1.82, z + 0.24, 0.1, 0.15, 0.04, 'f1e2af');
    } else {
      box(x, 2.22, z + 0.24, 0.22, 0.16, 0.025, 'f0e9d5');
      box(x, 1.8, z + 0.24, 0.08, 0.42, 0.03, 'e7d6a4');
    }
    mark(id);
  }
  person('syndic', -3.4, 17, 'e8e2cc');
  person('caretaker', 3.4, -5, '4f867c');
  // Quadro de madeira e folhas no plano voltado à entrada da alameda.
  objectStart = vertices.length / 6;
  for (const x of [-4.75, -2.25]) box(x, 0.15, 27, 0.15, 3.2, 0.18, '73583d');
  box(-3.5, 1.28, 27, 3.1, 2.15, 0.22, '73583d');
  box(-3.5, 1.4, 27.14, 2.85, 1.88, 0.08, 'b69563');
  for (const [x, y] of [
    [-4.32, 2.4],
    [-3.48, 2.25],
    [-2.7, 2.4],
  ]) {
    box(x, y - 0.55, 27.21, 0.62, 1, 0.025, 'f1ecda');
    box(x, y + 0.42, 27.24, 0.08, 0.08, 0.03, 'a9543f');
    for (let i = 0; i < 3; i++) box(x, y + 0.1 - i * 0.17, 27.24, 0.4, 0.025, 0.01, '8a927c');
  }
  mark('noticeboard');
  const exteriorCount = vertices.length / 6;
  // Interior conceitual: sala aberta, cozinha e jardim vistos da entrada.
  box(0, -0.2, 0, 16, 0.2, 16, 'bda98b');
  for (let x = -8; x < 8; x += 0.5) box(x, 0.005, 0, 0.018, 0.008, 16, 'aa9276');
  box(0, 0, -6, 16, 4.7, 0.18, 'eee8d9');
  box(-8, 0, 0, 0.18, 4.7, 12, 'dfd9c9');
  box(-3, 1, -5.85, 6, 2.8, 0.08, '91b7b2');
  for (const x of [-6, -3, 0]) box(x, 1, -5.7, 0.08, 2.8, 0.12, 'f8f3e7');
  box(-3, 2.5, -5.7, 6, 0.08, 0.12, 'f8f3e7');
  box(-3, 0, -5.6, 6, 0.15, 0.5, 'e4d6be');
  box(-3, 0.03, 1, 7, 0.035, 5, 'd8d9c5');
  box(-4, 0.25, -1, 4.8, 0.65, 1.8, 'e8dfcb');
  box(-4, 0.9, -1.7, 4.8, 0.75, 0.4, 'd9cdb5');
  for (const x of [-6.3, -1.7]) box(x, 0.6, -1, 0.35, 0.7, 1.9, 'd9cdb5');
  for (const x of [-5.3, -3.9, -2.5]) box(x, 0.91, -1, 1.25, 0.2, 1.05, 'f2ecdf');
  box(-3, 0.35, 1.3, 2.8, 0.15, 1.35, '987958');
  box(-3, 0.05, 1.3, 2, 0.3, 0.9, '6e5947');
  box(-3, 0.51, 1.2, 0.6, 0.06, 0.4, '466e65');
  box(-2.2, 0.51, 1.4, 0.25, 0.25, 0.25, 'eee7d3');
  box(4, 0, -4.8, 6, 1.15, 1.6, '698378');
  box(4, 1.15, -4.8, 6, 0.12, 1.7, 'efe8d8');
  for (const x of [2, 3.5, 5, 6.5]) box(x, 0.45, -3.96, 0.06, 0.06, 0.04, 'd5bd88');
  box(5.8, 0, -2, 2.8, 1.1, 1.3, '8c9c87');
  box(5.8, 1.1, -2, 3, 0.12, 1.5, 'f0e7d7');
  for (const x of [4.8, 6.5]) {
    box(x, 0.55, -0.6, 0.75, 0.15, 0.75, '987958');
    box(x, 0, -0.6, 0.12, 0.6, 0.12, '515e54');
  }
  box(2, 1.9, -5.8, 1.5, 1.7, 0.1, 'a78860');
  box(2, 2.05, -5.7, 1.2, 1.4, 0.03, '718b80');
  box(-7, 0, -4, 0.7, 0.7, 0.7, 'b39571');
  tree(-7, -4, 1.1);
  box(1, 0, 3, 0.13, 2.9, 0.13, '646a58');
  box(1, 2.7, 3, 1.1, 0.5, 1.1, 'eee0bf');
  // Escada interna e área de serviço no térreo.
  for (let i = 0; i < 10; i++) box(7, 0, 3 - i * 0.5, 1.5, (i + 1) * 0.27, 0.5, 'b4a083');
  box(5, 0, -5, 1, 1, 0.8, 'eae5d9');
  box(5, 0.3, -4.58, 0.65, 0.55, 0.04, '99aaa6');
  const interiorCount = vertices.length / 6 - exteriorCount;
  const upperStart = vertices.length / 6;
  box(0, -0.2, 0, 16, 0.2, 16, 'bda98b');
  box(0, 0, -6, 16, 4.7, 0.18, 'eee8d9');
  box(-8, 0, 0, 0.18, 4.7, 12, 'dfd9c9');
  box(-4, 1.4, -5.85, 3.5, 2, 0.08, '91b7b2');
  box(-4, 2.4, -5.7, 3.5, 0.08, 0.12, 'f8f3e7');
  box(-3, 0.2, -2, 3.6, 0.5, 4.6, '927b5b');
  box(-3, 0.7, -2, 3.5, 0.35, 4.5, 'e6e0ce');
  box(-3, 1.05, -3.4, 3.3, 0.15, 1.2, 'f5f0df');
  box(-3, 1.05, -0.8, 3.5, 0.06, 2.1, '859c83');
  box(-3, 0.3, -4.4, 3.8, 1.5, 0.18, 'a88b64');
  box(-6, 0.1, -3.4, 1, 0.7, 1, 'a88b64');
  // Banheiro em corte aberto para visualizar a distribuição conceitual.
  box(3.1, 0, -3, 0.18, 3.1, 6, 'd6ded4');
  box(5.5, 0.02, -3, 4.5, 0.1, 6, 'c8d6cd');
  box(6, 0, -4.5, 2, 0.15, 2, 'eceee2');
  box(6, 2.4, -5.4, 0.8, 0.08, 0.8, '758b85');
  box(6, 1, -5.4, 0.06, 1.4, 0.06, '758b85');
  box(4.4, 0.7, -2, 1.8, 0.25, 1, 'f1eee3');
  box(4.4, 1.5, -5.8, 1.6, 1.5, 0.08, '8fa9a3');
  box(6, 0.1, -1, 0.8, 0.55, 1.2, 'f1eee3');
  const upperCount = vertices.length / 6 - upperStart;
  const vertexData = new Float32Array(vertices),
    pick = createPickIndex(vertexData, exteriorCount, ranges),
    shaders = [];
  vertices.length = 0;
  objects.length = 0;
  const shader = (type, source) => {
    const s = gl.createShader(type);
    shaders.push(s);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Leitura gráfica indisponível.');
    return s;
  };
  const program = gl.createProgram(),
    buffer = gl.createBuffer();
  try {
    gl.attachShader(
      program,
      shader(
        gl.VERTEX_SHADER,
        'attribute vec3 aPos;attribute vec3 aColor;uniform mat4 uM;varying vec3 vColor;varying float vDepth;void main(){gl_Position=uM*vec4(aPos,1.0);vColor=aColor;vDepth=gl_Position.w;}',
      ),
    );
    gl.attachShader(
      program,
      shader(
        gl.FRAGMENT_SHADER,
        'precision mediump float;varying vec3 vColor;varying float vDepth;void main(){float fog=clamp((vDepth-65.0)/220.0,0.0,0.22);gl_FragColor=vec4(mix(vColor,vec3(0.84,0.90,0.85),fog),1.0);}',
      ),
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Cena 3D indisponível.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
    gl.useProgram(program);
    for (const [name, offset] of [
      ['aPos', 0],
      ['aColor', 12],
    ]) {
      const a = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 24, offset);
    }
    gl.enable(gl.DEPTH_TEST);
  } catch (error) {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    shaders.forEach((s) => gl.deleteShader(s));
    throw error;
  }
  shaders.forEach((s) => gl.deleteShader(s));
  const uniform = gl.getUniformLocation(program, 'uM');
  let yaw = 0.22,
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
  function invalidate() {
    if (!disposed && !paused && !document.hidden && !gl.isContextLost() && !frame)
      frame = requestAnimationFrame(draw);
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
    if (disposed || paused || document.hidden || gl.isContextLost()) return;
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
    const dpr = Math.min(devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.25 : 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.84, 0.9, 0.85, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const ground = walkHeight(z),
      eye = interior
        ? [Math.sin(yaw) * 3, 2.7 + pitch * 0.3, Math.max(4, Math.min(9, distance))]
        : walk
          ? [x, ground + 2.1, z]
          : [
              x + distance * Math.sin(yaw) * Math.cos(pitch),
              distance * Math.sin(pitch),
              z + distance * Math.cos(yaw) * Math.cos(pitch),
            ],
      target = interior
        ? [Math.sin(yaw) * 5, 1.8, -3]
        : walk
          ? [x - Math.sin(yaw) * 5, ground + 2.1 + Math.sin(pitch - 0.92) * 3, z - Math.cos(yaw) * 5]
          : [x, 0, z];
    matrix = multiply(perspective(w / h, walk ? fov : (Math.PI * 2) / 7), viewMatrix(eye, target));
    gl.uniformMatrix4fv(uniform, false, matrix);
    gl.drawArrays(
      gl.TRIANGLES,
      interior ? (upper ? upperStart : exteriorCount) : 0,
      interior ? (upper ? upperCount : interiorCount) : exteriorCount,
    );
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
    if (held.size && walk) invalidate();
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
    } else if (paused) renderStill();
    else invalidate();
  });
  listen(canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    clearInput();
    cancelAnimationFrame(frame);
    frame = 0;
    onLost();
  });
  const resize = new ResizeObserver(() => {
    if (paused) renderStill();
    else invalidate();
  });
  resize.observe(canvas);
  canvas.dataset.vertices = String(vertexData.length / 6);
  canvas.dataset.geometryBytes = String(vertexData.byteLength);
  canvas.dataset.exteriorVertices = String(exteriorCount);
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
    dispose() {
      disposed = true;
      clearInput();
      cancelAnimationFrame(frame);
      resize.disconnect();
      listeners.forEach((off) => off());
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
