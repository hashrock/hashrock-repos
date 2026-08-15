/**
 * CF Access のセッションが切れると /api/* は cloudflareaccess.com へ 302 される。
 * 通常の fetch はこのリダイレクトを追ってしまい、クロスオリジンのため CORS
 * エラーになって原因が分かりにくい。redirect: "manual" で検知し、トップレベル
 * 遷移でログインし直させる。
 */
export class AccessRedirectError extends Error {
  constructor() {
    super("Cloudflare Access session expired");
    this.name = "AccessRedirectError";
  }
}

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(input, { ...init, redirect: "manual" });

  // クロスオリジンへのリダイレクトは opaqueredirect (status 0) として返る
  if (res.type === "opaqueredirect" || res.status === 0) {
    location.reload();
    throw new AccessRedirectError();
  }

  return res;
}
