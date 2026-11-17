/**
 * Para onde voltar depois de entrar ou confirmar o código. Só caminho INTERNO: começa com uma barra e não é seguido
 * de outra barra nem de barra invertida (`//site` e `/\site` levam para fora — lição de outro projeto). Sem
 * caracteres de controle. Qualquer outra coisa volta para o início.
 */
export function safeNext(value: string | null | undefined, fallback = '/minha-casa'): string {
  if (!value || value.length > 300) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (/^\/(entrar|convite)(\/|$|\?)/.test(value)) return fallback;
  return value;
}
