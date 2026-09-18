import { useState } from "hono/jsx";
import { apiFetch } from "../lib/api-fetch";

/** 今すぐ収集して今日のスナップショットを取り直す。成功したら再読み込み */
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
        error?: string;
      };
      if (res.ok) {
        const failedPart = data.failed ? `、失敗 ${data.failed} 件` : "";
        setMessage(`${data.saved} 件を記録しました${failedPart}`);
        setTimeout(() => location.reload(), 1000);
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
