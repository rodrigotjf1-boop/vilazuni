import {useEffect, useRef, useState} from 'react';
import type {WorldRenderer} from '../cena/world-renderer.js';

type Estado = 'carregando' | '3d' | 'estatica';

/**
 * Fundo da tela de entrada: o cenário 3D aprovado em 12/11 (ADR-0001), decorativo — sem foco, sem toque, escondido
 * do leitor de tela. Carrega à parte (o formulário aparece na hora). Aparelho fraco ganha uma tomada parada; com
 * "reduzir movimento", o próprio cenário fica na primeira tomada; sem WebGL, fica o fundo na cor da marca.
 */
export function CenaEntrada() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [estado, setEstado] = useState<Estado>('carregando');

  useEffect(() => {
    let renderer: WorldRenderer | null = null;
    let cancelado = false;
    const nav = navigator as Navigator & {deviceMemory?: number};
    const fraco = (nav.hardwareConcurrency ?? 4) <= 2 || (nav.deviceMemory ?? 4) <= 2;
    import('../cena/world-renderer.js')
      .then(({createWorldRenderer}) => {
        if (cancelado || !canvas.current) return;
        try {
          renderer = createWorldRenderer(canvas.current, {onLost: () => setEstado('estatica')});
          renderer.pause(true);
          if (fraco) renderer.renderStill();
          else renderer.setScenic(true);
          setEstado('3d');
        } catch {
          setEstado('estatica');
        }
      })
      .catch(() => setEstado('estatica'));
    return () => {
      cancelado = true;
      renderer?.dispose();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(160deg,var(--color-primaria-clara)_0%,var(--color-fundo)_45%,var(--color-areia)_100%)]"
    >
      <canvas
        ref={canvas}
        tabIndex={-1}
        data-cena={estado}
        className={`h-full w-full transition-opacity duration-700 motion-reduce:transition-none ${estado === '3d' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
