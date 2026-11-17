/**
 * Limite de tentativas de entrada (lição do app anterior, LIC-595): por ENDEREÇO conta só as falhas (quem acerta
 * não gasta a cota de quem divide a rede) e por CONTA, para ataque espalhado por vários endereços — inclusive
 * e-mail sem conta, para não revelar quem existe. Memória do processo (uma instância no piloto); passa ao banco
 * quando houver mais de uma instância.
 */
export const ACCOUNT_LIMIT = 10;
export const ADDRESS_LIMIT = 25;
export const WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 10_000;

type Bucket = {count: number; until: number};

export class LoginLimiter {
  private readonly byAccount = new Map<string, Bucket>();
  private readonly byAddress = new Map<string, Bucket>();

  constructor(private readonly now: () => number) {}

  private sweep(map: Map<string, Bucket>) {
    const t = this.now();
    for (const [k, v] of map) if (v.until <= t) map.delete(k);
  }

  /** `null` se pode tentar; senão o motivo do bloqueio. */
  blocked(account: string, address: string): 'conta' | 'endereco' | null {
    this.sweep(this.byAccount);
    this.sweep(this.byAddress);
    if ((this.byAccount.get(account)?.count ?? 0) >= ACCOUNT_LIMIT) return 'conta';
    if ((this.byAddress.get(address)?.count ?? 0) >= ADDRESS_LIMIT) return 'endereco';
    return null;
  }

  failed(account: string, address: string) {
    for (const [map, key] of [
      [this.byAccount, account],
      [this.byAddress, address],
    ] as const) {
      if (map.size >= MAX_KEYS && !map.has(key)) continue;
      const b = map.get(key) ?? {count: 0, until: this.now() + WINDOW_MS};
      b.count++;
      map.set(key, b);
    }
  }

  succeeded(account: string) {
    this.byAccount.delete(account);
  }
}
