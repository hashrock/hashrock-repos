import StatsRefreshButton from "../islands/stats-refresh-button";
import AdminNav from "./admin-nav";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  type AdminStatsPageProps,
  type ServiceChart,
} from "../lib/signup-stats-view";

function TotalChart({ chart, from, to }: { chart: ServiceChart; from: string; to: string }) {
  return (
    <section class="border rounded p-4">
      <div class="flex items-baseline justify-between gap-2 mb-2">
        <h3 class="font-semibold">{chart.service}</h3>
        <span class="text-sm text-gray-500 tabular-nums">
          {chart.latest === null ? "記録なし" : `最新 ${chart.latest.toLocaleString("en-US")}`}
        </span>
      </div>
      {chart.dots.length === 0 ? (
        <p class="text-sm text-gray-400 py-6 text-center">この期間の記録がありません</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          class="w-full h-auto text-blue-600"
          role="img"
          aria-label={`${chart.service} の総数 ${from} 〜 ${to}`}
        >
          <line
            x1="0"
            y1={CHART_HEIGHT - 1}
            x2={CHART_WIDTH}
            y2={CHART_HEIGHT - 1}
            class="stroke-gray-200"
            stroke-width="1"
          />
          <path d={chart.path} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          {chart.dots.map((d) => (
            <circle key={d.date} cx={d.x} cy={d.y} r="3" fill="currentColor">
              <title>{`${d.date}: ${d.total.toLocaleString("en-US")}`}</title>
            </circle>
          ))}
        </svg>
      )}
      <div class="flex justify-between text-xs text-gray-400 mt-1 tabular-nums">
        <span>{from}</span>
        {chart.min !== null && chart.max !== null && (
          <span>
            {chart.min === chart.max
              ? `${chart.min.toLocaleString("en-US")} で横ばい`
              : `${chart.min.toLocaleString("en-US")} 〜 ${chart.max.toLocaleString("en-US")}`}
          </span>
        )}
        <span>{to}</span>
      </div>
    </section>
  );
}

/** サインアップ数の管理画面。props だけで描く */
export default function AdminStatsPage(props: AdminStatsPageProps) {
  const { rows, charts, from, to, configError } = props;
  return (
    <div class="py-8 px-6 max-w-5xl mx-auto">
      <title>Signups</title>
      <AdminNav crumbs={[{ href: "/admin", label: "Admin" }]} />
      <div class="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 class="text-3xl font-bold">Signups</h1>
        <StatsRefreshButton />
      </div>

      {configError && (
        <p class="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">設定エラー: {configError}</p>
      )}

      <h2 class="text-lg font-semibold mb-2">最新値</h2>
      <p class="text-sm text-gray-500 mb-2">
        このページを開いたときに各サービスの /api/stats から取得した値です (記録はしません)。
      </p>
      <div class="overflow-x-auto mb-10">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b text-left text-gray-500">
              <th class="py-2 pr-4 font-medium">service</th>
              <th class="py-2 pr-4 font-medium text-right">total</th>
              <th class="py-2 pr-4 font-medium text-right">new_7d</th>
              <th class="py-2 pr-4 font-medium text-right">new_30d</th>
              <th class="py-2 pr-4 font-medium">取得時刻 (JST)</th>
              <th class="py-2 font-medium">エラー</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} class="py-4 text-center text-gray-400">
                  STATS_SOURCES にサービスがありません
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.service} class="border-b align-top">
                <td class="py-2 pr-4">
                  {row.url ? (
                    <a href={row.url} class="text-blue-700 hover:underline" target="_blank" rel="noopener noreferrer">
                      {row.service}
                    </a>
                  ) : (
                    row.service
                  )}
                  {row.note && <div class="text-xs text-gray-400">{row.note}</div>}
                </td>
                <td class="py-2 pr-4 text-right tabular-nums">{row.total}</td>
                <td class="py-2 pr-4 text-right tabular-nums">{row.new7d}</td>
                <td class="py-2 pr-4 text-right tabular-nums">{row.new30d}</td>
                <td class="py-2 pr-4 tabular-nums whitespace-nowrap">{row.fetchedAt}</td>
                <td class="py-2 text-red-700">{row.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 class="text-lg font-semibold mb-2">総数の推移 (直近 30 日)</h2>
      <p class="text-sm text-gray-500 mb-4">
        毎日 UTC 0 時 (JST 9 時) の Cron と「今すぐ記録」で取ったスナップショットです。
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        {charts.map((chart) => (
          <TotalChart key={chart.service} chart={chart} from={from} to={to} />
        ))}
      </div>
    </div>
  );
}
