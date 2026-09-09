/**
 * シナリオが撒く 1 リポジトリ分の種。owner (`scenario-<name>-<rand>`) は
 * 実行時に付くので、ここには持たない。
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
  /** 正規化前でよい。カンバン列名 (backlog など) を含めると列に並ぶ */
  tags?: string[];
  updatedAt?: string;
  createdAt?: string;
  /** 以下は手で編集する列 (updateRepoMeta で入れる) */
  star?: boolean;
  hide?: boolean;
  notes?: string | null;
  logoSvg?: string | null;
}

/** 撒いた結果。リダイレクト先を決めるのに使う */
export interface SeededRepo {
  id: number;
  name: string;
  fullName: string;
}

export interface ScenarioTarget {
  /** `scenario-<name>-<rand>`。一覧ページは `?scenario=` でこれを受ける */
  scope: string;
  repos: SeededRepo[];
}

export interface Scenario {
  /** URL の一部になる。`[a-z][a-z0-9-]*` */
  name: string;
  description: string;
  /** リダイレクト先が Cloudflare Access の内側 (/admin) か */
  requiresAdmin: boolean;
  /** 撒く種。純粋関数にしておき、テストで中身を見られるようにする */
  seeds(): RepoSeed[];
  /** 撒いた後に開く画面。相対パスで返す */
  target(t: ScenarioTarget): string;
}
