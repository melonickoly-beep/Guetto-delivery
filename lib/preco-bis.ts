export function ehChocolateBis(nome: string) {
  return /^chocolate\s+bis\s*-\s*(original|branco)$/i.test(nome.trim());
}

type ItemBis = { nome: string; quantidade: number };

// Divide o desconto entre os sabores, mantendo o total exato em centavos.
export function subtotalChocolateBis(itens: ItemBis[], indice: number) {
  if (!itens[indice] || !ehChocolateBis(itens[indice].nome)) return null;
  const quantidade = itens.reduce((total, item) =>
    total + (ehChocolateBis(item.nome) ? item.quantidade : 0), 0);
  if (quantidade <= 0) return 0;
  const centavos = Math.floor(quantidade / 3) * 1800 + (quantidade % 3) * 700;
  const anteriores = itens.slice(0, indice).reduce((total, item) =>
    total + (ehChocolateBis(item.nome) ? item.quantidade : 0), 0);
  return (Math.round(centavos * (anteriores + itens[indice].quantidade) / quantidade)
    - Math.round(centavos * anteriores / quantidade)) / 100;
}
