import { createRoute } from "honox/factory";
import { listSignupSnapshotsSince } from "../../../lib/db";
import {
  collectSignupStats,
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

// 表は開くたびに取り直す (記録はしない)。折れ線は signup_snapshots から描く
export default createRoute(async (c) => {
  let sources: StatsSource[] = [];
  let configError: string | null = null;
  try {
    sources = parseStatsSources(c.env.STATS_SOURCES);
  } catch (e) {
    configError = e instanceof Error ? e.message : String(e);
  }

  const today = snapshotDate(new Date());
  const [results, snapshots] = await Promise.all([
    collectSignupStats(sources, { token: c.env.STATS_TOKEN }),
    listSignupSnapshotsSince(c.env.DB, dateRange(today, STATS_CHART_DAYS)[0]),
  ]);

  return c.render(
    <AdminStatsPage
      {...buildAdminStatsPageProps({ results, snapshots, today, configError })}
    />
  );
});
