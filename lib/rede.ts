// O prazo abrange os cabeçalhos e o corpo. Não repete mutações automaticamente.
export async function fetchComTimeout(input: RequestInfo | URL, init: RequestInit = {}, prazo = 15_000): Promise<Response> {
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  if (init.signal?.aborted) cancelar();
  init.signal?.addEventListener("abort", cancelar, { once: true });
  const timer = setTimeout(cancelar, prazo);
  try {
    const resposta = await fetch(input, { ...init, signal: controller.signal });
    const corpo = await resposta.arrayBuffer();
    return new Response(resposta.status === 204 || resposta.status === 205 || resposta.status === 304 ? null : corpo, {
      status: resposta.status, statusText: resposta.statusText, headers: resposta.headers,
    });
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancelar);
  }
}
