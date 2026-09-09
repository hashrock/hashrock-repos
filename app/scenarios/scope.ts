/**
 * DB に撒くシナリオ (admin-*) の隔離単位。
 *
 * 1 回の実行ごとに `scenario-<name>-<rand>` という架空の owner を作り、
 * リポジトリの full_name をその配下 (`<owner>/<repo>`) に置く。既存の行には
 * 触れない。片付けは scope を指定した削除 (DELETE /__scenarios/scopes/:scope)。
 */

export const SCOPE_PATTERN = /^scenario-[a-z][a-z0-9-]*-[a-z0-9]{6}$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomSuffix(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function makeScope(scenarioName: string, suffix: string): string {
  return `scenario-${scenarioName}-${suffix}`;
}

export function isScope(value: string | undefined): value is string {
  return value !== undefined && SCOPE_PATTERN.test(value);
}

/** その scope の行を選ぶときの full_name の前方一致文字列 */
export function scopePrefix(scope: string): string {
  return `${scope}/`;
}
