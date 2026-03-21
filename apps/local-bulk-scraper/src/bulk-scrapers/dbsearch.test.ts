import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
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
import { eq } from "drizzle-orm";
import { scrapeAll } from "./dbsearch";
import { buildChunksFromStatements } from "../statement-chunking";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const fixturesDir = resolve(__dirname, "../__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(resolve(fixturesDir, name), "utf-8");
}

let db: ReturnType<typeof getTestDb>;

beforeAll(() => {
  db = getTestDb();
});

afterAll(async () => {
  await closeTestDb(db);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dbsearch バルクスクレイパー統合テスト", () => {
  test("HTMLフィクスチャからMeetingDataを生成し、DBにインポートできる", async () => {
    const topHtml = loadFixture("dbsearch-top.html");
    const listHtml = loadFixture("dbsearch-list.html");
    const detailHtml = loadFixture("dbsearch-detail.html");

    // fetch をモック: URL パターンに応じてフィクスチャを返す
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;

      // POST → 検索結果リスト
      if (init?.method === "POST") {
        return new Response(listHtml, { status: 200 });
      }

      // GET: Template=view を含む → 詳細ページ
      if (url.includes("Template=view") || url.includes("Template=document")) {
        return new Response(detailHtml, { status: 200 });
      }

      // GET: トップページ
      return new Response(topHtml, {
        status: 200,
        headers: new Headers({ "set-cookie": "session=test-session" }),
      });
    });

    await withRollback(db, async (tx) => {
      // DB に自治体を作成
      const [systemType] = await tx
        .insert(system_types)
        .values({ name: "dbsearch", description: "DBサーチシステム" })
        .returning();

      const [municipality] = await tx
        .insert(municipalities)
        .values({
          code: "999001",
          name: "テスト市",
          prefecture: "テスト県",
          systemTypeId: systemType!.id,
          baseUrl: "https://test-city.dbsr.jp/index.php/99999",
          enabled: true,
        })
        .returning();

      // scrapeAll を実行（直近5年分ループするが、モックは同じデータを返す）
      const meetingDataList = await scrapeAll(
        municipality!.id,
        "テスト市",
        "https://test-city.dbsr.jp/index.php/99999",
      );

      // 各年2件 × 5年 = 10件（同じフィクスチャが返るが、IDの重複除外で2件/年）
      expect(meetingDataList.length).toBeGreaterThanOrEqual(2);

      // 最初の MeetingData を検証
      const firstMeeting = meetingDataList[0]!;
      expect(firstMeeting.municipalityId).toBe(municipality!.id);
      expect(firstMeeting.title).toBe("令和６年第１回定例会 本会議");
      expect(firstMeeting.meetingType).toBe("plenary");
      expect(firstMeeting.heldOn).toBe("2024-03-15");
      expect(firstMeeting.externalId).toBe("dbsearch_1001");
      expect(firstMeeting.statements.length).toBe(5);

      // 発言の検証
      expect(firstMeeting.statements[0]!.speakerRole).toBe("議長");
      expect(firstMeeting.statements[0]!.speakerName).toBe("山田太郎");
      expect(firstMeeting.statements[0]!.kind).toBe("remark");

      expect(firstMeeting.statements[1]!.speakerRole).toBe("議員");
      expect(firstMeeting.statements[1]!.speakerName).toBe("佐藤花子");
      expect(firstMeeting.statements[1]!.kind).toBe("question");

      expect(firstMeeting.statements[2]!.speakerRole).toBe("市長");
      expect(firstMeeting.statements[2]!.speakerName).toBe("鈴木一郎");
      expect(firstMeeting.statements[2]!.kind).toBe("answer");

      // DB にインポート（1件だけテスト）
      const meetingData = firstMeeting;
      const meetingId = "test-meeting-id-001";

      await tx.insert(meetings).values({
        id: meetingId,
        municipalityId: meetingData.municipalityId,
        title: meetingData.title,
        meetingType: meetingData.meetingType,
        heldOn: meetingData.heldOn,
        sourceUrl: meetingData.sourceUrl,
        externalId: meetingData.externalId,
        status: "processed",
      });

      // statements をインポート
      const statementsWithIds = meetingData.statements.map((s, i) => ({
        id: `test-stmt-${i}`,
        meetingId,
        ...s,
      }));

      for (const s of statementsWithIds) {
        await tx.insert(statements).values({
          id: s.id,
          meetingId: s.meetingId,
          kind: s.kind,
          speakerName: s.speakerName,
          speakerRole: s.speakerRole,
          content: s.content,
          contentHash: s.contentHash,
          startOffset: s.startOffset,
          endOffset: s.endOffset,
        });
      }

      // statement_chunks を生成してインポート
      const chunkInputs = buildChunksFromStatements(
        statementsWithIds.map((s) => ({
          id: s.id,
          speakerName: s.speakerName,
          speakerRole: s.speakerRole,
          content: s.content,
        })),
      );

      for (let ci = 0; ci < chunkInputs.length; ci++) {
        const chunk = chunkInputs[ci]!;
        const contentHash = createHash("sha256")
          .update(chunk.content)
          .digest("hex");
        await tx.insert(statement_chunks).values({
          id: `test-chunk-${ci}`,
          meetingId,
          speakerName: chunk.speakerName,
          speakerRole: chunk.speakerRole,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash,
          embedding: null,
        });
      }

      // DB の検証: meetings
      const dbMeetings = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      expect(dbMeetings).toHaveLength(1);
      expect(dbMeetings[0]!.title).toBe("令和６年第１回定例会 本会議");
      expect(dbMeetings[0]!.meetingType).toBe("plenary");
      expect(dbMeetings[0]!.status).toBe("processed");

      // DB の検証: statements
      const dbStatements = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, meetingId));
      expect(dbStatements).toHaveLength(5);

      const questionStatements = dbStatements.filter(
        (s) => s.kind === "question",
      );
      const answerStatements = dbStatements.filter((s) => s.kind === "answer");
      const remarkStatements = dbStatements.filter((s) => s.kind === "remark");
      expect(questionStatements).toHaveLength(2);
      expect(answerStatements).toHaveLength(2);
      expect(remarkStatements).toHaveLength(1);

      // DB の検証: statement_chunks
      const dbChunks = await tx
        .select()
        .from(statement_chunks)
        .where(eq(statement_chunks.meetingId, meetingId));
      expect(dbChunks.length).toBeGreaterThan(0);
      // チャンクのスピーカーが正しいことを確認
      for (const chunk of dbChunks) {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.contentHash).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  });

  test("fetchが失敗した場合は空配列を返す", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response("", { status: 500 });
    });

    const result = await scrapeAll("muni-id", "テスト市", "https://test-city.dbsr.jp/index.php/99999");
    expect(result).toEqual([]);
  });
});
