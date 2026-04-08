import { createRoute } from 'honox/factory'
import { listRepos } from '../lib/db'
import { KANBAN_COLUMNS } from '../lib/constants'

export default createRoute(async (c) => {
  const allRepos = await listRepos(c.env.DB)

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
    <div class="py-6 px-4 sm:py-8 sm:px-6">
      <title>hashrock repos</title>
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
                  <a
                    key={repo.id}
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block p-3 bg-white rounded border border-gray-100 shadow-sm hover:shadow transition-shadow"
                  >
                    <div class="font-medium text-sm text-gray-900">{repo.name}</div>
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
                  </a>
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
