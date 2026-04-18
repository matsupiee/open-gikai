import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getTestDb,
  withRollback,
  createTestDatabase,
  runMigrations,
  closeTestDb,
} from "@open-gikai/db/test-helpers";
import { meetings, municipalities } from "@open-gikai/db/schema";
import {
  findMeetingsWithTopics,
  getMeetingDigest,
  searchTopics,
} from "./topics.service";

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

describe("searchTopics", () => {
  it("topic 名がマッチする会議を返す", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      const [meeting] = await tx
        .insert(meetings)
        .values({
          municipalityCode: "462012",
          title: "令和6年第2回定例会",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          summary: "今回は様々な議論があった。",
          topicDigests: [
            {
              topic: "市バス路線再編",
              relevance: "primary",
              digest: "市バス路線再編についての議論",
              speakers: ["田中議員"],
            },
            {
              topic: "防災計画",
              relevance: "secondary",
              digest: "防災計画の見直し",
              speakers: ["山本議員"],
            },
          ],
        })
        .returning();

      const rows = await searchTopics(tx, { query: "市バス" });

      expect(rows).toHaveLength(1);
      expect(rows[0]!.meetingId).toBe(meeting!.id);
      expect(rows[0]!.matchedTopic).toBe("市バス路線再編");
      expect(rows[0]!.relevance).toBe("primary");
      expect(rows[0]!.digestPreview).toBe("市バス路線再編についての議論");
      expect(rows[0]!.heldOn).toBe("2024-06-01");
    });
  });

  it("digest 本文に query が含まれる場合もマッチする", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      await tx.insert(meetings).values({
        municipalityCode: "462012",
        title: "令和6年第1回定例会",
        meetingType: "定例会",
        heldOn: "2024-03-01",
        topicDigests: [
          {
            topic: "交通政策",
            relevance: "primary",
            digest: "ICカード事業の進捗について議論された",
            speakers: ["佐藤議員"],
          },
        ],
      });

      const rows = await searchTopics(tx, { query: "ICカード" });

      expect(rows).toHaveLength(1);
      expect(rows[0]!.matchedTopic).toBe("交通政策");
    });
  });

  it("会議の summary に query が含まれる場合もマッチする", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      await tx.insert(meetings).values({
        municipalityCode: "462012",
        title: "令和6年第3回定例会",
        meetingType: "定例会",
        heldOn: "2024-09-01",
        summary: "教育委員会の改革について議論が行われた",
        topicDigests: [
          {
            topic: "一般質問",
            relevance: "primary",
            digest: "市政全般に関する一般質問",
            speakers: [],
          },
        ],
      });

      const rows = await searchTopics(tx, { query: "教育委員会" });

      expect(rows).toHaveLength(1);
      expect(rows[0]!.matchedTopic).toBe("一般質問");
    });
  });

  it("municipalityCode でフィルタできる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "462012", name: "鹿児島市", prefecture: "鹿児島県" },
        { code: "131001", name: "千代田区", prefecture: "東京都" },
      ]);
      await tx.insert(meetings).values([
        {
          municipalityCode: "462012",
          title: "鹿児島の会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            {
              topic: "観光振興",
              relevance: "primary",
              digest: "観光客誘致について",
              speakers: [],
            },
          ],
        },
        {
          municipalityCode: "131001",
          title: "千代田の会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            {
              topic: "観光振興",
              relevance: "primary",
              digest: "観光客誘致について",
              speakers: [],
            },
          ],
        },
      ]);

      const rows = await searchTopics(tx, {
        query: "観光",
        municipalityCode: "462012",
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]!.title).toBe("鹿児島の会議");
    });
  });

  it("dateFrom / dateTo で開催日フィルタ", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      await tx.insert(meetings).values([
        {
          municipalityCode: "462012",
          title: "古い会議",
          meetingType: "定例会",
          heldOn: "2023-03-01",
          topicDigests: [
            {
              topic: "防災",
              relevance: "primary",
              digest: "防災について",
              speakers: [],
            },
          ],
        },
        {
          municipalityCode: "462012",
          title: "新しい会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            {
              topic: "防災",
              relevance: "primary",
              digest: "防災について",
              speakers: [],
            },
          ],
        },
      ]);

      const rows = await searchTopics(tx, {
        query: "防災",
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]!.title).toBe("新しい会議");
    });
  });

  it("heldOn 降順でソートされる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      await tx.insert(meetings).values([
        {
          municipalityCode: "462012",
          title: "3月会議",
          meetingType: "定例会",
          heldOn: "2024-03-01",
          topicDigests: [
            { topic: "防災", relevance: "primary", digest: "防災", speakers: [] },
          ],
        },
        {
          municipalityCode: "462012",
          title: "9月会議",
          meetingType: "定例会",
          heldOn: "2024-09-01",
          topicDigests: [
            { topic: "防災", relevance: "primary", digest: "防災", speakers: [] },
          ],
        },
        {
          municipalityCode: "462012",
          title: "6月会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            { topic: "防災", relevance: "primary", digest: "防災", speakers: [] },
          ],
        },
      ]);

      const rows = await searchTopics(tx, { query: "防災" });

      expect(rows).toHaveLength(3);
      expect(rows[0]!.title).toBe("9月会議");
      expect(rows[1]!.title).toBe("6月会議");
      expect(rows[2]!.title).toBe("3月会議");
    });
  });

  it("limit で件数制限できる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      await tx.insert(meetings).values([
        {
          municipalityCode: "462012",
          title: "会議A",
          meetingType: "定例会",
          heldOn: "2024-03-01",
          topicDigests: [
            { topic: "防災", relevance: "primary", digest: "防災", speakers: [] },
          ],
        },
        {
          municipalityCode: "462012",
          title: "会議B",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            { topic: "防災", relevance: "primary", digest: "防災", speakers: [] },
          ],
        },
      ]);

      const rows = await searchTopics(tx, { query: "防災", limit: 1 });

      expect(rows).toHaveLength(1);
    });
  });

  it("topic_digests が null の会議はマッチしない", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      await tx.insert(meetings).values({
        municipalityCode: "462012",
        title: "topic_digests なし",
        meetingType: "定例会",
        heldOn: "2024-06-01",
        summary: "防災について",
      });

      const rows = await searchTopics(tx, { query: "防災" });

      expect(rows).toHaveLength(0);
    });
  });
});

describe("getMeetingDigest", () => {
  it("会議のサマリと topic_digests を取得できる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      const [meeting] = await tx
        .insert(meetings)
        .values({
          municipalityCode: "462012",
          title: "令和6年第2回定例会",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          sourceUrl: "https://example.com/meeting",
          summary: "今回は防災と交通の議論があった。",
          topicDigests: [
            {
              topic: "防災",
              relevance: "primary",
              digest: "防災計画の見直しについて",
              speakers: ["田中議員"],
            },
            {
              topic: "交通",
              relevance: "secondary",
              digest: "市バスの運行について",
              speakers: ["佐藤議員"],
            },
          ],
        })
        .returning();

      const digest = await getMeetingDigest(tx, meeting!.id);

      expect(digest).not.toBeNull();
      expect(digest!.meetingId).toBe(meeting!.id);
      expect(digest!.title).toBe("令和6年第2回定例会");
      expect(digest!.heldOn).toBe("2024-06-01");
      expect(digest!.meetingType).toBe("定例会");
      expect(digest!.sourceUrl).toBe("https://example.com/meeting");
      expect(digest!.summary).toBe("今回は防災と交通の議論があった。");
      expect(digest!.topicDigests).toHaveLength(2);
      expect(digest!.topicDigests[0]!.topic).toBe("防災");
      expect(digest!.topicDigests[1]!.topic).toBe("交通");
    });
  });

  it("存在しない meetingId では null を返す", async () => {
    await withRollback(db, async (tx) => {
      const digest = await getMeetingDigest(tx, "nonexistent-id");

      expect(digest).toBeNull();
    });
  });

  it("topic_digests が null の場合は空配列を返す", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      const [meeting] = await tx
        .insert(meetings)
        .values({
          municipalityCode: "462012",
          title: "topic_digests なしの会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
        })
        .returning();

      const digest = await getMeetingDigest(tx, meeting!.id);

      expect(digest).not.toBeNull();
      expect(digest!.topicDigests).toHaveLength(0);
      expect(digest!.summary).toBeNull();
    });
  });
});

describe("findMeetingsWithTopics", () => {
  it("複数 topic すべてにマッチする会議を返す", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      const [matched] = await tx
        .insert(meetings)
        .values({
          municipalityCode: "462012",
          title: "両方の議題を含む会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            {
              topic: "市バス路線再編",
              relevance: "primary",
              digest: "路線の再編について議論",
              speakers: [],
            },
            {
              topic: "市バスICカード事業",
              relevance: "primary",
              digest: "ICカード導入について議論",
              speakers: [],
            },
          ],
        })
        .returning();
      await tx.insert(meetings).values({
        municipalityCode: "462012",
        title: "片方しか含まない会議",
        meetingType: "定例会",
        heldOn: "2024-03-01",
        topicDigests: [
          {
            topic: "市バス路線再編",
            relevance: "primary",
            digest: "路線の再編について議論",
            speakers: [],
          },
        ],
      });

      const rows = await findMeetingsWithTopics(tx, {
        topics: ["市バス路線再編", "ICカード"],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]!.meetingId).toBe(matched!.id);
      expect(rows[0]!.matchedTopicsByQuery["市バス路線再編"]).toContain(
        "市バス路線再編",
      );
      expect(rows[0]!.matchedTopicsByQuery["ICカード"]).toContain(
        "市バスICカード事業",
      );
    });
  });

  it("topics が空配列のとき空配列を返す", async () => {
    await withRollback(db, async (tx) => {
      const rows = await findMeetingsWithTopics(tx, { topics: [] });

      expect(rows).toHaveLength(0);
    });
  });

  it("municipalityCode でフィルタできる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "462012", name: "鹿児島市", prefecture: "鹿児島県" },
        { code: "131001", name: "千代田区", prefecture: "東京都" },
      ]);
      await tx.insert(meetings).values([
        {
          municipalityCode: "462012",
          title: "鹿児島の会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            {
              topic: "防災A",
              relevance: "primary",
              digest: "防災A",
              speakers: [],
            },
            {
              topic: "防災B",
              relevance: "primary",
              digest: "防災B",
              speakers: [],
            },
          ],
        },
        {
          municipalityCode: "131001",
          title: "千代田の会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            {
              topic: "防災A",
              relevance: "primary",
              digest: "防災A",
              speakers: [],
            },
            {
              topic: "防災B",
              relevance: "primary",
              digest: "防災B",
              speakers: [],
            },
          ],
        },
      ]);

      const rows = await findMeetingsWithTopics(tx, {
        topics: ["防災A", "防災B"],
        municipalityCode: "462012",
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]!.title).toBe("鹿児島の会議");
    });
  });

  it("heldOn 降順でソートされる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "462012",
        name: "鹿児島市",
        prefecture: "鹿児島県",
      });
      await tx.insert(meetings).values([
        {
          municipalityCode: "462012",
          title: "古い会議",
          meetingType: "定例会",
          heldOn: "2023-06-01",
          topicDigests: [
            { topic: "A", relevance: "primary", digest: "A", speakers: [] },
            { topic: "B", relevance: "primary", digest: "B", speakers: [] },
          ],
        },
        {
          municipalityCode: "462012",
          title: "新しい会議",
          meetingType: "定例会",
          heldOn: "2024-06-01",
          topicDigests: [
            { topic: "A", relevance: "primary", digest: "A", speakers: [] },
            { topic: "B", relevance: "primary", digest: "B", speakers: [] },
          ],
        },
      ]);

      const rows = await findMeetingsWithTopics(tx, { topics: ["A", "B"] });

      expect(rows).toHaveLength(2);
      expect(rows[0]!.title).toBe("新しい会議");
      expect(rows[1]!.title).toBe("古い会議");
    });
  });
});
