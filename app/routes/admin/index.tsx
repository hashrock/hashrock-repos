import { createRoute } from 'honox/factory'

export default createRoute((c) => {
  return c.render(
    <div class="py-8 px-6 max-w-4xl mx-auto">
      <title>Admin</title>
      <h1 class="text-3xl font-bold mb-6">Admin</h1>
      <div class="grid gap-4">
        <a href="/admin/repos" class="block p-4 border rounded hover:bg-gray-50 transition-colors">
          <h2 class="text-xl font-semibold mb-2">Repositories</h2>
          <p class="text-gray-600">リポジトリの管理・同期・タグ編集</p>
        </a>
      </div>
    </div>
  )
})
