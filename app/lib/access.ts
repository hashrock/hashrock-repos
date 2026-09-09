/**
 * CF Access のセッション Cookie があるか。トップページは Access の外なので
 * これは「管理者本人らしい」という UI 上のヒントでしかない。表示を出し分ける
 * のは /admin へのリンクだけで、非公開データの出し分けには使わないこと。
 */
export function hasAccessSession(cookieHeader: string | undefined): boolean {
  return /(?:^|;\s*)CF_Authorization=/.test(cookieHeader ?? "");
}
