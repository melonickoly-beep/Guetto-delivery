export type TentativaPedido = { chave: string; assinatura: string; confirmado?: boolean };

const CHAVE_STORAGE = "guetto_tentativa_pedido";

// Somente para uma nova compra explicitamente solicitada, nunca para retry.
export function iniciarTentativaNovaCompra(storage: Pick<Storage, "setItem" | "removeItem">): TentativaPedido {
  const tentativa = { chave: crypto.randomUUID(), assinatura: "" };
  storage.setItem(CHAVE_STORAGE, JSON.stringify(tentativa));
  storage.removeItem("guetto_mensagem_pendente");
  return tentativa;
}

export async function obterTentativaPedido(
  corpo: string,
  anterior: TentativaPedido | null,
  storage: Pick<Storage, "getItem" | "setItem"> | null
): Promise<TentativaPedido> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(corpo));
  const assinatura = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  let salva = anterior;
  try {
    if (!salva && storage) salva = JSON.parse(storage.getItem(CHAVE_STORAGE) ?? "null");
  } catch { /* Navegação sem armazenamento continua protegida em memória. */ }
  // A chave identifica o ciclo de compra. Correções após erro mantêm a chave:
  // se o servidor já gravou outra versão, ele recusa a alteração sem duplicar.
  const tentativa = { chave: typeof salva?.chave === "string" && !salva.confirmado ? salva.chave : crypto.randomUUID(), assinatura };
  try { storage?.setItem(CHAVE_STORAGE, JSON.stringify(tentativa)); } catch { /* Usar memória. */ }
  return tentativa;
}

export function confirmarTentativaPedido(tentativa: TentativaPedido, storage: Pick<Storage, "setItem"> | null): TentativaPedido {
  const confirmada = { ...tentativa, confirmado: true };
  try { storage?.setItem(CHAVE_STORAGE, JSON.stringify(confirmada)); } catch { /* A confirmação também fica em memória. */ }
  return confirmada;
}

export function limparTentativaPedido(chave: string, storage: Pick<Storage, "getItem" | "removeItem"> | null) {
  try {
    if (JSON.parse(storage?.getItem(CHAVE_STORAGE) ?? "null")?.chave === chave) {
      storage?.removeItem(CHAVE_STORAGE);
    }
  } catch { /* A confirmação do pedido independe do armazenamento local. */ }
}
