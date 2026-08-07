// Thin session layer for the /admin product-intake panel. It authenticates
// against the same ERP the main NestJS API serves (POST /auth/login, then
// PATCH /auth/select-tenant/:slug) and only lets in users who have a
// membership in the tenant this storefront is configured for
// (PUBLIC_TENANT_SLUG) — a user's ERP account may belong to other tenants too,
// those are ignored here.
const TOKEN_KEY = 'orbix_admin_token';

interface RgConfig {
  apiUrl?: string;
  tenantSlug?: string;
}

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}

function getConfig(): { apiUrl: string; tenantSlug: string } {
  const cfg = (window as unknown as { RG_CONFIG?: RgConfig }).RG_CONFIG || {};
  if (!cfg.apiUrl || !cfg.tenantSlug) {
    throw new Error('Falta configurar RG_CONFIG.apiUrl / tenantSlug');
  }
  return { apiUrl: cfg.apiUrl, tenantSlug: cfg.tenantSlug };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Two-step ERP login: preliminary JWT + availableTenants, then select-tenant. */
export async function login(email: string, password: string): Promise<void> {
  const { apiUrl, tenantSlug } = getConfig();

  const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(await readError(loginRes, 'Credenciales incorrectas.'));
  }
  const loginBody = (await loginRes.json()) as {
    accessToken: string;
    availableTenants?: TenantSummary[];
  };

  const membership = (loginBody.availableTenants || []).find((t) => t.slug === tenantSlug);
  if (!membership) {
    throw new Error('Tu usuario no tiene acceso a esta tienda.');
  }

  const selectRes = await fetch(`${apiUrl}/api/auth/select-tenant/${tenantSlug}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  if (!selectRes.ok) {
    throw new Error(await readError(selectRes, 'No se pudo entrar a la tienda.'));
  }
  const selectBody = (await selectRes.json()) as { accessToken: string };

  setToken(selectBody.accessToken);
}

/** Fetch against the Orbix API with the stored session token attached. */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { apiUrl } = getConfig();
  const token = getToken();
  if (!token) throw new Error('NO_SESSION');

  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearSession();
    throw new Error('SESSION_EXPIRED');
  }
  return res;
}

/** Redirects to /admin/login when there's no session. Returns whether one exists. */
export function requireSession(): boolean {
  if (!getToken()) {
    window.location.href = '/admin/login';
    return false;
  }
  return true;
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    // best-effort revoke — always clear local session below
  }
  clearSession();
  window.location.href = '/admin/login';
}
