export function alertaConfigurado(env?: NodeJS.ProcessEnv): boolean;
export function enviarAlerta(evento: string, status?: number, env?: NodeJS.ProcessEnv, requisitar?: typeof fetch): Promise<void>;
