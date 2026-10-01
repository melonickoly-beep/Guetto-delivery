export function ehSedaZomoPromocional(nome: string) {
  const titulo = nome.trim().toLowerCase().replace(/\s+/g, " ");
  return /^(seda zomo|seda zomo marrom|seda zomo slim branca)$/.test(titulo);
}

export function subtotalSedaZomo(quantidade: number, preco: number) {
  return Math.floor(quantidade / 3) * 10 + (quantidade % 3) * preco;
}
