export interface AuthUser {
  id: string;
  email: string;
  firmName: string | null;
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "حدث خطأ. حاول مرة أخرى.";
}

export async function apiSignup(body: {
  email: string;
  password: string;
  firmName?: string;
}): Promise<AuthUser> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function apiLogin(body: { email: string; password: string }): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function apiLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function apiMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}
