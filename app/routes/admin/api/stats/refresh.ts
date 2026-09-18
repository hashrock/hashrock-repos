import { createRoute } from "honox/factory";
import { takeSignupSnapshot } from "../../../../lib/signupStats";

// 手動スナップショット。Cron と同じ処理で今日の行を上書きする
export const POST = createRoute(async (c) => {
  try {
    const { date, saved, results } = await takeSignupSnapshot(c.env);
    const failed = results.filter((r) => r.error !== null).length;
    return c.json({ date, saved, failed, results });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
