import {describe, expect, it} from 'vitest';
import {safeNext} from './redirect';

describe('retorno depois de entrar', () => {
  it('aceita caminho interno', () => {
    expect(safeNext('/conta/sessoes')).toBe('/conta/sessoes');
    expect(safeNext('/minha-casa?x=1')).toBe('/minha-casa?x=1');
  });

  it('recusa tudo que leva para fora ou volta para entrar', () => {
    for (const ruim of [
      'https://outro.exemplo',
      '//outro.exemplo',
      '/\\outro.exemplo',
      '\\\\outro.exemplo',
      'javascript:alert(1)',
      '/entrar',
      '/convite/abc',
      '/a\u0000b',
      '/a\nb',
      '',
      null,
      undefined,
      '/' + 'x'.repeat(400),
    ])
      expect(safeNext(ruim)).toBe('/minha-casa');
  });
});
