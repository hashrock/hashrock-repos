import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ImageValidationError,
  MAX_IMAGE_BYTES,
  deleteCoverImage,
  extensionFor,
  putCoverImage,
} from "../images";

vi.mock("../db", () => ({
  getRepoById: vi.fn(),
  setRepoCoverImageKey: vi.fn(),
}));

import { getRepoById, setRepoCoverImageKey } from "../db";

const mockD1 = {} as D1Database;

function makeBucket() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as R2Bucket & { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
}

function repoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    githubId: 1001,
    name: "repo",
    fullName: "user/repo",
    url: "https://github.com/user/repo",
    description: null,
    updatedAt: "2024-01-01",
    language: null,
    starCount: 0,
    archived: false,
    isPrivate: false,
    createdAt: "2024-01-01",
    notes: null,
    star: false,
    hide: false,
    coverImageKey: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extensionFor", () => {
  it("maps supported content types", () => {
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/gif")).toBe("gif");
  });

  it("rejects SVG so uploads cannot run scripts on this origin", () => {
    expect(() => extensionFor("image/svg+xml")).toThrow(ImageValidationError);
  });

  it("rejects unknown types", () => {
    expect(() => extensionFor("application/pdf")).toThrow(ImageValidationError);
    expect(() => extensionFor("")).toThrow(ImageValidationError);
  });
});

describe("putCoverImage", () => {
  it("stores the file under a generated key and records it", async () => {
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    const bucket = makeBucket();
    const file = new File(["x"], "shot.png", { type: "image/png" });

    const result = await putCoverImage(mockD1, bucket, 1, file);

    expect(result.coverImageKey).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(bucket.put).toHaveBeenCalledTimes(1);
    // アップロード元のファイル名はキーに使わない
    expect(bucket.put.mock.calls[0][0]).not.toContain("shot");
    expect(setRepoCoverImageKey).toHaveBeenCalledWith(
      mockD1,
      1,
      result.coverImageKey
    );
  });

  it("deletes the previous image after the DB is updated", async () => {
    vi.mocked(getRepoById).mockResolvedValue(
      repoRow({ coverImageKey: "old-key.png" })
    );
    const bucket = makeBucket();
    const file = new File(["x"], "shot.png", { type: "image/png" });

    await putCoverImage(mockD1, bucket, 1, file);

    expect(bucket.delete).toHaveBeenCalledWith("old-key.png");
  });

  it("rejects files over the size limit before touching R2", async () => {
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    const bucket = makeBucket();
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", {
      type: "image/png",
    });

    await expect(putCoverImage(mockD1, bucket, 1, big)).rejects.toThrow(
      ImageValidationError
    );
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("rejects empty files", async () => {
    const bucket = makeBucket();
    const empty = new File([], "empty.png", { type: "image/png" });

    await expect(putCoverImage(mockD1, bucket, 1, empty)).rejects.toThrow(
      ImageValidationError
    );
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("rejects unknown repos", async () => {
    vi.mocked(getRepoById).mockResolvedValue(undefined);
    const bucket = makeBucket();
    const file = new File(["x"], "shot.png", { type: "image/png" });

    await expect(putCoverImage(mockD1, bucket, 99, file)).rejects.toThrow(
      ImageValidationError
    );
    expect(bucket.put).not.toHaveBeenCalled();
  });
});

describe("deleteCoverImage", () => {
  it("clears the key and removes the object", async () => {
    vi.mocked(getRepoById).mockResolvedValue(
      repoRow({ coverImageKey: "key.png" })
    );
    const bucket = makeBucket();

    await deleteCoverImage(mockD1, bucket, 1);

    expect(setRepoCoverImageKey).toHaveBeenCalledWith(mockD1, 1, null);
    expect(bucket.delete).toHaveBeenCalledWith("key.png");
  });

  it("does nothing when there is no image", async () => {
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    const bucket = makeBucket();

    await deleteCoverImage(mockD1, bucket, 1);

    expect(setRepoCoverImageKey).not.toHaveBeenCalled();
    expect(bucket.delete).not.toHaveBeenCalled();
  });
});
