/**
 * シナリオが作るデータの隔離単位。
 *
 * 1 回の実行ごとに `scenario-<name>-<rand>` という架空の owner を作り、
 * リポジトリの full_name をその配下 (`<owner>/<repo>`) に置く。
 * 既存の行には触れず、一覧ページは `?scenario=<owner>` で配下だけに絞る。
 *
 * 逆に、scope を指定しない通常の一覧 (公開トップ、/api/starred、管理画面)
 * にはシナリオの行を出さない。本番でシナリオを叩いても公開ページや外部の
 * CMS が読む JSON が汚れないようにするため。listRepos がこの規則を持つ。
 */

export const SCENARIO_QUERY = "scenario";

export const SCOPE_PATTERN = /^scenario-[a-z][a-z0-9-]*-[a-z0-9]{6}$/;

/** full_name がシナリオの owner 配下か */
const SCOPED_FULL_NAME = /^scenario-[a-z][a-z0-9-]*-[a-z0-9]{6}\//;

export function isScenarioFullName(fullName: string): boolean {
  return SCOPED_FULL_NAME.test(fullName);
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomSuffix(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function makeScope(scenarioName: string, suffix: string): string {
  return `scenario-${scenarioName}-${suffix}`;
}

/** 一覧を絞るときの full_name の前方一致文字列 */
export function scopePrefix(scope: string): string {
  return `${scope}/`;
}

/**
 * `?scenario=` の値から listRepos に渡す前方一致文字列を作る。
 * 形が違えば undefined (絞らない)。絞り込みは狭める方向にしか働かないので、
 * 何を渡されても既存データが余計に見えることはない。
 */
export function scopeFilterFromQuery(value: string | undefined): string | undefined {
  if (!value || !SCOPE_PATTERN.test(value)) {
    return undefined;
  }
  return scopePrefix(value);
}
