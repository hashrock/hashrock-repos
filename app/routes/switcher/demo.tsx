import { createRoute } from 'honox/factory'

/**
 * <hashrock-switcher> の見本。各サイトへ組み込む前に本番で見た目を確かめるためのページ。
 * 同じオリジンの /switcher/v1.js を読むので、このデプロイの版がそのまま出る。
 */

const SNIPPET = `<script type="module" src="https://repos.hashrock.info/switcher/v1.js"></script>
<hashrock-switcher></hashrock-switcher>`

function SampleHeader({
  title,
  note,
  class: cls,
  children,
}: {
  title: string
  note: string
  class: string
  children: unknown
}) {
  return (
    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-gray-700">{title}</h2>
      <p class="text-xs text-gray-500">{note}</p>
      <header class={`flex items-center gap-4 rounded-lg border px-4 h-14 ${cls}`}>
        <span class="font-bold">sample app</span>
        <nav class="flex gap-3 text-sm opacity-80">
          <span>ボード</span>
          <span>設定</span>
        </nav>
        <span class="ml-auto text-sm opacity-80">ログアウト</span>
        {children}
      </header>
    </section>
  )
}

export default createRoute((c) => {
  return c.render(
    <main class="max-w-3xl mx-auto px-4 py-6 space-y-8 text-gray-900">
      <div class="space-y-2 pr-14">
        <h1 class="text-xl font-bold">hashrock-switcher デモ</h1>
        <p class="text-sm text-gray-600">
          star 済みプロジェクトを行き来するメニュー。各サイトは次の 2 行を足すだけで使える。
        </p>
        <pre class="text-xs bg-gray-100 rounded p-3 overflow-x-auto">
          <code>{SNIPPET}</code>
        </pre>
      </div>

      <SampleHeader
        title='ライト — theme="light"'
        note="ヘッダの右端に置く。ボタンの色はヘッダの文字色 (currentColor) を引き継ぐ。"
        class="bg-white text-gray-900 border-gray-200"
      >
        <hashrock-switcher theme="light"></hashrock-switcher>
      </SampleHeader>

      <SampleHeader
        title='ダーク — theme="dark"'
        note="配色を暗い方に固定する (grid24 など暗いヘッダのサイト用)。"
        class="bg-gray-900 text-gray-100 border-gray-700"
      >
        <hashrock-switcher theme="dark"></hashrock-switcher>
      </SampleHeader>

      <SampleHeader
        title="既定 — theme 省略"
        note="メニューの配色は OS のライト / ダーク設定に従う。"
        class="bg-white text-gray-900 border-gray-200"
      >
        <hashrock-switcher></hashrock-switcher>
      </SampleHeader>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-700">floating</h2>
        <p class="text-xs text-gray-500">
          ヘッダの無いサイト用。このページの右上の角に浮いているのがそれ (position: fixed)。
        </p>
        <pre class="text-xs bg-gray-100 rounded p-3 overflow-x-auto">
          <code>{'<hashrock-switcher floating></hashrock-switcher>'}</code>
        </pre>
      </section>

      <hashrock-switcher floating></hashrock-switcher>
      <script type="module" src="/switcher/v1.js"></script>
    </main>
  )
})
