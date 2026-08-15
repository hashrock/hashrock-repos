import { useState } from "hono/jsx";
import TagEditor from "./tag-editor";
import { apiFetch } from "../lib/api-fetch";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  updatedAt: string;
  language: string | null;
  starCount: number | null;
  archived: boolean | null;
  isPrivate: boolean | null;
  createdAt: string | null;
  notes: string | null;
  star: boolean | null;
  hide: boolean | null;
  coverImageKey: string | null;
  homepage: string | null;
  logoSvg: string | null;
  tags: string[];
}

interface Props {
  repo: Repo;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function RepoEditor({ repo }: Props) {
  const [notes, setNotes] = useState(repo.notes ?? "");
  const [star, setStar] = useState(repo.star ?? false);
  const [hide, setHide] = useState(repo.hide ?? false);
  const [coverImageKey, setCoverImageKey] = useState(repo.coverImageKey);
  const [logoSvg, setLogoSvg] = useState(repo.logoSvg ?? "");
  const [savedLogoSvg, setSavedLogoSvg] = useState(repo.logoSvg);
  const [logoError, setLogoError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const patch = async (body: {
    notes?: string;
    star?: boolean;
    hide?: boolean;
    logoSvg?: string | null;
  }) => {
    setSaveState("saving");
    try {
      const res = await apiFetch(`/admin/api/repos/${repo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        logoSvg?: string | null;
        error?: string;
      };
      setSaveState(res.ok ? "saved" : "error");
      return { ok: res.ok, data };
    } catch {
      setSaveState("error");
      return { ok: false, data: {} as { logoSvg?: string | null; error?: string } };
    }
  };

  const saveLogoSvg = async () => {
    if (logoSvg === (savedLogoSvg ?? "")) return;
    setLogoError("");
    const { ok, data } = await patch({ logoSvg });
    if (ok) {
      // サーバ側でサニタイズされた結果を正とする
      setSavedLogoSvg(data.logoSvg ?? null);
      setLogoSvg(data.logoSvg ?? "");
    } else {
      setLogoError(data.error ?? "保存に失敗しました");
    }
  };

  const toggleStar = async () => {
    const next = !star;
    setStar(next);
    await patch({ star: next });
  };

  const toggleHide = async () => {
    const next = !hide;
    setHide(next);
    await patch({ hide: next });
  };

  const handleUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/admin/api/repos/${repo.id}/image`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        coverImageKey?: string;
        error?: string;
      };
      if (res.ok && data.coverImageKey) {
        setCoverImageKey(data.coverImageKey);
      } else {
        setUploadError(data.error ?? "Upload failed");
      }
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const handleDeleteImage = async () => {
    setUploading(true);
    setUploadError("");
    try {
      const res = await apiFetch(`/admin/api/repos/${repo.id}/image`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCoverImageKey(null);
      } else {
        setUploadError("Delete failed");
      }
    } catch {
      setUploadError("Delete failed");
    } finally {
      setUploading(false);
    }
  };

  const publiclyVisible = star && !hide;

  return (
    <div class="mt-4">
      <div class="flex items-start justify-between gap-4 mb-1">
        <h1 class="text-2xl font-bold break-all">{repo.fullName}</h1>
        <div class="flex items-center gap-2 shrink-0 pt-1">
          {repo.isPrivate && (
            <span class="text-xs px-2 py-0.5 border border-amber-300 bg-amber-50 text-amber-700 rounded-full">
              Private
            </span>
          )}
          {repo.archived && (
            <span class="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">
              Archived
            </span>
          )}
        </div>
      </div>

      {repo.description && (
        <p class="text-gray-600 mb-2">{repo.description}</p>
      )}

      <div class="flex items-center gap-3 text-sm text-gray-500 mb-6">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-600 hover:underline"
        >
          GitHub ↗
        </a>
        {repo.homepage && (
          <a
            href={repo.homepage}
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 hover:underline break-all"
          >
            {repo.homepage} ↗
          </a>
        )}
        {repo.language && <span>{repo.language}</span>}
        {(repo.starCount ?? 0) > 0 && <span>★ {repo.starCount}</span>}
        <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
      </div>

      {/* 公開設定 */}
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-700 mb-2">公開設定</h2>
        <div class="border rounded p-4 space-y-3">
          <label class="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={star}
              onChange={toggleStar}
              class="mt-1 cursor-pointer"
            />
            <span>
              <span class="font-medium">Star</span>
              <span class="block text-sm text-gray-500">
                トップページの上部にカードとして表示する
              </span>
            </span>
          </label>

          <label class="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hide}
              onChange={toggleHide}
              class="mt-1 cursor-pointer"
            />
            <span>
              <span class="font-medium">Hide</span>
              <span class="block text-sm text-gray-500">
                トップページから完全に外す（Star より優先）
              </span>
            </span>
          </label>

          {repo.isPrivate && publiclyVisible && (
            <p class="text-sm bg-amber-50 border border-amber-300 text-amber-800 rounded p-3">
              このリポジトリは <strong>private</strong> ですが、Star
              が付いているため、リポジトリ名・説明・メモ・画像が
              <strong>誰でも見られるトップページに公開されます</strong>。
            </p>
          )}
        </div>
      </section>

      {/* メモ */}
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-700 mb-2">
          メモ
          <span class="ml-2 font-normal text-gray-400">
            Star 中はトップページのカードにも表示されます
          </span>
        </h2>
        <textarea
          value={notes}
          onInput={(e) => {
            setNotes((e.target as HTMLTextAreaElement).value);
            setSaveState("idle");
          }}
          onBlur={() => patch({ notes })}
          rows={10}
          placeholder={"- [ ] TODO\n- メモ"}
          class="w-full px-3 py-2 border rounded font-mono text-sm outline-none focus:border-blue-400"
        />
        <div class="flex items-center justify-between mt-1">
          <span class="text-xs text-gray-400">
            フォーカスを外すと保存されます
          </span>
          <span class="text-xs text-gray-500">
            {saveState === "saving" && "Saving..."}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && (
              <span class="text-red-600">保存に失敗しました</span>
            )}
          </span>
        </div>
      </section>

      {/* カバー画像 */}
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-700 mb-2">カバー画像</h2>
        {coverImageKey ? (
          <div class="space-y-2">
            <img
              src={`/images/${coverImageKey}`}
              alt=""
              class="max-h-64 rounded border"
            />
            <button
              type="button"
              onClick={handleDeleteImage}
              disabled={uploading}
              class="text-sm px-3 py-1 text-gray-500 border rounded hover:text-red-600 hover:border-red-300 cursor-pointer disabled:opacity-50"
            >
              画像を削除
            </button>
          </div>
        ) : (
          <p class="text-sm text-gray-400 mb-2">画像は未設定です</p>
        )}
        <div class="mt-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleUpload}
            disabled={uploading}
            class="text-sm"
          />
          <p class="text-xs text-gray-400 mt-1">
            PNG / JPEG / WebP / GIF、5MB まで
          </p>
          {uploading && (
            <p class="text-xs text-gray-500 mt-1">アップロード中...</p>
          )}
          {uploadError && (
            <p class="text-xs text-red-600 mt-1">{uploadError}</p>
          )}
        </div>
      </section>

      {/* ロゴ SVG */}
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-700 mb-2">
          ロゴ (SVG)
          <span class="ml-2 font-normal text-gray-400">
            カードのタイトル横に表示されます
          </span>
        </h2>
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 shrink-0 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
            {savedLogoSvg ? (
              <span
                class="block w-10 h-10 [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: savedLogoSvg }}
              />
            ) : (
              <span class="text-xs text-gray-400">なし</span>
            )}
          </div>
          <div class="flex-1">
            <textarea
              value={logoSvg}
              onInput={(e) => {
                setLogoSvg((e.target as HTMLTextAreaElement).value);
                setLogoError("");
              }}
              onBlur={saveLogoSvg}
              rows={5}
              placeholder='<svg viewBox="0 0 24 24">...</svg>'
              class="w-full px-3 py-2 border rounded font-mono text-xs outline-none focus:border-blue-400"
            />
            <div class="flex items-center justify-between mt-1">
              <span class="text-xs text-gray-400">
                SVG マークアップを貼り付け。フォーカスを外すと保存されます
              </span>
              {savedLogoSvg && (
                <button
                  type="button"
                  onClick={async () => {
                    setLogoSvg("");
                    setLogoError("");
                    const { ok } = await patch({ logoSvg: null });
                    if (ok) setSavedLogoSvg(null);
                  }}
                  class="text-xs text-gray-400 hover:text-red-600 cursor-pointer"
                >
                  削除
                </button>
              )}
            </div>
            {logoError && (
              <p class="text-xs text-red-600 mt-1">{logoError}</p>
            )}
            <p class="text-xs text-gray-400 mt-1">
              script・イベントハンドラ・外部参照は保存時に除去されます
            </p>
          </div>
        </div>
      </section>

      {/* タグ */}
      <section>
        <h2 class="text-sm font-semibold text-gray-700 mb-2">タグ</h2>
        <TagEditor repoId={repo.id} initialTags={repo.tags} />
      </section>
    </div>
  );
}
