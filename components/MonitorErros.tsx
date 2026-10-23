"use client";
import { useEffect } from "react";
import { registrarErroCliente } from "@/lib/erros-cliente";
export default function MonitorErros() {
  useEffect(() => {
    const erro = (e: Event) => {
      if (e instanceof ErrorEvent) registrarErroCliente("javascript", e.error);
      else registrarErroCliente("recurso");
    };
    const promessa = (e: PromiseRejectionEvent) => registrarErroCliente("promessa", e.reason);
    window.addEventListener("error", erro, true);
    window.addEventListener("unhandledrejection", promessa);
    return () => {
      window.removeEventListener("error", erro, true);
      window.removeEventListener("unhandledrejection", promessa);
    };
  }, []);
  return null;
}
