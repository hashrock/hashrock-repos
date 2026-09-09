import { createRoute } from 'honox/factory'
import { listRepos } from '../lib/db'
import { hasAccessSession } from '../lib/access'
import { buildTopPageProps } from '../lib/top-page'
import TopPage from '../components/top-page'

export default createRoute(async (c) => {
  // カンバンは private も含める。ただし列に並ぶのは backlog/ongoing などの
  // タグが付いたものだけなので、タグの無い private は結局どこにも出ない。
  // star したものは「公開してよい」の意思表示として private でもカードに出す。
  // hide と archived が立っていればカンバンからもカードからも外れる。
  const repos = await listRepos(c.env.DB, { includePrivate: true })
  const signedIn = hasAccessSession(c.req.header('cookie'))

  return c.render(<TopPage {...buildTopPageProps(repos, signedIn)} />)
})
