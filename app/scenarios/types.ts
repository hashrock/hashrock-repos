import type { AdminRepo } from "../lib/repo";

/**
 * シナリオが用意する 1 リポジトリ分の種。props 直描画と DB 種まきの両方で
 * 同じ形を使う。owner (`scenario-<name>-<rand>`) は DB に撒くときに付く。
 */
export interface RepoSeed {
  /** owner 配下でのリポジトリ名。シナリオ内で一意にする */
  name: string;
  description?: string | null;
  language?: string | null;
  starCount?: number;
  isPrivate?: boolean;
  archived?: boolean;
  homepage?: string | null;
  /** 正規化済みで書く (小文字・重複なし)。カンバン列名を含めると列に並ぶ */
  tags?: string[];
  updatedAt?: string;
  createdAt?: string;
  /** 以下は手で編集する列 */
  star?: boolean;
  hide?: boolean;
  notes?: string | null;
  /** 本番の保存経路と同じく normalizeLogoSvg を通してから使う */
  logoSvg?: string | null;
}

/**
 * DB を触らず、公開トップページを props 直描画で見せるシナリオ。
 * 本番でも安全 (何も書かない) なので常に有効。
 */
export interface PropsScenario {
  kind: "props";
  name: string;
  description: string;
  seeds(): RepoSeed[];
}

/** DB に撒いた結果。リダイレクト先を決めるのに使う */
export interface SeededRepo {
  id: number;
  name: string;
  fullName: string;
}

/**
 * DB に撒いてから本物の管理画面 (または撒いた分だけを見せるページ) へ飛ぶ
 * シナリオ。書き込みを伴うので SCENARIOS_ENABLED (か vite dev) のときだけ有効。
 */
export interface DbScenario {
  kind: "db";
  name: string;
  description: string;
  seeds(): RepoSeed[];
  /** 撒いた後に開く画面 (相対パス) */
  target(t: { scope: string; repos: SeededRepo[] }): string;
  /**
   * `/__scenarios/<name>/page?scope=` で、その scope の行だけを渡して描く
   * ページ。本番 route に ?scenario= を足さずに隔離した一覧を見せるため
   */
  page?(repos: AdminRepo[]): unknown;
}

export type Scenario = PropsScenario | DbScenario;
