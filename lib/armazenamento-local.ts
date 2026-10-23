// A persistência é opcional: bloqueio de cookies ou falta de espaço não pode
// interromper a abertura do catálogo nem as ações do cliente.
export const armazenamentoLocal = {
  getItem(chave: string): string | null {
    try {
      return window.localStorage.getItem(chave);
    } catch {
      return null;
    }
  },
  setItem(chave: string, valor: string): void {
    try {
      window.localStorage.setItem(chave, valor);
    } catch {
      // O estado React continua disponível durante o uso da página.
    }
  },
  removeItem(chave: string): void {
    try {
      window.localStorage.removeItem(chave);
    } catch {
      // O navegador pode negar acesso até para remover dados.
    }
  },
};
