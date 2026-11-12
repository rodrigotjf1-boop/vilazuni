// Geometria do condomínio, do interior conceitual e da paisagem litorânea (ilustrativa, Região dos Lagos).
// Cada vértice: posição (3) · normal (3) · cor sRGB (3) · material (1). A luz, a sombra e a textura de cada
// material são calculadas no shader (world-shaders.mjs); aqui só formas, cores-base e materiais.
export const STRIDE = 10;
export const MAT = {
  PLAIN: 0,
  WALL: 1,
  ROOF: 2,
  PAVING: 3,
  STONE: 4,
  GRASS: 5,
  LEAF: 6,
  WOOD: 7,
  SHUTTER: 8,
  TRIM: 9,
  POOL: 10,
  SEA: 11,
  FOAM: 12,
  ROCK: 13,
  BARK: 14,
  TERRAIN: 15,
  ASPHALT: 16,
  CONCRETE: 17,
  SKY: 18,
  METAL: 19,
};
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((n) => n / l);
};
// Sol de meio da tarde, vindo da esquerda de quem chega (luz lateral, como em foto de arquitetura): as
// fachadas ganham volume e as sombras longas aparecem na frente da câmera em vez de sumir atrás das casas.
export const SUN = unit([-0.62, 0.55, 0.46]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const color = (hex) => [
  parseInt(hex.slice(0, 2), 16) / 255,
  parseInt(hex.slice(2, 4), 16) / 255,
  parseInt(hex.slice(4, 6), 16) / 255,
];
const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function noise(x, z) {
  const xi = Math.floor(x),
    zi = Math.floor(z),
    fx = x - xi,
    fz = z - zi,
    sx = fx * fx * (3 - 2 * fx),
    sz = fz * fz * (3 - 2 * fz),
    a = hash(xi, zi),
    b = hash(xi + 1, zi),
    c = hash(xi, zi + 1),
    d = hash(xi + 1, zi + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const noise3 = (x, y, z) => (noise(x + y * 1.7, z - y * 0.9) + noise(z + 3.1, x - y * 1.3)) * 0.5;
const smoothstep = (e0, e1, v) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function buildWorld() {
  const v = [];
  const count = () => v.length / STRIDE;
  const push = (p, n, c, m) => v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], m);
  const tri = (a, b, c, col, m, n) => {
    push(a, n, col, m);
    push(b, n, col, m);
    push(c, n, col, m);
  };
  const quad = (a, b, c, d, col, m, n) => {
    tri(a, b, c, col, m, n);
    tri(a, c, d, col, m, n);
  };
  const faceNormal = (a, b, c, hint) => {
    const n = unit(cross(sub(b, a), sub(c, a)));
    return dot(n, hint) < 0 ? n.map((x) => -x) : n;
  };
  const triSmooth = (pts, normals, col, m) => pts.forEach((p, i) => push(p, normals[i], col, m));
  const tone = (hex, f) => color(hex).map((c) => Math.min(1, c * f));
  function box(x, y, z, w, h, d, hex, m = MAT.PLAIN) {
    const c = typeof hex === 'string' ? color(hex) : hex,
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
    for (const [a, b, c1, d1, n] of [
      [0, 1, 2, 3, [0, 0, -1]],
      [4, 7, 6, 5, [0, 0, 1]],
      [0, 3, 7, 4, [-1, 0, 0]],
      [1, 5, 6, 2, [1, 0, 0]],
      [3, 2, 6, 7, [0, 1, 0]],
    ])
      quad(p[a], p[b], p[c1], p[d1], c, m, n);
  }
  // Telhado de duas águas com cumeeira ao longo de z: telhas nas águas, oitão na cor da parede (recuado
  // até o plano da fachada), testeira sob o beiral e cumeeira de cerâmica.
  function roof(x, y, z, w, d, {hex = 'b25f3a', wall = null, overhang = 0.3, rise = 1.4} = {}) {
    const c = color(hex),
      a = [x - w / 2, y, z - d / 2],
      b = [x + w / 2, y, z - d / 2],
      c1 = [x + w / 2, y, z + d / 2],
      d1 = [x - w / 2, y, z + d / 2],
      e = [x, y + rise, z - d / 2],
      f = [x, y + rise, z + d / 2];
    quad(a, e, f, d1, c, MAT.ROOF, faceNormal(a, e, f, [-1, 1, 0]));
    quad(e, b, c1, f, c, MAT.ROOF, faceNormal(e, b, c1, [1, 1, 0]));
    // Espessura da telha na borda do beiral.
    const lip = tone(hex, 0.62);
    quad(
      [x - w / 2, y - 0.16, z - d / 2],
      [x - w / 2, y, z - d / 2],
      [x - w / 2, y, z + d / 2],
      [x - w / 2, y - 0.16, z + d / 2],
      lip,
      MAT.WOOD,
      [-1, 0, 0],
    );
    quad(
      [x + w / 2, y - 0.16, z - d / 2],
      [x + w / 2, y, z - d / 2],
      [x + w / 2, y, z + d / 2],
      [x + w / 2, y - 0.16, z + d / 2],
      lip,
      MAT.WOOD,
      [1, 0, 0],
    );
    const inset = Math.min(overhang, d / 2 - 0.05),
      gw = w / 2 - overhang,
      gr = (rise * gw) / (w / 2),
      wallColor = wall ? color(wall) : c;
    for (const [zz, n] of [
      [z - d / 2 + inset, [0, 0, -1]],
      [z + d / 2 - inset, [0, 0, 1]],
    ])
      tri([x - gw, y, zz], [x + gw, y, zz], [x, y + gr, zz], wallColor, wall ? MAT.WALL : MAT.ROOF, n);
    // Pontas do telhado sobre o oitão (a água vista de frente).
    for (const [zz, n] of [
      [z - d / 2, [0, 0, -1]],
      [z + d / 2, [0, 0, 1]],
    ]) {
      quad(
        [x - w / 2, y - 0.16, zz],
        [x - w / 2, y, zz],
        [x, y + rise, zz],
        [x, y + rise - 0.16, zz],
        lip,
        MAT.WOOD,
        n,
      );
      quad(
        [x, y + rise - 0.16, zz],
        [x, y + rise, zz],
        [x + w / 2, y, zz],
        [x + w / 2, y - 0.16, zz],
        lip,
        MAT.WOOD,
        n,
      );
    }
    box(x, y + rise - 0.06, z, 0.34, 0.16, d + 0.06, tone(hex, 0.85), MAT.ROOF);
  }
  // Cilindro (tronco, poste), com normal suave e inclinação opcional.
  function cylinder(x, y, z, r0, r1, h, col, m, segs = 8, lean = [0, 0], rings = 1) {
    const c = typeof col === 'string' ? color(col) : col;
    for (let k = 0; k < rings; k++) {
      const t0 = k / rings,
        t1 = (k + 1) / rings,
        ring = (t) => {
          const r = r0 + (r1 - r0) * t,
            bend = t * t;
          return [x + lean[0] * bend, y + h * t, z + lean[1] * bend, r];
        },
        [x0, y0, z0, ra] = ring(t0),
        [x1, y1, z1, rb] = ring(t1);
      for (let j = 0; j < segs; j++) {
        const a0 = (j / segs) * Math.PI * 2,
          a1 = ((j + 1) / segs) * Math.PI * 2,
          n0 = [Math.cos(a0), 0, Math.sin(a0)],
          n1 = [Math.cos(a1), 0, Math.sin(a1)];
        const p00 = [x0 + n0[0] * ra, y0, z0 + n0[2] * ra],
          p01 = [x0 + n1[0] * ra, y0, z0 + n1[2] * ra],
          p10 = [x1 + n0[0] * rb, y1, z1 + n0[2] * rb],
          p11 = [x1 + n1[0] * rb, y1, z1 + n1[2] * rb];
        triSmooth([p00, p01, p11], [n0, n1, n1], c, m);
        triSmooth([p00, p11, p10], [n0, n1, n0], c, m);
      }
    }
  }
  // Copa orgânica: esfera deformada por ruído, normal suave.
  function blob(
    x,
    y,
    z,
    r,
    col,
    m = MAT.LEAF,
    {rings = 6, segs = 10, squash = 0.85, rough = 0.28, seed = 0} = {},
  ) {
    const c = typeof col === 'string' ? color(col) : col;
    const point = (i, j) => {
      const vv = (Math.PI * i) / rings,
        t = (2 * Math.PI * j) / segs,
        n = [Math.sin(vv) * Math.cos(t), Math.cos(vv), Math.sin(vv) * Math.sin(t)],
        k = 1 + rough * (noise3(n[0] * 2.3 + seed, n[1] * 2.3, n[2] * 2.3 - seed) - 0.5) * 2;
      return [[x + n[0] * r * k, y + n[1] * r * squash * k, z + n[2] * r * k], n];
    };
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < segs; j++) {
        const [p1, n1] = point(i, j),
          [p2, n2] = point(i + 1, j),
          [p3, n3] = point(i + 1, j + 1),
          [p4, n4] = point(i, j + 1);
        triSmooth([p1, p2, p3], [n1, n2, n3], c, m);
        triSmooth([p1, p3, p4], [n1, n3, n4], c, m);
      }
  }
  let seedValue = 20261112;
  const random = () => {
    seedValue = (seedValue + 0x6d2b79f5) | 0;
    let t = Math.imul(seedValue ^ (seedValue >>> 15), 1 | seedValue);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  function tree(x, z, size = 1, y = 0.1) {
    cylinder(x, y, z, 0.16 * size, 0.1 * size, 2.3 * size, '7d6a52', MAT.BARK, 7, [0.15, 0.1], 2);
    const greens = ['5d8048', '6b8f50', '77985a'];
    blob(x, y + 2.4 * size, z, 1.05 * size, greens[0], MAT.LEAF, {seed: x + z});
    blob(x - 0.55 * size, y + 2 * size, z + 0.3 * size, 0.75 * size, greens[1], MAT.LEAF, {
      rings: 5,
      segs: 8,
      seed: x,
    });
    blob(x + 0.5 * size, y + 2.8 * size, z - 0.2 * size, 0.7 * size, greens[2], MAT.LEAF, {
      rings: 5,
      segs: 8,
      seed: z,
    });
  }
  // Coqueiro: tronco anelado e curvo, folhas em "V" que caem em arco, cocos.
  function palm(x, y, z, h = 4.6) {
    const a = random() * Math.PI * 2,
      lean = [Math.cos(a) * 0.9, Math.sin(a) * 0.9];
    cylinder(x, y, z, 0.2, 0.13, h, '8a7656', MAT.BARK, 7, lean, 5);
    const top = [x + lean[0], y + h, z + lean[1]],
      greens = ['5f8a3f', '6e9a47', '557d39'];
    for (let k = 0; k < 11; k++) {
      const ang = (k / 11) * Math.PI * 2 + random() * 0.3,
        dir = [Math.cos(ang), Math.sin(ang)],
        side = [-dir[1], dir[0]],
        length = 2.4 + random() * 0.6,
        lift = 0.55 + random() * 0.25,
        c = color(greens[k % 3]);
      let prev = null;
      for (let s = 0; s <= 6; s++) {
        const t = s / 6,
          reach = length * t,
          drop = lift * t * 2.2 - 2.4 * t * t,
          center = [top[0] + dir[0] * reach, top[1] + drop, top[2] + dir[1] * reach],
          width = 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.04,
          left = [center[0] + side[0] * width, center[1] - width * 0.45, center[2] + side[1] * width],
          right = [center[0] - side[0] * width, center[1] - width * 0.45, center[2] - side[1] * width];
        if (prev) {
          const nl = faceNormal(prev.center, prev.left, left, [0, 1, 0]),
            nr = faceNormal(prev.center, prev.right, right, [0, 1, 0]);
          quad(prev.center, prev.left, left, center, c, MAT.LEAF, nl);
          quad(prev.center, center, right, prev.right, c, MAT.LEAF, nr);
        }
        prev = {center, left, right};
      }
    }
    // Cacho de cocos sob as folhas.
    blob(top[0], top[1] - 0.28, top[2], 0.3, '6b5432', MAT.PLAIN, {
      rings: 3,
      segs: 5,
      rough: 0.3,
      squash: 0.8,
    });
  }
  function bush(x, y, z, r, hex) {
    blob(x, y + r * 0.35, z, r, hex, MAT.LEAF, {rings: 4, segs: 7, squash: 0.7, seed: x * 0.3});
    blob(x + r * 0.55, y + r * 0.25, z + r * 0.2, r * 0.65, tone(hex, 1.08), MAT.LEAF, {
      rings: 3,
      segs: 6,
      squash: 0.75,
      seed: z,
    });
  }

  // ── Condomínio (organização informada pelo usuário; dimensões ilustrativas) ───────────────────────────
  const ranges = [];
  let objectStart = 0;
  const mark = (id) => {
    ranges.push({id, start: objectStart, count: count() - objectStart});
    objectStart = count();
  };
  box(0, -0.7, -7, 34, 0.6, 92, 'b3aa93', MAT.STONE);
  box(0, -0.1, 2, 32, 0.18, 66, 'cbc2ab', MAT.PAVING);
  // Alameda central em pedra mais escura.
  box(0, 0.08, 1, 9.6, 0.03, 63, 'b8ad95', MAT.PAVING);
  function house(n, x, z) {
    objectStart = count();
    const id = 'c' + String(n).padStart(2, '0'),
      face = x > 0 ? -1 : 1,
      fx = x + face * 3.9;
    box(x, 0.2, z, 7.8, 5.3, 6.4, 'dcb455', MAT.WALL);
    box(x, 0.2, z, 7.9, 0.45, 6.5, 'a99877', MAT.STONE);
    roof(x, 5.5, z, 8.6, 7, {wall: 'dcb455'});
    // Garagem coberta junto à frente.
    box(x + face * 4.2, 0.12, z, 2.5, 0.15, 6.5, 'a8a597', MAT.CONCRETE);
    roof(x + face * 4.2, 2.6, z, 2.9, 6.7, {rise: 0.7, overhang: 0});
    for (const dz of [-2.9, 2.9]) box(x + face * 5.1, 0.25, z + dz, 0.16, 2.35, 0.16, '6e4c32', MAT.WOOD);
    box(fx + face * 0.04, 0.3, z + 1.65, 0.08, 1.95, 1.1, '6e4a31', MAT.WOOD);
    box(fx + face * 0.02, 2.2, z + 1.65, 0.12, 0.12, 1.3, 'f3ede0', MAT.TRIM);
    for (const level of [1.1, 3.6])
      for (const dz of [-1.7, 1.5]) {
        box(fx + face * 0.04, level, z + dz, 0.12, 1.2, 1.4, 'f4efe2', MAT.TRIM);
        box(fx + face * 0.12, level + 0.08, z + dz, 0.08, 1.04, 1.22, '7a5641', MAT.SHUTTER);
        box(fx + face * 0.16, level - 0.08, z + dz, 0.26, 0.08, 1.55, 'efe8da', MAT.TRIM);
      }
    mark(id);
  }
  for (let i = 0; i < 7; i++) {
    house(i + 1, 11, 27 - i * 8);
    house(i + 8, -11, 27 - i * 8);
  }
  // Churrasqueira após a casa 14.
  objectStart = count();
  box(-11, 0.2, -28, 8, 0.2, 6, 'c9bfa8', MAT.PAVING);
  box(-13, 0.4, -29, 1.5, 2.2, 1.3, '9b6244', MAT.STONE);
  box(-13, 1.3, -28.3, 1.1, 0.7, 0.1, '3b3e35', MAT.METAL);
  box(-13, 2.6, -29, 0.8, 1.2, 0.8, 'a37353', MAT.STONE);
  box(-9, 0.9, -28, 3, 0.15, 1.4, '8c7354', MAT.WOOD);
  for (const zz of [-27, -29]) box(-9, 0.45, zz, 3, 0.15, 0.45, '8c7354', MAT.WOOD);
  mark('bbq');
  // Primeiro patamar: festas à esquerda, jogos à direita.
  box(0, -0.1, -38, 32, 3.1, 14, 'aaa38d', MAT.STONE);
  box(0, 3, -38, 32, 0.15, 14, 'd6ccb6', MAT.PAVING);
  for (let i = 0; i < 12; i++) box(0, 0.1, -27 - i * 0.45, 5, (i + 1) * 0.25, 0.48, 'cfc6b0', MAT.STONE);
  for (const [id, x] of [
    ['party', -10],
    ['games', 10],
  ]) {
    objectStart = count();
    box(x, 3.15, -38, 9, 3, 8, 'd9b153', MAT.WALL);
    roof(x, 6.15, -38, 9.8, 8.8, {wall: 'd9b153'});
    box(x, 3.2, -33.95, 3, 2.3, 0.12, '6f5a3e', MAT.WOOD);
    box(x - 3, 4.1, -33.95, 1.6, 1.1, 0.1, 'f3ede0', MAT.TRIM);
    box(x - 3, 4.16, -33.9, 1.4, 0.98, 0.08, '7a5641', MAT.SHUTTER);
    mark(id);
  }
  // Segundo lance e piscina no patamar mais alto.
  box(0, -0.1, -49, 32, 6.1, 10, 'a9a28d', MAT.STONE);
  box(0, 6, -49, 32, 0.2, 10, 'e2d9c3', MAT.PAVING);
  for (let i = 0; i < 12; i++) box(0, 3.15, -41 - i * 0.3, 5, (i + 1) * 0.25, 0.33, 'd2c9b3', MAT.STONE);
  objectStart = count();
  box(0, 6.2, -49, 13, 0.25, 6, 'f2eadb', MAT.TRIM);
  box(0, 6.46, -49, 11.8, 0.03, 4.8, '39b8c6', MAT.POOL);
  mark('pool');
  // Portão de entrada.
  objectStart = count();
  for (const x of [-4.7, 4.7]) {
    box(x, 0.15, 33, 0.65, 3.2, 0.7, 'f1ede3', MAT.WALL);
    box(x, 3.32, 33, 0.8, 0.14, 0.85, 'e7dfcf', MAT.TRIM);
  }
  roof(0, 3.5, 33, 10.5, 2.8, {overhang: 0});
  for (let x = -4.2; x <= 4.2; x += 0.34) box(x, 0.15, 33, 0.23, 2.8, 0.17, '6a472f', MAT.WOOD);
  for (const x of [-11, 11]) {
    box(x, 0.1, 33, 12, 1.1, 0.5, 'a29a85', MAT.STONE);
    box(x, 1.2, 33, 12, 1.05, 0.45, 'f0ece2', MAT.WALL);
    box(x, 2.25, 33, 12.1, 0.1, 0.6, 'c47e57', MAT.ROOF);
  }
  mark('gate');
  for (const x of [-16, 16]) for (let z = -28; z < 33; z += 7) tree(x, z, 0.95);
  // Jardins laterais, jardineiras floridas e iluminação de escala humana.
  for (const x of [-15.7, 15.7]) {
    box(x, 0.1, 1, 1.1, 0.16, 60, '6f9450', MAT.GRASS);
    for (let z = -27; z < 31; z += 2)
      blob(x, 0.6, z, 0.6, '587d45', MAT.LEAF, {rings: 5, segs: 8, squash: 0.8, seed: z});
  }
  for (let i = 0; i < 7; i++)
    for (const side of [-1, 1]) {
      const x = side * 5.6,
        z = 29.8 - i * 8;
      box(x, 0.15, z, 0.85, 0.55, 1.5, 'b9ab8e', MAT.STONE);
      box(x, 0.71, z, 0.7, 0.04, 1.35, '5f5640', MAT.PLAIN);
      for (let j = 0; j < 3; j++) {
        blob(x, 0.95, z - 0.45 + j * 0.45, 0.36, j % 2 ? '628c49' : '79a05c', MAT.LEAF, {
          rings: 4,
          segs: 7,
          seed: i + j,
        });
        blob(x + 0.12, 1.2, z - 0.4 + j * 0.4, 0.13, i % 2 ? 'f0d27f' : 'e08b8b', MAT.PLAIN, {
          rings: 3,
          segs: 6,
          rough: 0.1,
        });
      }
    }
  for (const x of [-5.3, 5.3])
    for (const z of [24, 8, -8, -24]) {
      cylinder(x, 0.12, z, 0.06, 0.045, 1.75, '3d4741', MAT.METAL, 6);
      box(x, 1.82, z, 0.34, 0.2, 0.34, 'f7ecc8', MAT.TRIM);
      box(x, 2.02, z, 0.46, 0.06, 0.46, '3d4741', MAT.METAL);
    }
  for (const x of [-13, 13]) {
    palm(x, 6.2, -49, 4.8);
    box(x, 6.2, -45.5, 2.4, 0.2, 0.9, 'd8c7a6', MAT.WOOD);
    box(x, 6.4, -45.7, 2.2, 0.28, 0.6, 'f1ebdc', MAT.TRIM);
  }
  for (const x of [-5.5, 5.5]) {
    box(x, 3.2, -36, 1.5, 0.6, 2.5, 'bdb39b', MAT.STONE);
    bush(x, 3.8, -36, 0.8, '5e8a52');
  }
  for (const x of [-14, 14]) palm(x, 0.2, 31, 5);
  // Muro lateral do condomínio, do portão até os patamares, com rufo de cerâmica.
  for (const x of [-17.3, 17.3]) {
    box(x, -0.1, 1, 0.35, 0.5, 64.5, 'a29a85', MAT.STONE);
    box(x, 0.4, 1, 0.33, 1.5, 64.5, 'f0ebe0', MAT.WALL);
    box(x, 1.9, 1, 0.5, 0.12, 64.6, 'c47e57', MAT.ROOF);
  }
  box(-7, 0.2, -28, 1.4, 0.12, 3, '7ea064', MAT.GRASS);
  bush(-7, 0.32, -28, 0.7, '6b9356');
  // Personagens simbólicos, sem representar a aparência de pessoas reais.
  function person(id, x, z, shirt) {
    objectStart = count();
    for (const side of [-1, 1]) {
      box(x + side * 0.2, 0.18, z, 0.27, 1.2, 0.32, '334d46');
      box(x + side * 0.2, 0.17, z + 0.1, 0.32, 0.18, 0.55, '344039');
      box(x + side * 0.55, 1.32, z, 0.24, 0.95, 0.3, shirt);
      blob(x + side * 0.55, 1.28, z, 0.16, 'bc906c', MAT.PLAIN, {rings: 4, segs: 6, rough: 0});
    }
    box(x, 1.3, z, 0.83, 1.1, 0.44, shirt);
    box(x, 2.4, z, 0.22, 0.2, 0.22, 'bc906c');
    blob(x, 2.91, z, 0.4, 'bc906c', MAT.PLAIN, {rings: 6, segs: 10, rough: 0, squash: 1});
    blob(x, 3.15, z - 0.04, 0.34, '53483d', MAT.PLAIN, {rings: 5, segs: 8, rough: 0.05});
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
  // Quadro de madeira e folhas na entrada da alameda.
  objectStart = count();
  for (const x of [-4.75, -2.25]) box(x, 0.15, 27, 0.15, 3.2, 0.18, '73583d', MAT.WOOD);
  box(-3.5, 1.28, 27, 3.1, 2.15, 0.22, '73583d', MAT.WOOD);
  box(-3.5, 1.4, 27.14, 2.85, 1.88, 0.08, 'b69563', MAT.WOOD);
  for (const [x, y] of [
    [-4.32, 2.4],
    [-3.48, 2.25],
    [-2.7, 2.4],
  ]) {
    box(x, y - 0.55, 27.21, 0.62, 1, 0.025, 'f1ecda', MAT.TRIM);
    box(x, y + 0.42, 27.24, 0.08, 0.08, 0.03, 'a9543f');
    for (let i = 0; i < 3; i++) box(x, y + 0.1 - i * 0.17, 27.24, 0.4, 0.025, 0.01, '8a927c');
  }
  mark('noticeboard');
  const exteriorCount = count();

  // ── Interior conceitual (sala, cozinha e jardim vistos da entrada) ──────────────────────────────────────
  box(0, -0.2, 0, 16, 0.2, 16, 'bda98b', MAT.WOOD);
  box(0, 0, -6, 16, 4.7, 0.18, 'eee8d9', MAT.WALL);
  box(-8, 0, 0, 0.18, 4.7, 12, 'dfd9c9', MAT.WALL);
  box(-3, 1, -5.85, 6, 2.8, 0.08, '91b7b2', MAT.POOL);
  for (const x of [-6, -3, 0]) box(x, 1, -5.7, 0.08, 2.8, 0.12, 'f8f3e7', MAT.TRIM);
  box(-3, 2.5, -5.7, 6, 0.08, 0.12, 'f8f3e7', MAT.TRIM);
  box(-3, 0, -5.6, 6, 0.15, 0.5, 'e4d6be');
  box(-3, 0.03, 1, 7, 0.035, 5, 'd8d9c5');
  box(-4, 0.25, -1, 4.8, 0.65, 1.8, 'e8dfcb');
  box(-4, 0.9, -1.7, 4.8, 0.75, 0.4, 'd9cdb5');
  for (const x of [-6.3, -1.7]) box(x, 0.6, -1, 0.35, 0.7, 1.9, 'd9cdb5');
  for (const x of [-5.3, -3.9, -2.5]) box(x, 0.91, -1, 1.25, 0.2, 1.05, 'f2ecdf');
  box(-3, 0.35, 1.3, 2.8, 0.15, 1.35, '987958', MAT.WOOD);
  box(-3, 0.05, 1.3, 2, 0.3, 0.9, '6e5947', MAT.WOOD);
  box(-3, 0.51, 1.2, 0.6, 0.06, 0.4, '466e65');
  box(-2.2, 0.51, 1.4, 0.25, 0.25, 0.25, 'eee7d3');
  box(4, 0, -4.8, 6, 1.15, 1.6, '698378');
  box(4, 1.15, -4.8, 6, 0.12, 1.7, 'efe8d8', MAT.TRIM);
  for (const x of [2, 3.5, 5, 6.5]) box(x, 0.45, -3.96, 0.06, 0.06, 0.04, 'd5bd88', MAT.METAL);
  box(5.8, 0, -2, 2.8, 1.1, 1.3, '8c9c87');
  box(5.8, 1.1, -2, 3, 0.12, 1.5, 'f0e7d7', MAT.TRIM);
  for (const x of [4.8, 6.5]) {
    box(x, 0.55, -0.6, 0.75, 0.15, 0.75, '987958', MAT.WOOD);
    box(x, 0, -0.6, 0.12, 0.6, 0.12, '515e54', MAT.METAL);
  }
  box(2, 1.9, -5.8, 1.5, 1.7, 0.1, 'a78860', MAT.WOOD);
  box(2, 2.05, -5.7, 1.2, 1.4, 0.03, '718b80');
  box(-7, 0, -4, 0.7, 0.7, 0.7, 'b39571', MAT.STONE);
  tree(-7, -4, 1.1, 0);
  cylinder(1, 0, 3, 0.07, 0.06, 2.9, '646a58', MAT.METAL, 6);
  box(1, 2.7, 3, 1.1, 0.5, 1.1, 'eee0bf', MAT.TRIM);
  for (let i = 0; i < 10; i++) box(7, 0, 3 - i * 0.5, 1.5, (i + 1) * 0.27, 0.5, 'b4a083', MAT.WOOD);
  box(5, 0, -5, 1, 1, 0.8, 'eae5d9');
  box(5, 0.3, -4.58, 0.65, 0.55, 0.04, '99aaa6');
  const interiorCount = count() - exteriorCount;
  const upperStart = count();
  box(0, -0.2, 0, 16, 0.2, 16, 'bda98b', MAT.WOOD);
  box(0, 0, -6, 16, 4.7, 0.18, 'eee8d9', MAT.WALL);
  box(-8, 0, 0, 0.18, 4.7, 12, 'dfd9c9', MAT.WALL);
  box(-4, 1.4, -5.85, 3.5, 2, 0.08, '91b7b2', MAT.POOL);
  box(-4, 2.4, -5.7, 3.5, 0.08, 0.12, 'f8f3e7', MAT.TRIM);
  box(-3, 0.2, -2, 3.6, 0.5, 4.6, '927b5b', MAT.WOOD);
  box(-3, 0.7, -2, 3.5, 0.35, 4.5, 'e6e0ce');
  box(-3, 1.05, -3.4, 3.3, 0.15, 1.2, 'f5f0df');
  box(-3, 1.05, -0.8, 3.5, 0.06, 2.1, '859c83');
  box(-3, 0.3, -4.4, 3.8, 1.5, 0.18, 'a88b64', MAT.WOOD);
  box(-6, 0.1, -3.4, 1, 0.7, 1, 'a88b64', MAT.WOOD);
  box(3.1, 0, -3, 0.18, 3.1, 6, 'd6ded4', MAT.WALL);
  box(5.5, 0.02, -3, 4.5, 0.1, 6, 'c8d6cd', MAT.PAVING);
  box(6, 0, -4.5, 2, 0.15, 2, 'eceee2', MAT.TRIM);
  box(6, 2.4, -5.4, 0.8, 0.08, 0.8, '758b85', MAT.METAL);
  box(6, 1, -5.4, 0.06, 1.4, 0.06, '758b85', MAT.METAL);
  box(4.4, 0.7, -2, 1.8, 0.25, 1, 'f1eee3', MAT.TRIM);
  box(4.4, 1.5, -5.8, 1.6, 1.5, 0.08, '8fa9a3', MAT.POOL);
  box(6, 0.1, -1, 0.8, 0.55, 1.2, 'f1eee3', MAT.TRIM);
  const upperCount = count() - upperStart;

  // ── Paisagem do litoral: restinga, enseada, mar até o horizonte, morros, ilha, costão, coqueiros, barcos ─
  const sceneryStart = count();
  const SEA_LEVEL = -0.9,
    shoreZ = (x) => -128 - 0.00022 * x * x + 6 * Math.sin(x / 53 + 1.3),
    HILLS = [
      [-250, -205, 105, 30],
      [270, -235, 115, 26],
      [-40, -640, 95, 24],
      [520, 260, 190, 38],
      [-540, 220, 200, 34],
    ];
  const lotDistance = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - 17), Math.max(0, -54 - z, z - 39)),
    lotLevel = (z) => (z < -44 ? 5.9 : z < -31 ? 2.9 : -0.7);
  function terrainHeight(x, z) {
    const inland = z - shoreZ(x),
      far = smoothstep(40, 320, lotDistance(x, z));
    let h = -0.5 + (noise(x / 38, z / 38) - 0.5) * 3.2 * far + (noise(x / 9, z / 9) - 0.5) * 0.4;
    h = inland < 0 ? SEA_LEVEL + inland * 0.05 : Math.min(h, SEA_LEVEL + inland * 0.03);
    // Duna baixa entre o condomínio e a praia, só em terra firme (um max no mar o aterraria).
    if (inland > 12)
      h = Math.max(
        h,
        -0.5 +
          3.1 *
            Math.exp(-((z + 78) ** 2) / 300) *
            (1 - smoothstep(50, 140, Math.abs(x))) *
            smoothstep(12, 36, inland),
      );
    for (const [hx, hz, r, hh] of HILLS) {
      const dist = Math.hypot(x - hx, z - hz) / r;
      h = Math.max(h, hh * Math.exp(-dist * dist * 1.6) * (0.85 + 0.3 * noise(x / 25, z / 25)) - 1.5);
    }
    const lot = 1 - smoothstep(0, 16, lotDistance(x, z));
    return h * (1 - lot) + lotLevel(z) * lot;
  }
  const SAND = color('efe2c4'),
    SAND_DARK = color('dccaa2'),
    WET = color('c3ad85'),
    SCRUB = color('8a9b5a'),
    SCRUB_DRY = color('cfc296'),
    FOREST = color('587a40'),
    ROCK = color('8a8275'),
    LAWN = color('8fab63');
  function groundColor(x, z, h, slope) {
    const inland = z - shoreZ(x),
      n = noise(x / 14, z / 14),
      patch = smoothstep(0.55, 0.82, noise(x / 30 + 5, z / 30));
    if (h > 2.4) {
      if (slope > 0.55) return mix(ROCK, SCRUB, n * 0.4);
      return mix(SCRUB, FOREST, smoothstep(6, 20, h) * (0.6 + 0.4 * n));
    }
    if (h < SEA_LEVEL + 0.35 || inland < 3) return WET;
    if (inland < 40) return mix(SAND, SAND_DARK, n * 0.6);
    if (lotDistance(x, z) < 12) return mix(LAWN, SCRUB, n * 0.4);
    return mix(mix(SCRUB_DRY, SAND, n * 0.6), SCRUB, patch * 0.85);
  }
  const xs = [],
    zs = [];
  for (let x = -720; x <= 720; x += 24) xs.push(x);
  for (let z = -720; z < -180; z += 40) zs.push(z);
  for (let z = -180; z < -96; z += 5) zs.push(z);
  for (let z = -96; z <= 720; z += 24) zs.push(z);
  const cells = zs.map((z) =>
    xs.map((x) => {
      const h = terrainHeight(x, z),
        e = 2.5,
        n = unit([
          terrainHeight(x - e, z) - terrainHeight(x + e, z),
          2 * e,
          terrainHeight(x, z - e) - terrainHeight(x, z + e),
        ]);
      return {p: [x, h, z], n, c: groundColor(x, z, h, 1 - n[1])};
    }),
  );
  const insideLot = (q) => Math.abs(q.p[0]) < 17 && q.p[2] > -54 && q.p[2] < 39;
  for (let i = 0; i < zs.length - 1; i++)
    for (let j = 0; j < xs.length - 1; j++) {
      const q = [cells[i][j], cells[i][j + 1], cells[i + 1][j + 1], cells[i + 1][j]];
      if (q.every((g) => g.p[1] < SEA_LEVEL - 0.4) || q.every(insideLot)) continue;
      for (const k of [0, 1, 2, 0, 2, 3]) push(q[k].p, q[k].n, q[k].c, MAT.TERRAIN);
    }
  // Mar: cor-base do raso ao profundo (o shader põe ondas, reflexo do céu e brilho do sol).
  const SHALLOW = color('58cfc4'),
    LAGOON = color('1fa8b6'),
    DEEP = color('117094'),
    OPEN = color('0b4c74');
  const seaColor = (x, z) => {
    const off = shoreZ(x) - z;
    return off < 60
      ? mix(SHALLOW, LAGOON, off / 60)
      : off < 260
        ? mix(LAGOON, DEEP, (off - 60) / 200)
        : mix(DEEP, OPEN, (off - 260) / 700);
  };
  const seaXs = [-3200, -1200];
  for (let x = -1100; x <= 1100; x += 50) seaXs.push(x);
  seaXs.push(1200, 3200);
  const seaZs = [-96, -115, -130, -150, -175, -205, -245, -300, -380, -500, -700, -1000, -1500, -2200, -3200];
  for (let i = 0; i < seaZs.length - 1; i++)
    for (let j = 0; j < seaXs.length - 1; j++) {
      const q = [
        [seaXs[j], seaZs[i]],
        [seaXs[j + 1], seaZs[i]],
        [seaXs[j + 1], seaZs[i + 1]],
        [seaXs[j], seaZs[i + 1]],
      ];
      for (const k of [0, 1, 2, 0, 2, 3])
        push([q[k][0], SEA_LEVEL, q[k][1]], [0, 1, 0], seaColor(q[k][0], q[k][1]), MAT.SEA);
    }
  const FAR_LAND = mix(SCRUB_DRY, SCRUB, 0.35);
  for (const [x0, x1, z0, z1] of [
    [-3200, -720, -260, 3200],
    [720, 3200, -260, 3200],
    [-720, 720, 720, 3200],
  ])
    quad([x0, -0.6, z0], [x1, -0.6, z0], [x1, -0.6, z1], [x0, -0.6, z1], FAR_LAND, MAT.TERRAIN, [0, 1, 0]);
  // Espuma da arrebentação e uma segunda linha de onda.
  const FOAM = [0.97, 0.98, 0.96];
  for (let x = -700; x < 700; x += 6) {
    const z1 = shoreZ(x),
      z2 = shoreZ(x + 6),
      y = SEA_LEVEL + 0.12,
      ripple = 0.6 + noise(x / 20, 3) * 1.6;
    quad(
      [x, y, z1 - ripple],
      [x + 6, y, z2 - ripple],
      [x + 6, y, z2 + 0.6],
      [x, y, z1 + 0.6],
      FOAM,
      MAT.FOAM,
      [0, 1, 0],
    );
    if (noise(x / 30, 7) > 0.42) {
      const wave = mix(LAGOON, FOAM, 0.6),
        w1 = z1 - 9 - noise(x / 15, 9) * 4,
        w2 = z2 - 9 - noise((x + 6) / 15, 9) * 4;
      quad(
        [x, SEA_LEVEL + 0.06, w1 - 0.5],
        [x + 6, SEA_LEVEL + 0.06, w2 - 0.5],
        [x + 6, SEA_LEVEL + 0.06, w2 + 0.5],
        [x, SEA_LEVEL + 0.06, w1 + 0.5],
        wave,
        MAT.FOAM,
        [0, 1, 0],
      );
    }
  }
  // Estrada de acesso ao portão.
  for (let z = 40; z < 620; z += 12) {
    const y1 = terrainHeight(0, z) + 0.08,
      y2 = terrainHeight(0, z + 12) + 0.08;
    for (const [x0, x1, hex, m] of [
      [-3.6, 3.6, '7d7a74', MAT.ASPHALT],
      [-4.4, -3.6, 'd6cebb', MAT.CONCRETE],
      [3.6, 4.4, 'd6cebb', MAT.CONCRETE],
    ])
      quad([x0, y1, z], [x1, y1, z], [x1, y2, z + 12], [x0, y2, z + 12], color(hex), m, [0, 1, 0]);
  }
  // Costão rochoso onde morros e ilha encontram o mar.
  const ROCKS = ['8e877b', '7e786d', '9a9283'];
  for (const [hx, hz, r] of HILLS.slice(0, 3)) {
    let placed = 0;
    for (let tries = 0; tries < 90 && placed < 12; tries++) {
      const a = random() * Math.PI * 2,
        d = r * (0.6 + random() * 1.1),
        x = hx + Math.cos(a) * d,
        z = hz + Math.sin(a) * d,
        h = terrainHeight(x, z);
      if (h < SEA_LEVEL - 1.5 || h > SEA_LEVEL + 1.8 || z > shoreZ(x) + 6) continue;
      const size = 2.2 + random() * 4.2;
      blob(x, SEA_LEVEL + size * 0.12, z, size, ROCKS[placed % 3], MAT.ROCK, {
        rings: 4,
        segs: 7,
        squash: 0.55,
        rough: 0.35,
        seed: x,
      });
      placed++;
    }
  }
  for (let x = -280; x <= 280; x += 24 + random() * 20) {
    const z = shoreZ(x) + 20 + random() * 16;
    palm(x, terrainHeight(x, z) - 0.1, z, 4.6 + random() * 1.4);
  }
  const BUSHES = ['67874a', '78985a', '5a7a41', '86a064', '6d8d55'];
  for (let k = 0; k < 115; k++) {
    const near = k < 80,
      x = (random() - 0.5) * (near ? 200 : 760),
      z = -110 + random() * (near ? 250 : 560),
      inland = z - shoreZ(x);
    if (lotDistance(x, z) < 8 || (Math.abs(x) < 9 && z > 38) || inland < 38) continue;
    bush(x, terrainHeight(x, z), z, 0.7 + random() * 1.1, BUSHES[k % 5]);
  }
  for (let k = 0; k < 60; k++) {
    const [hx, hz, r] = HILLS[k % HILLS.length],
      a = random() * Math.PI * 2,
      d = random() * r * 0.75,
      x = hx + Math.cos(a) * d,
      z = hz + Math.sin(a) * d,
      h = terrainHeight(x, z);
    if (h < 3) continue;
    const s = 2.6 + random() * 3;
    blob(x, h + s * 0.45, z, s, BUSHES[(k + 2) % 5], MAT.LEAF, {rings: 4, segs: 7, squash: 0.8, seed: x});
  }
  for (const [x, z, stripe] of [
    [-62, -228, 'c8473b'],
    [28, -252, '2f6fb0'],
    [96, -214, 'e2ae2f'],
    [-150, -296, '3f8f5a'],
    [182, -330, 'c8473b'],
  ]) {
    box(x, SEA_LEVEL - 0.35, z, 2.4, 1.2, 6.4, 'f4f1ea', MAT.TRIM);
    box(x, SEA_LEVEL - 0.3, z - 3.9, 1.4, 1.15, 1.6, 'f4f1ea', MAT.TRIM);
    box(x, SEA_LEVEL + 0.6, z, 2.5, 0.24, 6.5, stripe, MAT.TRIM);
    box(x, SEA_LEVEL + 0.84, z + 1.2, 1.7, 1.2, 2.2, 'faf8f2', MAT.TRIM);
    box(x, SEA_LEVEL + 2.04, z + 1.2, 1.9, 0.14, 2.4, stripe, MAT.TRIM);
    box(x, SEA_LEVEL + 0.84, z - 1.4, 0.14, 3.6, 0.14, '7a5a3c', MAT.WOOD);
  }
  const sceneryCount = count() - sceneryStart;

  // ── Céu (sem luz, sem neblina): degradê do horizonte enevoado ao azul, com o clarão do sol ──────────────
  const skyStart = count(),
    HAZE = [0.86, 0.92, 0.95],
    SKY_LOW = [0.7, 0.85, 0.95],
    ZENITH = [0.36, 0.62, 0.88],
    GLOW = [1, 0.95, 0.84],
    skyColor = (dir) => {
      const e = Math.asin(Math.max(-1, Math.min(1, dir[1]))),
        base =
          e <= 0 ? HAZE : e < 0.16 ? mix(HAZE, SKY_LOW, e / 0.16) : mix(SKY_LOW, ZENITH, (e - 0.16) / 1.1),
        g = Math.max(0, dot(dir, SUN));
      return mix(base, GLOW, Math.pow(g, 6) * 0.55);
    },
    rings = [-0.25, 0, 0.03, 0.08, 0.16, 0.28, 0.45, 0.7, 1, 1.3, Math.PI / 2],
    skyDir = (e, a) => [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < 48; j++) {
      const a0 = (j / 48) * Math.PI * 2,
        a1 = ((j + 1) / 48) * Math.PI * 2,
        d = [skyDir(rings[i], a0), skyDir(rings[i], a1), skyDir(rings[i + 1], a1), skyDir(rings[i + 1], a0)],
        p = d.map((u) => u.map((c) => c * 3300));
      for (const k of [0, 1, 2, 0, 2, 3]) push(p[k], [0, 1, 0], skyColor(d[k]), MAT.SKY);
    }
  const skyCount = count() - skyStart;

  return {
    data: new Float32Array(v),
    ranges,
    exteriorCount,
    interiorStart: exteriorCount,
    interiorCount,
    upperStart,
    upperCount,
    sceneryStart,
    sceneryCount,
    skyStart,
    skyCount,
    fogColor: HAZE,
  };
}
