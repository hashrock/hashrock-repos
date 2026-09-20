import { useState } from "hono/jsx";
import { apiFetch } from "../lib/api-fetch";

/**
 * 今すぐ収集して今日のスナップショットを取り直す。成功したら再読み込み。
 * 画面に取得エラーの列は無いので、失敗したサービス名はここで出す。
 */
export default function StatsRefreshButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRefresh = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiFetch("/admin/api/stats/refresh", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        saved?: number;
        failed?: number;
        results?: { service: string; error: string | null }[];
        error?: string;
      };
      if (res.ok) {
        const failed = (data.results ?? []).filter((r) => r.error !== null);
        const failedPart = failed.length
          ? `、失敗 ${failed.length} 件 (${failed.map((r) => r.service).join(", ")})`
          : "";
        setMessage(`${data.saved} 件を記録しました${failedPart}`);
        setTimeout(() => location.reload(), failed.length ? 4000 : 1000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (e) {
      setMessage("記録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex items-center gap-3">
      {message && <span class="text-sm text-gray-600">{message}</span>}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
      >
        {loading ? "記録中..." : "今すぐ記録"}
      </button>
    </div>
  );
}
