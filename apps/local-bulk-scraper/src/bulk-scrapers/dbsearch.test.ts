import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
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
import { buildChunksFromStatements } from "@open-gikai/scrapers/statement-chunking";

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

/**
 * fetch モックをセットアップする。
 * yearFilter を指定すると、その年のみ結果を返し、他の年は空結果を返す。
 */
function setupFetchMock(opts?: { yearFilter?: number }) {
  const topHtml = loadFixture("dbsearch-top.html");
  const listHtml = loadFixture("dbsearch-list.html");
  const detailHtml = loadFixture("dbsearch-detail.html");
  const emptyListHtml = `
    <form action="https://test-city.dbsr.jp/index.php/88888">
      <div class="search-results"></div>
      <button aria-label="次のページ" aria-disabled="true">次へ</button>
    </form>
  `;

  let postCount = 0;

  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    if (init?.method === "POST") {
      postCount++;
      // yearFilter が指定されている場合、最初のPOSTのみ結果を返す
      if (opts?.yearFilter !== undefined && postCount > 1) {
        return new Response(emptyListHtml, { status: 200 });
      }
      return new Response(listHtml, { status: 200 });
    }

    if (url.includes("Template=view") || url.includes("Template=document")) {
      return new Response(detailHtml, { status: 200 });
    }

    return new Response(topHtml, {
      status: 200,
      headers: new Headers({ "set-cookie": "session=test-session" }),
    });
  });
}

describe("dbsearch バルクスクレイパー統合テスト", () => {
  describe("HTMLフィクスチャからのスクレイピング", () => {
    test("MeetingData を正しく生成する", async () => {
      // 1年分のみ結果を返すようモック設定
      setupFetchMock({ yearFilter: 2024 });

      const meetingDataList = await scrapeAll(
        "test-muni-id",
        "テスト市",
        "https://test-city.dbsr.jp/index.php/99999",
      );

      // フィクスチャには2件のリンクがあるので2件の MeetingData
      expect(meetingDataList).toHaveLength(2);

      const first = meetingDataList[0]!;
      expect(first.municipalityId).toBe("test-muni-id");
      expect(first.title).toBe("令和６年第１回定例会 本会議");
      expect(first.meetingType).toBe("plenary");
      expect(first.heldOn).toBe("2024-03-15");
      expect(first.externalId).toBe("dbsearch_1001");

      // 発言の検証
      expect(first.statements).toHaveLength(5);

      expect(first.statements[0]!.speakerRole).toBe("議長");
      expect(first.statements[0]!.speakerName).toBe("山田太郎");
      expect(first.statements[0]!.kind).toBe("remark");

      expect(first.statements[1]!.speakerRole).toBe("議員");
      expect(first.statements[1]!.speakerName).toBe("佐藤花子");
      expect(first.statements[1]!.kind).toBe("question");

      expect(first.statements[2]!.speakerRole).toBe("市長");
      expect(first.statements[2]!.speakerName).toBe("鈴木一郎");
      expect(first.statements[2]!.kind).toBe("answer");

      expect(first.statements[4]!.speakerRole).toBe("教育部長");
      expect(first.statements[4]!.speakerName).toBe("田中三郎");
      expect(first.statements[4]!.kind).toBe("answer");

      // 2件目（同じ詳細フィクスチャを返すため title/type は同一）
      const second = meetingDataList[1]!;
      expect(second.externalId).toBe("dbsearch_1002");
    });

    test("fetch が失敗した場合は空配列を返す", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        return new Response("", { status: 500 });
      });

      const result = await scrapeAll(
        "muni-id",
        "テスト市",
        "https://test-city.dbsr.jp/index.php/99999",
      );
      expect(result).toEqual([]);
    });
  });

  describe("スクレイピング結果の DB インポート", () => {
    test("MeetingData → statement-chunking → DB INSERT の一連の流れが動作する", async () => {
      setupFetchMock({ yearFilter: 2024 });

      const meetingDataList = await scrapeAll(
        "placeholder",
        "テスト市",
        "https://test-city.dbsr.jp/index.php/99999",
      );

      const meetingData = meetingDataList[0]!;

      await withRollback(db, async (tx) => {
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

        // meetings: id は DB 自動生成
        const [dbMeeting] = await tx
          .insert(meetings)
          .values({
            municipalityId: municipality!.id,
            title: meetingData.title,
            meetingType: meetingData.meetingType,
            heldOn: meetingData.heldOn,
            sourceUrl: meetingData.sourceUrl,
            externalId: meetingData.externalId,
            status: "processed",
          })
          .returning();

        // statements: id は DB 自動生成
        const dbStatements = [];
        for (const s of meetingData.statements) {
          const [row] = await tx
            .insert(statements)
            .values({
              meetingId: dbMeeting!.id,
              kind: s.kind,
              speakerName: s.speakerName,
              speakerRole: s.speakerRole,
              content: s.content,
              contentHash: s.contentHash,
              startOffset: s.startOffset,
              endOffset: s.endOffset,
            })
            .returning();
          dbStatements.push(row!);
        }

        // statement_chunks を生成して INSERT
        const chunkInputs = buildChunksFromStatements(
          dbStatements.map((s) => ({
            id: s.id,
            speakerName: s.speakerName,
            speakerRole: s.speakerRole,
            content: s.content,
          })),
        );

        for (const chunk of chunkInputs) {
          const contentHash = createHash("sha256")
            .update(chunk.content)
            .digest("hex");
          await tx.insert(statement_chunks).values({
            meetingId: dbMeeting!.id,
            speakerName: chunk.speakerName,
            speakerRole: chunk.speakerRole,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            contentHash,
            embedding: null,
          });
        }

        // 検証: meetings
        const meetingRows = await tx
          .select()
          .from(meetings)
          .where(eq(meetings.id, dbMeeting!.id));
        expect(meetingRows).toHaveLength(1);
        expect(meetingRows[0]!.title).toBe("令和６年第１回定例会 本会議");
        expect(meetingRows[0]!.meetingType).toBe("plenary");

        // 検証: statements
        const stmtRows = await tx
          .select()
          .from(statements)
          .where(eq(statements.meetingId, dbMeeting!.id));
        expect(stmtRows).toHaveLength(5);

        const questionStmts = stmtRows.filter((s) => s.kind === "question");
        const answerStmts = stmtRows.filter((s) => s.kind === "answer");
        const remarkStmts = stmtRows.filter((s) => s.kind === "remark");
        expect(questionStmts).toHaveLength(2);
        expect(answerStmts).toHaveLength(2);
        expect(remarkStmts).toHaveLength(1);

        // 検証: statement_chunks
        const chunkRows = await tx
          .select()
          .from(statement_chunks)
          .where(eq(statement_chunks.meetingId, dbMeeting!.id));
        expect(chunkRows.length).toBeGreaterThan(0);
        for (const chunk of chunkRows) {
          expect(chunk.content.length).toBeGreaterThan(0);
          expect(chunk.contentHash).toMatch(/^[0-9a-f]{64}$/);
        }
      });
    });
  });
});
