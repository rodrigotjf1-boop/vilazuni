/**
 * Cenário 3D da tela de entrada — trazido do app anterior (app/world-renderer.mjs e vizinhos, aprovado pelo dono
 * em 12/11/2026; ADR-0001). WebGL 1 puro, sem biblioteca. Só a parte usada pela v1 está tipada aqui.
 */
export interface WorldRenderer {
  /** pausado não responde a toque nem teclado (fundo decorativo) */
  pause(on: boolean): void;
  /** tomadas de cartão-postal em sequência; com "reduzir movimento" fica na primeira */
  setScenic(on: boolean): void;
  renderStill(): void;
  dispose(): void;
}

export function createWorldRenderer(
  canvas: HTMLCanvasElement,
  callbacks?: {
    onSelect?: (...args: unknown[]) => void;
    onProject?: (...args: unknown[]) => void;
    onChange?: (...args: unknown[]) => void;
    onLost?: () => void;
  },
): WorldRenderer;
