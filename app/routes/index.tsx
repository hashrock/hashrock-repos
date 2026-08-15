import { createRoute } from 'honox/factory'
import { listRepos } from '../lib/db'
import { KANBAN_COLUMNS } from '../lib/constants'

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

/**
 * カードのリンク先。private リポジトリへのリンクは訪問者には 404 にしかならず、
 * 存在を晒すだけなので出さない。private は homepage があるときだけ開ける。
 */
function cardHref(repo: {
  isPrivate: boolean | null
  homepage: string | null
  url: string
}): string | null {
  if (repo.isPrivate) {
    return repo.homepage || null
  }
  return repo.homepage || repo.url
}

function PencilMark() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064L11.189 6.25Z" />
    </svg>
  )
}

/**
 * CF Access のセッション Cookie があるか。トップページは Access の外なので
 * これは「管理者本人らしい」という UI 上のヒントでしかない。表示を出し分ける
 * のは /admin へのリンクだけで、非公開データの出し分けには使わないこと。
 */
function hasAccessSession(cookieHeader: string | undefined): boolean {
  return /(?:^|;\s*)CF_Authorization=/.test(cookieHeader ?? '')
}

export default createRoute(async (c) => {
  // カンバンは private も含める。ただし列に並ぶのは backlog/ongoing などの
  // タグが付いたものだけなので、タグの無い private は結局どこにも出ない。
  // star したものは「公開してよい」の意思表示として private でもカードに出す。
  // hide と archived が立っていればカンバンからもカードからも外れる。
  const allRepos = await listRepos(c.env.DB, { includePrivate: true })
  const starred = await listRepos(c.env.DB, {
    includePrivate: true,
    starredOnly: true,
  })

  const signedIn = hasAccessSession(c.req.header('cookie'))

  const columns = KANBAN_COLUMNS.map((col) => ({
    name: col,
    repos: allRepos.filter((r) => r.tags.includes(col)),
  }))

  const columnColors: Record<string, { bg: string; border: string; header: string }> = {
    backlog:    { bg: 'bg-gray-50',   border: 'border-gray-200',  header: 'bg-gray-200 text-gray-700' },
    ongoing:    { bg: 'bg-blue-50',   border: 'border-blue-200',  header: 'bg-blue-200 text-blue-800' },
    unfinished: { bg: 'bg-amber-50',  border: 'border-amber-200', header: 'bg-amber-200 text-amber-800' },
    done:       { bg: 'bg-green-50',  border: 'border-green-200', header: 'bg-green-200 text-green-800' },
    research:   { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-200 text-purple-800' },
  }

  return c.render(
    <div class="py-6 px-4 sm:py-8 sm:px-6 max-w-[1440px] mx-auto">
      <title>hashrock repos</title>
      <img
        src="/logo.svg"
        alt="hashrock repos"
        width={200}
        height={200}
        class="w-[200px] max-w-full h-auto mb-4 mx-auto"
      />
      {starred.length > 0 && (
        <div class="mb-10">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {starred.map((repo) => (
              <div
                key={repo.id}
                class="relative flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {repo.coverImageKey && (
                  <img
                    src={`/images/${repo.coverImageKey}`}
                    alt=""
                    loading="lazy"
                    class="w-full aspect-video object-cover bg-gray-100"
                  />
                )}
                <div class="p-4 flex-1">
                  <div class="flex items-center gap-2">
                    {repo.logoSvg && (
                      <span
                        class="block w-6 h-6 shrink-0 [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: repo.logoSvg }}
                      />
                    )}
                    <span class="font-semibold text-gray-900">{repo.name}</span>
                  </div>
                  {repo.description && (
                    <div class="text-sm text-gray-500 mt-1">
                      {repo.description}
                    </div>
                  )}
                  {repo.notes && (
                    <div class="text-xs text-gray-600 mt-3 whitespace-pre-wrap border-t border-gray-100 pt-3">
                      {repo.notes}
                    </div>
                  )}
                  {repo.tags.filter((t) => !(KANBAN_COLUMNS as readonly string[]).includes(t)).length > 0 && (
                    <div class="flex gap-1 mt-3 flex-wrap">
                      {repo.tags
                        .filter((t) => !(KANBAN_COLUMNS as readonly string[]).includes(t))
                        .map((tag) => (
                          <span key={tag} class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}
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
                    aria-label={repo.name}
                  />
                )}
                {/* オーバーレイより前面に置くアイコン群 */}
                <div class="absolute top-2 right-2 z-10 flex items-center gap-1">
                  {signedIn && (
                    <a
                      href={`/admin/repos/${repo.id}`}
                      aria-label={`${repo.name} を編集`}
                      title="編集"
                      class="p-1.5 rounded-full bg-white/90 text-gray-400 hover:text-blue-600 shadow-sm"
                    >
                      <PencilMark />
                    </a>
                  )}
                  {repo.isPrivate ? (
                    <span
                      title="Private repository"
                      class="p-1.5 rounded-full bg-white/90 text-gray-400 shadow-sm"
                    >
                      <LockMark />
                    </span>
                  ) : (
                    repo.homepage && (
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${repo.name} on GitHub`}
                        title="GitHub"
                        class="p-1.5 rounded-full bg-white/90 text-gray-400 hover:text-gray-900 shadow-sm"
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

      <div class="mb-6">
        <h1 class="text-2xl sm:text-3xl font-bold">Projects</h1>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {columns.map((col) => {
          const colors = columnColors[col.name]
          return (
            <div key={col.name} class={`rounded-lg ${colors.border} border`}>
              <div class={`px-3 py-2 rounded-t-lg ${colors.header} font-semibold text-sm flex items-center justify-between`}>
                <span class="capitalize">{col.name}</span>
                <span class="text-xs opacity-70">{col.repos.length}</span>
              </div>
              <div class={`p-2 space-y-2 ${colors.bg} rounded-b-lg min-h-[200px]`}>
                {col.repos.map((repo) => (
                  <div
                    key={repo.id}
                    class="relative p-3 bg-white rounded border border-gray-100 shadow-sm hover:shadow transition-shadow"
                  >
                    <div class={`flex items-center gap-1.5 ${signedIn ? 'pr-12' : 'pr-6'}`}>
                      {repo.logoSvg && (
                        <span
                          class="block w-4 h-4 shrink-0 [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: repo.logoSvg }}
                        />
                      )}
                      <span class="font-medium text-sm text-gray-900">{repo.name}</span>
                    </div>
                    {repo.description && (
                      <div class="text-xs text-gray-500 mt-1 line-clamp-2">{repo.description}</div>
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
                    {repo.tags.filter((t) => !(KANBAN_COLUMNS as readonly string[]).includes(t)).length > 0 && (
                      <div class="flex gap-1 mt-2 flex-wrap">
                        {repo.tags
                          .filter((t) => !(KANBAN_COLUMNS as readonly string[]).includes(t))
                          .map((tag) => (
                            <span key={tag} class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                      </div>
                    )}

                    {cardHref(repo) && (
                      <a
                        href={cardHref(repo)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="absolute inset-0"
                        aria-label={repo.name}
                      />
                    )}
                    <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                      {signedIn && (
                        <a
                          href={`/admin/repos/${repo.id}`}
                          aria-label={`${repo.name} を編集`}
                          title="編集"
                          class="text-gray-300 hover:text-blue-600"
                        >
                          <PencilMark />
                        </a>
                      )}
                      {repo.isPrivate ? (
                        <span title="Private repository" class="text-gray-300">
                          <LockMark />
                        </span>
                      ) : (
                        repo.homepage && (
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${repo.name} on GitHub`}
                            title="GitHub"
                            class="text-gray-300 hover:text-gray-900"
                          >
                            <GitHubMark />
                          </a>
                        )
                      )}
                    </div>
                  </div>
                ))}
                {col.repos.length === 0 && (
                  <div class="text-xs text-gray-400 text-center py-8">No items</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div class="mt-12 text-center">
        <a href="/admin/repos" class="text-xs text-gray-400 hover:text-gray-600">Admin</a>
      </div>
    </div>
  )
})
