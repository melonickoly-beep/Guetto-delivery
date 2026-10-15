export const ehCopinhoTrots = (produto: { nome: string }) =>
  /^copinhos?\s+trot[’']?s(?:\s*-|\s*$)/i.test(produto.nome.trim());
