// Executado pelo painel: o fechamento não depende de scripts da janela filha.
export function imprimirEFecharJanela(janela: Window) {
  const fechar = () => {
    if (!janela.closed) janela.close();
  };
  const agendarFechamento = () => window.setTimeout(fechar, 0);

  janela.addEventListener("afterprint", agendarFechamento, { once: true });

  window.setTimeout(() => {
    if (janela.closed) return;
    janela.focus();
    // No Chrome, print retorna quando o diálogo é fechado. O segundo caminho
    // também fecha a janela quando o navegador não dispara afterprint.
    janela.print();
    agendarFechamento();
  }, 250);
}
