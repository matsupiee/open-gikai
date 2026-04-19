import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getTestDb,
  withRollback,
  createTestDatabase,
  runMigrations,
  closeTestDb,
} from "@open-gikai/db/test-helpers";
import { municipalities, meetings } from "@open-gikai/db/schema";
import { listMeetings } from "./meetings.service";

type TestDb = ReturnType<typeof getTestDb>;

let db: TestDb;

beforeAll(async () => {
  await createTestDatabase();
  db = getTestDb();
  await runMigrations(db);
});

afterAll(async () => {
  await closeTestDb(db);
});

describe("listMeetings", () => {
  it("会議一覧を取得できる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
      });
      await tx.insert(meetings).values({
        id: "meeting-1",
        municipalityCode: "010001",
        title: "令和6年第1回定例会",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      });

      const result = await listMeetings(tx, {});

      expect(result.meetings).toHaveLength(1);
      expect(result.meetings[0]!.title).toBe("令和6年第1回定例会");
      expect(result.meetings[0]!.prefecture).toBe("北海道");
      expect(result.meetings[0]!.municipality).toBe("札幌市");
      expect(result.nextCursor).toBeNull();
    });
  });

  it("heldOnFrom / heldOnTo で期間フィルタ", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
      });
      await tx.insert(meetings).values([
        {
          id: "meeting-old",
          municipalityCode: "010001",
          title: "令和5年第1回定例会",
          meetingType: "定例会",
          heldOn: "2023-03-01",
        },
        {
          id: "meeting-new",
          municipalityCode: "010001",
          title: "令和6年第1回定例会",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
      ]);

      const result = await listMeetings(tx, {
        heldOnFrom: "2024-01-01",
        heldOnTo: "2024-12-31",
      });

      expect(result.meetings).toHaveLength(1);
      expect(result.meetings[0]!.title).toBe("令和6年第1回定例会");
    });
  });

  it("prefecture でフィルタ", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "010001", name: "札幌市", prefecture: "北海道" },
        { code: "131001", name: "千代田区", prefecture: "東京都" },
      ]);
      await tx.insert(meetings).values([
        {
          id: "meeting-hokkaido",
          municipalityCode: "010001",
          title: "北海道の会議",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
        {
          id: "meeting-tokyo",
          municipalityCode: "131001",
          title: "東京の会議",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
      ]);

      const result = await listMeetings(tx, { prefecture: "東京都" });

      expect(result.meetings).toHaveLength(1);
      expect(result.meetings[0]!.title).toBe("東京の会議");
    });
  });

  it("municipality でテキスト検索", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "010001", name: "札幌市", prefecture: "北海道" },
        { code: "131001", name: "千代田区", prefecture: "東京都" },
      ]);
      await tx.insert(meetings).values([
        {
          id: "meeting-sapporo",
          municipalityCode: "010001",
          title: "札幌の会議",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
        {
          id: "meeting-chiyoda",
          municipalityCode: "131001",
          title: "千代田の会議",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
      ]);

      const result = await listMeetings(tx, { municipality: "札幌" });

      expect(result.meetings).toHaveLength(1);
      expect(result.meetings[0]!.title).toBe("札幌の会議");
    });
  });

  it("カーソルベースページネーション", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
      });
      await tx.insert(meetings).values([
        {
          id: "aaa",
          municipalityCode: "010001",
          title: "会議A",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
        {
          id: "bbb",
          municipalityCode: "010001",
          title: "会議B",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
        {
          id: "ccc",
          municipalityCode: "010001",
          title: "会議C",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
      ]);

      const page1 = await listMeetings(tx, { limit: 2 });

      expect(page1.meetings).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await listMeetings(tx, {
        limit: 2,
        cursor: page1.nextCursor!,
      });

      expect(page2.meetings).toHaveLength(1);
      expect(page2.nextCursor).toBeNull();
    });
  });

  it("データが0件のとき空配列を返す", async () => {
    await withRollback(db, async (tx) => {
      const result = await listMeetings(tx, {});

      expect(result.meetings).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });
  });

  it("heldOn 降順でソートされる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
      });
      await tx.insert(meetings).values([
        {
          id: "meeting-march",
          municipalityCode: "010001",
          title: "3月の会議",
          meetingType: "定例会",
          heldOn: "2024-03-01",
        },
        {
          id: "meeting-june",
          municipalityCode: "010001",
          title: "6月の会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
        },
        {
          id: "meeting-jan",
          municipalityCode: "010001",
          title: "1月の会議",
          meetingType: "定例会",
          heldOn: "2024-01-01",
        },
      ]);

      const result = await listMeetings(tx, {});

      expect(result.meetings[0]!.title).toBe("6月の会議");
      expect(result.meetings[1]!.title).toBe("3月の会議");
      expect(result.meetings[2]!.title).toBe("1月の会議");
    });
  });
});
