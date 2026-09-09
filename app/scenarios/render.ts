import { buildTopPageProps, type TopPageProps, type TopPageRepo } from "../lib/top-page";
import { normalizeLogoSvg } from "../lib/svg";
import { normalizeTagList } from "../lib/tags";
import type { RepoSeed } from "./types";

/**
 * 種を、公開トップページが読む行の形にする。DB は通らないので id は仮
 * (負の連番。/logos/:id などは引けないが、props 直描画では参照されない)。
 */
export function seedToTopPageRepo(seed: RepoSeed, index: number): TopPageRepo {
  return {
    id: -(index + 1),
    name: seed.name,
    url: `https://github.com/scenario/${seed.name}`,
    description: seed.description ?? null,
    notes: seed.notes ?? null,
    language: seed.language ?? null,
    starCount: seed.starCount ?? 0,
    isPrivate: seed.isPrivate ?? false,
    homepage: seed.homepage ?? null,
    coverImageKey: null,
    logoSvg: normalizeLogoSvg(seed.logoSvg ?? null),
    tags: normalizeTagList(seed.tags ?? []),
    star: seed.star ?? false,
  };
}

/**
 * 本番の route が listRepos({ includePrivate: true }) で受け取るのと同じ集合:
 * hide でなく archived でもないもの (private は含む)。
 */
export function topPageCandidates(seeds: RepoSeed[]): TopPageRepo[] {
  return seeds
    .filter((s) => !s.hide && !s.archived)
    .map((s, i) => seedToTopPageRepo(s, i));
}

/** 種から公開トップページの props を作る。DB を触らない */
export function seedsToTopPageProps(seeds: RepoSeed[], signedIn: boolean): TopPageProps {
  return buildTopPageProps(topPageCandidates(seeds), signedIn);
}
