import { createRoute } from "honox/factory";
import { listSignupSnapshotsSince } from "../../../lib/db";
import {
  parseStatsSources,
  snapshotDate,
  type StatsSource,
} from "../../../lib/signupStats";
import {
  STATS_CHART_DAYS,
  buildAdminStatsPageProps,
  dateRange,
} from "../../../lib/signup-stats-view";
import AdminStatsPage from "../../../components/admin-stats-page";

// 表も折れ線も signup_snapshots から描く。開くたびに各サービスへ取りに行くと
// 落ちているサービスのタイムアウトを毎回待つので、収集は Cron と「今すぐ記録」に任せる
export default createRoute(async (c) => {
  let sources: StatsSource[] = [];
  let configError: string | null = null;
  try {
    sources = parseStatsSources(c.env.STATS_SOURCES);
  } catch (e) {
    configError = e instanceof Error ? e.message : String(e);
  }

  const today = snapshotDate(new Date());
  const snapshots = await listSignupSnapshotsSince(
    c.env.DB,
    dateRange(today, STATS_CHART_DAYS)[0]
  );

  return c.render(
    <AdminStatsPage
      {...buildAdminStatsPageProps({ sources, snapshots, today, configError })}
    />
  );
});
