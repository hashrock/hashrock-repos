import { describe, expect, it } from "vitest";
import { listSignupSnapshotsSince, upsertSignupSnapshots } from "../db";
import { createSignupSnapshotsD1 } from "./sqlite-d1";

const row = (date: string, service: string, total: number, takenAt = `${date}T00:00:00.000Z`) => ({
  date,
  service,
  total,
  new7d: 1,
  new30d: 2,
  takenAt,
});

describe("upsertSignupSnapshots", () => {
  it("(date, service) が同じなら上書きし、別の日は行を足す", async () => {
    const DB = createSignupSnapshotsD1();
    await upsertSignupSnapshots(DB, [row("2026-09-17", "a", 9), row("2026-09-18", "a", 10)]);
    await upsertSignupSnapshots(DB, [
      { ...row("2026-09-18", "a", 12, "2026-09-18T05:00:00.000Z"), new7d: null, new30d: null },
    ]);

    expect(await listSignupSnapshotsSince(DB, "2026-09-01")).toEqual([
      row("2026-09-17", "a", 9),
      {
        date: "2026-09-18",
        service: "a",
        total: 12,
        new7d: null,
        new30d: null,
        takenAt: "2026-09-18T05:00:00.000Z",
      },
    ]);
  });

  it("空配列では何もしない", async () => {
    const DB = createSignupSnapshotsD1();
    await upsertSignupSnapshots(DB, []);
    expect(await listSignupSnapshotsSince(DB, "2000-01-01")).toEqual([]);
  });

  it("パラメータ上限を超える件数も分けて書ける", async () => {
    const DB = createSignupSnapshotsD1();
    const rows = Array.from({ length: 40 }, (_, i) => row("2026-09-18", `s${String(i).padStart(2, "0")}`, i));
    await upsertSignupSnapshots(DB, rows);
    expect(await listSignupSnapshotsSince(DB, "2026-09-18")).toHaveLength(40);
  });
});

describe("listSignupSnapshotsSince", () => {
  it("sinceDate 以降を service, date の順で返す", async () => {
    const DB = createSignupSnapshotsD1();
    await upsertSignupSnapshots(DB, [
      row("2026-09-18", "b", 3),
      row("2026-08-19", "a", 1),
      row("2026-08-20", "a", 2),
      row("2026-09-18", "a", 4),
    ]);
    const got = await listSignupSnapshotsSince(DB, "2026-08-20");
    expect(got.map((r) => `${r.service}@${r.date}`)).toEqual([
      "a@2026-08-20",
      "a@2026-09-18",
      "b@2026-09-18",
    ]);
  });
});
