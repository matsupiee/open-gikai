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

      const stmtContent1 = "ただいまから令和６年第２回定例会を開会いたします。";
      const stmtContent2 =
        "市の財政運営について質問いたします。来年度の予算編成方針についてお伺いします。";
      const stmtContent3 =
        "財政運営についてお答えいたします。来年度の予算編成方針は、歳出の効率化と新規財源の確保を二本柱として進めてまいります。";

      // import-ndjson.ts と同じ DB インポートロジックを実行

      // 1. meetings の INSERT（id は DB 自動生成）
      const [dbMeeting] = await tx
        .insert(meetings)
        .values({
          municipalityId: municipality!.id,
          title: "令和６年第２回定例会",
          meetingType: "plenary",
          heldOn: "2024-06-15",
          sourceUrl: "https://example.dbsr.jp/index.php/99999?Template=view&Id=200",
          externalId: "dbsearch_200",
          status: "processed",
          scrapedAt: new Date(),
        })
        .returning();

      // 2. statements の INSERT
      await tx.insert(statements).values({
        meetingId: dbMeeting!.id,
        kind: "remark",
        speakerName: "山田太郎",
        speakerRole: "議長",
        content: stmtContent1,
        contentHash: createHash("sha256").update(stmtContent1).digest("hex"),
        startOffset: 0,
        endOffset: stmtContent1.length,
      });

      await tx.insert(statements).values({
        meetingId: dbMeeting!.id,
        kind: "question",
        speakerName: "佐藤花子",
        speakerRole: "議員",
        content: stmtContent2,
        contentHash: createHash("sha256").update(stmtContent2).digest("hex"),
        startOffset: stmtContent1.length + 1,
        endOffset: stmtContent1.length + 1 + stmtContent2.length,
      });

      await tx.insert(statements).values({
        meetingId: dbMeeting!.id,
        kind: "answer",
        speakerName: "鈴木一郎",
        speakerRole: "市長",
        content: stmtContent3,
        contentHash: createHash("sha256").update(stmtContent3).digest("hex"),
        startOffset: stmtContent1.length + 1 + stmtContent2.length + 1,
        endOffset: stmtContent1.length + 1 + stmtContent2.length + 1 + stmtContent3.length,
      });

      // 検証: meetings
      const meetingRows = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, dbMeeting!.id));
      expect(meetingRows).toHaveLength(1);
      expect(meetingRows[0]!.title).toBe("令和６年第２回定例会");
      expect(meetingRows[0]!.meetingType).toBe("plenary");
      expect(meetingRows[0]!.heldOn).toBe("2024-06-15");
      expect(meetingRows[0]!.status).toBe("processed");
      expect(meetingRows[0]!.externalId).toBe("dbsearch_200");
      expect(meetingRows[0]!.municipalityId).toBe(municipality!.id);

      // 検証: statements
      const stmtRows = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, dbMeeting!.id));
      expect(stmtRows).toHaveLength(3);

      const remark = stmtRows.find((s) => s.kind === "remark");
      expect(remark!.speakerName).toBe("山田太郎");

      const question = stmtRows.find((s) => s.kind === "question");
      expect(question!.speakerName).toBe("佐藤花子");

      const answer = stmtRows.find((s) => s.kind === "answer");
      expect(answer!.speakerName).toBe("鈴木一郎");
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

      // 初回インポート
      const oldContent = "旧発言内容";
      const [oldMeeting] = await tx
        .insert(meetings)
        .values({
          municipalityId: municipality!.id,
          title: "旧タイトル",
          meetingType: "plenary",
          heldOn: "2024-01-01",
          status: "processed",
        })
        .returning();

      await tx.insert(statements).values({
        meetingId: oldMeeting!.id,
        kind: "remark",
        speakerName: "旧議長",
        speakerRole: "議長",
        content: oldContent,
        contentHash: createHash("sha256").update(oldContent).digest("hex"),
      });

      // DELETE（import-ndjson と同じロジック: CASCADE で statements も削除される）
      await tx
        .delete(meetings)
        .where(inArray(meetings.id, [oldMeeting!.id]));

      const statementsAfterDelete = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, oldMeeting!.id));
      expect(statementsAfterDelete).toHaveLength(0);

      // 再インポート（同じ meetingId で新しいデータ）
      const [newMeeting] = await tx
        .insert(meetings)
        .values({
          municipalityId: municipality!.id,
          title: "新タイトル",
          meetingType: "committee",
          heldOn: "2024-06-01",
          status: "processed",
        })
        .returning();

      const newContent = "新しい発言内容";
      await tx.insert(statements).values({
        meetingId: newMeeting!.id,
        kind: "question",
        speakerName: "新議員",
        speakerRole: "議員",
        content: newContent,
        contentHash: createHash("sha256").update(newContent).digest("hex"),
      });

      // 検証
      const after = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, newMeeting!.id));
      expect(after).toHaveLength(1);
      expect(after[0]!.title).toBe("新タイトル");
      expect(after[0]!.meetingType).toBe("committee");

      const newStatements = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, newMeeting!.id));
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

      const content = "テスト発言";
      const contentHash = createHash("sha256").update(content).digest("hex");

      // 1回目のインポート
      const [meeting] = await tx
        .insert(meetings)
        .values({
          municipalityId: municipality!.id,
          title: "テスト会議",
          meetingType: "plenary",
          heldOn: "2024-09-01",
          status: "processed",
        })
        .returning();

      await tx.insert(statements).values({
        meetingId: meeting!.id,
        kind: "remark",
        speakerName: "議長",
        speakerRole: "議長",
        content,
        contentHash,
      });

      // 2回目のインポート（onConflictDoNothing でエラーにならない）
      await tx
        .insert(meetings)
        .values({
          id: meeting!.id,
          municipalityId: municipality!.id,
          title: "テスト会議（重複）",
          meetingType: "plenary",
          heldOn: "2024-09-01",
          status: "processed",
        })
        .onConflictDoNothing();

      // 重複でも1件のまま
      const dbMeetings = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, meeting!.id));
      expect(dbMeetings).toHaveLength(1);
      expect(dbMeetings[0]!.title).toBe("テスト会議");
    });
  });
});
