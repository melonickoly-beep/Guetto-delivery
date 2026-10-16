// IDs dos produtos já cadastrados. Manter em sincronia com a migração do combo.
export const COMBO_SMIRNOFF_ID = "de2675a7-665c-4de5-a0c9-ef96e3ee9c10";

export const COMPONENTES_COMBO_SMIRNOFF = [
  { produtoId: "ad5a9fc1-2e7a-4d81-80cd-256953c30142", quantidade: 1 },
  { produtoId: "a8603cba-5779-4437-a1c8-8a1ce4747f6f", quantidade: 1 },
  { produtoId: "bc7c756d-2504-4b4c-a16e-ab735b878ced", quantidade: 1 },
  { produtoId: "6ba865f2-1e6d-42c9-8185-8df23ed93af9", quantidade: 3 },
] as const;

export const ehComboSmirnoff = (produto: { id: string }) =>
  produto.id === COMBO_SMIRNOFF_ID;

export function estoqueComboSmirnoff(
  produtos: ReadonlyArray<{ id: string; estoque: number; disponivel?: boolean }>
) {
  return Math.min(...COMPONENTES_COMBO_SMIRNOFF.map((componente) => {
    const produto = produtos.find((item) => item.id === componente.produtoId);
    return !produto || produto.disponivel === false
      ? 0
      : Math.floor(Math.max(0, produto.estoque) / componente.quantidade);
  }));
}
