import {describe, expect, it} from 'vitest';
import {localStayTime, stayTimeInput} from './stay-time';

describe('Horário de estadia', () => {
  it('converte o horário do Chandra mesmo em aparelho configurado em outro fuso', () => {
    const utc = localStayTime('2026-11-27T15:00', 'America/Sao_Paulo');
    expect(utc).toBe('2026-11-27T18:00:00.000Z');
    expect(stayTimeInput(utc, 'America/Sao_Paulo')).toBe('2026-11-27T15:00');
  });

  it('rejeita horário inexistente no início do horário de verão de um condomínio de teste', () => {
    expect(() => localStayTime('2026-03-08T02:30', 'America/New_York')).toThrow('periodo_invalido');
  });
});
