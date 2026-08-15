import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, Script } from 'honox/server'

export default jsxRenderer(({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* og:image は絶対 URL でないとクローラが解決できない */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="hashrock repos" />
        <meta property="og:title" content="hashrock repos" />
        <meta property="og:description" content="自分用リポジトリカンバン" />
        <meta property="og:url" content="https://repos.hashrock.info/" />
        <meta property="og:image" content="https://repos.hashrock.info/og.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <Link href="/app/style.css" rel="stylesheet" />
        <Script src="/app/client.ts" async />
      </head>
      <body>{children}</body>
    </html>
  )
})
