export const COPOS_COM_CANUDO_ID = "6ba865f2-1e6d-42c9-8185-8df23ed93af9";
export const COPOS_POR_COMBO = 3;
export const GELOS_POR_COMBO = 6;

export const ehComboComEstoqueCompartilhado = (produto: { nome: string }) =>
  produto.nome.trim().toLowerCase().startsWith("combo ");
