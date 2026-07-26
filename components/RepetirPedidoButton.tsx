"use client";

type ItemParaRepetir = {
  id: string;
  nome: string;
  quantidade: number;
};

export default function RepetirPedidoButton({
  itens,
  teveAjustes,
}: {
  itens: ItemParaRepetir[];
  teveAjustes: boolean;
}) {
  function repetirPedido() {
    if (itens.length === 0) {
      window.alert(
        "Os produtos deste pedido não estão disponíveis no estoque no momento."
      );
      return;
    }

    const carrinhoAtual = window.localStorage.getItem("guetto_carrinho");
    if (
      carrinhoAtual &&
      carrinhoAtual !== "[]" &&
      !window.confirm(
        "Seu carrinho atual será substituído pelos itens deste pedido. Deseja continuar?"
      )
    ) {
      return;
    }

    window.localStorage.setItem("guetto_carrinho", JSON.stringify(itens));
    window.localStorage.setItem("guetto_abrir_carrinho", "1");

    if (teveAjustes) {
      window.alert(
        "Alguns produtos sem estoque não puderam ser adicionados. Confira o carrinho antes de finalizar."
      );
    }

    window.location.assign("/");
  }

  return (
    <button
      type="button"
      onClick={repetirPedido}
      className="mt-6 w-full rounded-xl bg-yellow-400 px-5 py-3 font-black text-black transition hover:bg-yellow-300"
    >
      Repetir pedido
    </button>
  );
}
