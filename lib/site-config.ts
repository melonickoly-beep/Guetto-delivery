// Altere para false somente quando a loja estiver pronta para receber pedidos.
export const SITE_EM_MANUTENCAO = false;

export const INICIO_MANUTENCAO = Date.parse("2026-09-30T21:00:00-03:00");
export const FIM_MANUTENCAO = Date.parse("2026-10-01T10:00:00-03:00");

export function siteEmManutencao(agora = Date.now()) {
  return SITE_EM_MANUTENCAO || (agora >= INICIO_MANUTENCAO && agora < FIM_MANUTENCAO);
}

export function horarioAberturaDoDia(configurado: string, agora = Date.now()) {
  return agora >= Date.parse("2026-10-01T00:00:00-03:00") &&
    agora < Date.parse("2026-10-02T00:00:00-03:00") ? "10:00" : configurado;
}
