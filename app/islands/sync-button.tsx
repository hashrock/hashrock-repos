import { useState } from "hono/jsx";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSync = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "hashrock" }),
      });
      const data = (await res.json()) as { synced?: number; error?: string };
      if (res.ok) {
        setMessage(`Synced ${data.synced} repositories`);
        setTimeout(() => location.reload(), 1000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (e) {
      setMessage("Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex items-center gap-3">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Sync from GitHub"}
      </button>
      {message && <span class="text-sm text-gray-600">{message}</span>}
    </div>
  );
}
