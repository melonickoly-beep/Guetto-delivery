import { administradorAutorizado } from "./admin-autorizado";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function criarSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components não podem alterar cookies. O middleware renova a sessão.
          }
        },
      },
    }
  );
}

export async function obterAdministrador() {
  const supabase = await criarSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const emailPermitido = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!administradorAutorizado(user, process.env.ADMIN_USER_ID, emailPermitido)) return null;

  return user;
}
