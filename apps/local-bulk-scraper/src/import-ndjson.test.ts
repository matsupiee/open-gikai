import { createHash } from "node:crypto";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  getTestDb,
  closeTestDb,
  withRollback,
} from "@open-gikai/db/test-helpers";
import {
  system_types,
  municipalities,
  meetings,
  statements,
  statement_chunks,
} from "@open-gikai/db/schema";
import { eq, inArray } from "drizzle-orm";

let db: ReturnType<typeof getTestDb>;

beforeAll(() => {
  db = getTestDb();
});

afterAll(async () => {
  await closeTestDb(db);
});

describe("import-ndjson DB統合テスト", () => {
  test("NDJSON データを DB にバッチインポートできる", async () => {
    await withRollback(db, async (tx) => {
      // 自治体を作成
      const [systemType] = await tx
        .insert(system_types)
        .values({ name: "dbsearch", description: "DBサーチシステム" })
        .returning();

      const [municipality] = await tx
        .insert(municipalities)
        .values({
          code: "999010",
          name: "インポートテスト市",
          prefecture: "テスト県",
          systemTypeId: systemType!.id,
          baseUrl: "https://example.dbsr.jp/index.php/99999",
          enabled: true,
        })
        .returning();

      // NDJSON レコードを構築（scrape-to-ndjson の出力形式）
      const meetingId = "import-test-meeting-001";
      const now = new Date().toISOString();

      const meetingRecords = [
        {
          id: meetingId,
          municipalityId: municipality!.id,
          title: "令和６年第２回定例会",
          meetingType: "plenary",
          heldOn: "2024-06-15",
          sourceUrl: "https://example.dbsr.jp/index.php/99999?Template=view&Id=200",
          externalId: "dbsearch_200",
          status: "processed",
          scrapedAt: now,
        },
      ];

      const stmtContent1 = "ただいまから令和６年第２回定例会を開会いたします。";
      const stmtContent2 =
        "市の財政運営について質問いたします。来年度の予算編成方針についてお伺いします。";
      const stmtContent3 =
        "財政運営についてお答えいたします。来年度の予算編成方針は、歳出の効率化と新規財源の確保を二本柱として進めてまいります。";

      const statementRecords = [
        {
          id: "import-stmt-001",
          meetingId,
          kind: "remark",
          speakerName: "山田太郎",
          speakerRole: "議長",
          content: stmtContent1,
          contentHash: createHash("sha256").update(stmtContent1).digest("hex"),
          startOffset: 0,
          endOffset: stmtContent1.length,
          chunkId: null,
        },
        {
          id: "import-stmt-002",
          meetingId,
          kind: "question",
          speakerName: "佐藤花子",
          speakerRole: "議員",
          content: stmtContent2,
          contentHash: createHash("sha256").update(stmtContent2).digest("hex"),
          startOffset: stmtContent1.length + 1,
          endOffset: stmtContent1.length + 1 + stmtContent2.length,
          chunkId: null,
        },
        {
          id: "import-stmt-003",
          meetingId,
          kind: "answer",
          speakerName: "鈴木一郎",
          speakerRole: "市長",
          content: stmtContent3,
          contentHash: createHash("sha256").update(stmtContent3).digest("hex"),
          startOffset: stmtContent1.length + 1 + stmtContent2.length + 1,
          endOffset:
            stmtContent1.length +
            1 +
            stmtContent2.length +
            1 +
            stmtContent3.length,
          chunkId: null,
        },
      ];

      const chunkContent1 = stmtContent2;
      const chunkContent2 = stmtContent3;

      const chunkRecords = [
        {
          id: "import-chunk-001",
          meetingId,
          speakerName: "佐藤花子",
          speakerRole: "議員",
          chunkIndex: 0,
          content: chunkContent1,
          contentHash: createHash("sha256")
            .update(chunkContent1)
            .digest("hex"),
          embedding: null,
        },
        {
          id: "import-chunk-002",
          meetingId,
          speakerName: "鈴木一郎",
          speakerRole: "市長",
          chunkIndex: 0,
          content: chunkContent2,
          contentHash: createHash("sha256")
            .update(chunkContent2)
            .digest("hex"),
          embedding: null,
        },
      ];

      // import-ndjson.ts と同じ DB インポートロジックを実行

      // 1. meetings の INSERT
      for (const r of meetingRecords) {
        await tx
          .insert(meetings)
          .values({
            id: r.id,
            municipalityId: r.municipalityId,
            title: r.title,
            meetingType: r.meetingType,
            heldOn: r.heldOn,
            sourceUrl: r.sourceUrl ?? null,
            externalId: r.externalId ?? null,
            status: r.status,
            scrapedAt: r.scrapedAt ? new Date(r.scrapedAt) : null,
          })
          .onConflictDoNothing();
      }

      // 2. statement_chunks の INSERT（statements より先）
      for (const r of chunkRecords) {
        await tx
          .insert(statement_chunks)
          .values({
            id: r.id,
            meetingId: r.meetingId,
            speakerName: r.speakerName ?? null,
            speakerRole: r.speakerRole ?? null,
            chunkIndex: r.chunkIndex ?? 0,
            content: r.content,
            contentHash: r.contentHash,
            embedding: r.embedding ?? null,
          })
          .onConflictDoNothing();
      }

      // 3. statements の INSERT
      for (const r of statementRecords) {
        await tx
          .insert(statements)
          .values({
            id: r.id,
            meetingId: r.meetingId,
            kind: r.kind,
            speakerName: r.speakerName ?? null,
            speakerRole: r.speakerRole ?? null,
            content: r.content,
            contentHash: r.contentHash,
            startOffset: r.startOffset ?? null,
            endOffset: r.endOffset ?? null,
            chunkId: r.chunkId ?? null,
          })
          .onConflictDoNothing();
      }

      // 検証: meetings
      const dbMeetings = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      expect(dbMeetings).toHaveLength(1);
      expect(dbMeetings[0]!.title).toBe("令和６年第２回定例会");
      expect(dbMeetings[0]!.meetingType).toBe("plenary");
      expect(dbMeetings[0]!.heldOn).toBe("2024-06-15");
      expect(dbMeetings[0]!.status).toBe("processed");
      expect(dbMeetings[0]!.externalId).toBe("dbsearch_200");
      expect(dbMeetings[0]!.municipalityId).toBe(municipality!.id);

      // 検証: statements
      const dbStatements = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, meetingId));
      expect(dbStatements).toHaveLength(3);

      const remark = dbStatements.find((s) => s.kind === "remark");
      expect(remark!.speakerName).toBe("山田太郎");
      expect(remark!.speakerRole).toBe("議長");
      expect(remark!.content).toContain("開会いたします");

      const question = dbStatements.find((s) => s.kind === "question");
      expect(question!.speakerName).toBe("佐藤花子");
      expect(question!.content).toContain("財政運営について");

      const answer = dbStatements.find((s) => s.kind === "answer");
      expect(answer!.speakerName).toBe("鈴木一郎");
      expect(answer!.content).toContain("歳出の効率化");

      // 検証: statement_chunks
      const dbChunks = await tx
        .select()
        .from(statement_chunks)
        .where(eq(statement_chunks.meetingId, meetingId));
      expect(dbChunks).toHaveLength(2);

      const questionChunk = dbChunks.find(
        (c) => c.speakerName === "佐藤花子",
      );
      expect(questionChunk!.speakerRole).toBe("議員");
      expect(questionChunk!.chunkIndex).toBe(0);
      expect(questionChunk!.content).toContain("財政運営について");

      const answerChunk = dbChunks.find(
        (c) => c.speakerName === "鈴木一郎",
      );
      expect(answerChunk!.speakerRole).toBe("市長");
      expect(answerChunk!.content).toContain("歳出の効率化");
    });
  });

  test("既存の meetings を DELETE してから再インポートできる", async () => {
    await withRollback(db, async (tx) => {
      const [systemType] = await tx
        .insert(system_types)
        .values({ name: "dbsearch", description: "DBサーチシステム" })
        .returning();

      const [municipality] = await tx
        .insert(municipalities)
        .values({
          code: "999011",
          name: "再インポートテスト市",
          prefecture: "テスト県",
          systemTypeId: systemType!.id,
          baseUrl: "https://example.dbsr.jp/index.php/99999",
          enabled: true,
        })
        .returning();

      const meetingId = "reimport-meeting-001";

      // 初回インポート
      await tx.insert(meetings).values({
        id: meetingId,
        municipalityId: municipality!.id,
        title: "旧タイトル",
        meetingType: "plenary",
        heldOn: "2024-01-01",
        status: "processed",
      });

      const oldContent = "旧発言内容";
      await tx.insert(statements).values({
        id: "reimport-stmt-old",
        meetingId,
        kind: "remark",
        speakerName: "旧議長",
        speakerRole: "議長",
        content: oldContent,
        contentHash: createHash("sha256").update(oldContent).digest("hex"),
      });

      // 既存データの確認
      const before = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      expect(before).toHaveLength(1);
      expect(before[0]!.title).toBe("旧タイトル");

      // DELETE（import-ndjson と同じロジック）
      await tx
        .delete(meetings)
        .where(inArray(meetings.id, [meetingId]));

      // CASCADE で statements も削除されているか確認
      const statementsAfterDelete = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, meetingId));
      expect(statementsAfterDelete).toHaveLength(0);

      // 再インポート
      await tx.insert(meetings).values({
        id: meetingId,
        municipalityId: municipality!.id,
        title: "新タイトル",
        meetingType: "committee",
        heldOn: "2024-06-01",
        status: "processed",
      });

      const newContent = "新しい発言内容";
      await tx.insert(statements).values({
        id: "reimport-stmt-new",
        meetingId,
        kind: "question",
        speakerName: "新議員",
        speakerRole: "議員",
        content: newContent,
        contentHash: createHash("sha256").update(newContent).digest("hex"),
      });

      // 再インポート後の検証
      const after = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      expect(after).toHaveLength(1);
      expect(after[0]!.title).toBe("新タイトル");
      expect(after[0]!.meetingType).toBe("committee");

      const newStatements = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, meetingId));
      expect(newStatements).toHaveLength(1);
      expect(newStatements[0]!.speakerName).toBe("新議員");
      expect(newStatements[0]!.kind).toBe("question");
    });
  });

  test("onConflictDoNothing で重複インポートがエラーにならない", async () => {
    await withRollback(db, async (tx) => {
      const [systemType] = await tx
        .insert(system_types)
        .values({ name: "dbsearch", description: "DBサーチシステム" })
        .returning();

      const [municipality] = await tx
        .insert(municipalities)
        .values({
          code: "999012",
          name: "重複テスト市",
          prefecture: "テスト県",
          systemTypeId: systemType!.id,
          baseUrl: "https://example.dbsr.jp/index.php/99999",
          enabled: true,
        })
        .returning();

      const meetingId = "duplicate-meeting-001";
      const content = "テスト発言";

      // 1回目のインポート
      await tx.insert(meetings).values({
        id: meetingId,
        municipalityId: municipality!.id,
        title: "テスト会議",
        meetingType: "plenary",
        heldOn: "2024-09-01",
        status: "processed",
      });

      await tx.insert(statements).values({
        id: "dup-stmt-001",
        meetingId,
        kind: "remark",
        speakerName: "議長",
        speakerRole: "議長",
        content,
        contentHash: createHash("sha256").update(content).digest("hex"),
      });

      // 2回目のインポート（onConflictDoNothing でエラーにならない）
      await tx
        .insert(meetings)
        .values({
          id: meetingId,
          municipalityId: municipality!.id,
          title: "テスト会議（重複）",
          meetingType: "plenary",
          heldOn: "2024-09-01",
          status: "processed",
        })
        .onConflictDoNothing();

      await tx
        .insert(statements)
        .values({
          id: "dup-stmt-001",
          meetingId,
          kind: "remark",
          speakerName: "議長",
          speakerRole: "議長",
          content,
          contentHash: createHash("sha256").update(content).digest("hex"),
        })
        .onConflictDoNothing();

      // 重複でも1件のまま
      const dbMeetings = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      expect(dbMeetings).toHaveLength(1);
      expect(dbMeetings[0]!.title).toBe("テスト会議");
    });
  });
});
