import {
  cardHref,
  cardLinkLabel,
  countVisibleRepos,
  extraTags,
  searchText,
  COLUMN_LABELS,
  type TopPageProps,
  type TopPageRepo,
} from "../lib/top-page"
import RepoFilter from "../islands/repo-filter"

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

function LockMark() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M4 5V4a4 4 0 1 1 8 0v1h.5A1.5 1.5 0 0 1 14 6.5v7A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-7A1.5 1.5 0 0 1 3.5 5H4Zm1.5 0h5V4a2.5 2.5 0 0 0-5 0v1Z" />
    </svg>
  )
}

function PencilMark() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064L11.189 6.25Z" />
    </svg>
  )
}

/** ロゴ画像。取得に失敗したら壊れた画像アイコンを出さずに消す (所見 #8) */
function Logo({ repo, size }: { repo: TopPageRepo; size: 16 | 24 }) {
  const cls = size === 24 ? "block w-6 h-6 shrink-0" : "block w-4 h-4 shrink-0"
  return (
    <img
      src={`/logos/${repo.id}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onerror="this.remove()"
      class={cls}
    />
  )
}

/** カードの行き先を文字で示す。カード全体がリンクだと見た目で分からない (所見 #4, #5) */
function LinkLabel({ repo, small }: { repo: TopPageRepo; small?: boolean }) {
  const label = cardLinkLabel(repo)
  if (!label) return null
  return (
    <div
      class={`${small ? "mt-2 text-[11px]" : "mt-3 text-xs"} text-blue-600 group-hover:underline`}
      aria-hidden="true"
    >
      {label} ↗
    </div>
  )
}

/**
 * 公開トップページ。props だけで描ける (DB もリクエストも見ない) ので、
 * 本番の route と UI テスト用シナリオの両方から使う。
 */
export default function TopPage(props: TopPageProps) {
  const { starred, columns, signedIn } = props
  const total = countVisibleRepos(props)

  const columnColors: Record<string, { bg: string; border: string; header: string }> = {
    backlog:    { bg: 'bg-gray-50',   border: 'border-gray-200',  header: 'bg-gray-200 text-gray-700' },
    ongoing:    { bg: 'bg-blue-50',   border: 'border-blue-200',  header: 'bg-blue-200 text-blue-800' },
    unfinished: { bg: 'bg-amber-50',  border: 'border-amber-200', header: 'bg-amber-200 text-amber-800' },
    done:       { bg: 'bg-green-50',  border: 'border-green-200', header: 'bg-green-200 text-green-800' },
    research:   { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-200 text-purple-800' },
  }

  return (
    <div class="py-6 px-4 sm:py-8 sm:px-6 max-w-[1440px] mx-auto">
      <title>hashrock repos</title>
      <img
        src="/logo.svg"
        alt="hashrock repos"
        width={200}
        height={200}
        class="w-[200px] max-w-full h-auto mb-4 mx-auto"
      />
      {/* サイトが何なのか、カードを押すとどうなるかを一言 (所見 #6) */}
      <p class="text-center text-sm text-gray-500 mb-8">
        hashrock が作ったもの・作りかけのものの一覧です。カードを押すと GitHub かサイトが開きます。
      </p>

      {total === 0 && (
        // 0 件のときに空の列と管理リンクしか無いと次に何をすればいいか分からない (所見 #7)
        <p class="mb-8 text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg py-8">
          表示できるリポジトリがまだありません。
        </p>
      )}

      {starred.length > 0 && (
        <div class="mb-10">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {starred.map((repo) => (
              <div
                key={repo.id}
                data-search={searchText(repo)}
                data-repo-id={repo.id}
                class="group relative flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-shadow overflow-hidden"
              >
                {repo.coverImageKey && (
                  <img
                    src={`/images/${repo.coverImageKey}`}
                    alt=""
                    loading="lazy"
                    class="w-full aspect-video object-cover bg-gray-100"
                  />
                )}
                <div class="p-4 flex-1 min-w-0">
                  {/* 右上のアイコンと名前が重ならないよう右に余白 (所見 #9) */}
                  <div class={`flex items-center gap-2 ${signedIn ? 'pr-20' : 'pr-10'}`}>
                    {repo.logoSvg && <Logo repo={repo} size={24} />}
                    <span class="font-semibold text-gray-900 break-words min-w-0 group-hover:text-blue-700">
                      {repo.name}
                    </span>
                  </div>
                  {repo.description && (
                    <div class="text-sm text-gray-500 mt-1 break-words">
                      {repo.description}
                    </div>
                  )}
                  {repo.notes && (
                    // 空白の無い長い URL でも枠を越えない (所見 #1)
                    <div class="text-xs text-gray-600 mt-3 whitespace-pre-wrap wrap-anywhere border-t border-gray-100 pt-3">
                      {repo.notes}
                    </div>
                  )}
                  {extraTags(repo.tags).length > 0 && (
                    <div class="flex gap-1 mt-3 flex-wrap">
                      {extraTags(repo.tags).map((tag) => (
                        <span key={tag} class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <LinkLabel repo={repo} />
                </div>

                {/*
                  カード全体のクリックは homepage へ。private は誰でも開ける
                  リンクが homepage しか無いので、無ければクリック不可にする
                */}
                {cardHref(repo) && (
                  <a
                    href={cardHref(repo)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="absolute inset-0"
                    aria-label={`${repo.name} (${cardLinkLabel(repo)})`}
                  />
                )}
                {/* オーバーレイより前面に置くアイコン群。指で押せる大きさにする (所見 #13) */}
                <div class="absolute top-2 right-2 z-10 flex items-center gap-1">
                  {signedIn && (
                    <a
                      href={`/admin/repos/${repo.id}`}
                      aria-label={`${repo.name} を編集`}
                      title="編集"
                      class="p-2.5 rounded-full bg-white/90 text-gray-400 hover:text-blue-600 shadow-sm"
                    >
                      <PencilMark />
                    </a>
                  )}
                  {repo.isPrivate ? (
                    <span
                      title="非公開リポジトリ"
                      class="p-2.5 rounded-full bg-white/90 text-gray-400 shadow-sm"
                    >
                      <LockMark />
                    </span>
                  ) : (
                    repo.homepage && (
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${repo.name} を GitHub で見る`}
                        title="GitHub で見る"
                        class="p-2.5 rounded-full bg-white/90 text-gray-400 hover:text-gray-900 shadow-sm"
                      >
                        <GitHubMark />
                      </a>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl sm:text-3xl font-bold">Projects</h1>
        {total > 0 && <RepoFilter total={total} />}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {columns.map((col) => {
          const colors = columnColors[col.name]
          return (
            <div key={col.name} data-column={col.name} class={`rounded-lg ${colors.border} border`}>
              <div class={`px-3 py-2 rounded-t-lg ${colors.header} font-semibold text-sm flex items-center justify-between`}>
                <span>
                  <span class="capitalize">{col.name}</span>
                  <span class="ml-1.5 text-xs font-normal opacity-70">{COLUMN_LABELS[col.name]}</span>
                </span>
                <span class="text-xs opacity-70">{col.repos.length}</span>
              </div>
              {/* スマホの 1 列表示では空の列に 200px の余白を残さない (所見 #14) */}
              <div class={`p-2 space-y-2 ${colors.bg} rounded-b-lg sm:min-h-[200px]`}>
                {col.repos.map((repo) => (
                  <div
                    key={repo.id}
                    data-search={searchText(repo)}
                    data-repo-id={repo.id}
                    class="group relative p-3 bg-white rounded border border-gray-100 shadow-sm hover:shadow hover:border-blue-300 transition-shadow"
                  >
                    <div class={`flex items-center gap-1.5 ${signedIn ? 'pr-14' : 'pr-7'}`}>
                      {repo.logoSvg && <Logo repo={repo} size={16} />}
                      <span class="font-medium text-sm text-gray-900 break-words min-w-0 group-hover:text-blue-700">
                        {repo.name}
                      </span>
                    </div>
                    {repo.description && (
                      <div class="text-xs text-gray-500 mt-1 line-clamp-2 break-words">{repo.description}</div>
                    )}
                    {repo.notes && (
                      // 一覧では説明と同じく数行で止める。全文は星付きカードで読める (所見 #1, #3)
                      <div
                        class="text-xs text-gray-600 mt-2 whitespace-pre-wrap wrap-anywhere line-clamp-4 border-t border-gray-100 pt-2"
                        title={repo.notes}
                      >
                        {repo.notes}
                      </div>
                    )}
                    <div class="flex items-center gap-2 mt-2">
                      {repo.language && (
                        <span class="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                          {repo.language}
                        </span>
                      )}
                      {(repo.starCount ?? 0) > 0 && (
                        <span class="text-xs text-gray-400">★ {repo.starCount}</span>
                      )}
                    </div>
                    {extraTags(repo.tags).length > 0 && (
                      <div class="flex gap-1 mt-2 flex-wrap">
                        {extraTags(repo.tags).map((tag) => (
                          <span key={tag} class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <LinkLabel repo={repo} small />

                    {cardHref(repo) && (
                      <a
                        href={cardHref(repo)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="absolute inset-0"
                        aria-label={`${repo.name} (${cardLinkLabel(repo)})`}
                      />
                    )}
                    <div class="absolute top-1 right-1 z-10 flex items-center">
                      {signedIn && (
                        <a
                          href={`/admin/repos/${repo.id}`}
                          aria-label={`${repo.name} を編集`}
                          title="編集"
                          class="p-2 text-gray-300 hover:text-blue-600"
                        >
                          <PencilMark />
                        </a>
                      )}
                      {repo.isPrivate ? (
                        <span title="非公開リポジトリ" class="p-2 text-gray-300">
                          <LockMark />
                        </span>
                      ) : (
                        repo.homepage && (
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${repo.name} を GitHub で見る`}
                            title="GitHub で見る"
                            class="p-2 text-gray-300 hover:text-gray-900"
                          >
                            <GitHubMark />
                          </a>
                        )
                      )}
                    </div>
                  </div>
                ))}
                {col.repos.length === 0 && (
                  <div class="text-xs text-gray-400 text-center py-8">まだありません</div>
                )}
                <div data-column-no-match hidden class="text-xs text-gray-400 text-center py-8">
                  一致するものはありません
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div class="mt-12 text-center">
        {/* 訪問者が「次にやること」と誤解しないよう、管理者向けだと分かる文言にする (所見 #7) */}
        <a href="/admin/repos" class="text-xs text-gray-400 hover:text-gray-600">
          {signedIn ? '管理画面' : '管理者ログイン'}
        </a>
      </div>
    </div>
  )
}
