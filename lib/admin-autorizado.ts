// Ausência de configuração nunca concede acesso administrativo.
export function administradorAutorizado(user: { id: string; email?: string } | null, id?: string, email?: string) {
  return Boolean(user && id?.trim() && email?.trim() && user.id === id.trim() &&
    user.email?.toLowerCase() === email.trim().toLowerCase());
}
