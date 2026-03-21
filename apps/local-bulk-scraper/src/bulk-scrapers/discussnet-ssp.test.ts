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
import { buildChunksFromStatements } from "@open-gikai/scrapers/statement-chunking";
import { scrapeAll } from "./discussnet-ssp";

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
 * URL パターンに応じて対応するフィクスチャを返す。
 *
 * - GET  /tenant/.../js/tenant.js     → tenant.js (plain text)
 * - POST /councils/index              → councils.json
 * - POST /minutes/get_schedule        → schedules.json
 * - POST /minutes/get_minute          → minutes.json
 */
function setupFetchMock() {
  const tenantJs = loadFixture("discussnet-ssp-tenant.js");
  const councilsJson = loadFixture("discussnet-ssp-councils.json");
  const schedulesJson = loadFixture("discussnet-ssp-schedules.json");
  const minutesJson = loadFixture("discussnet-ssp-minutes.json");

  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    // GET: tenant.js
    if (url.includes("/js/tenant.js")) {
      return new Response(tenantJs, {
        status: 200,
        headers: { "Content-Type": "text/javascript" },
      });
    }

    // POST endpoints
    if (init?.method === "POST") {
      if (url.includes("councils/index")) {
        return new Response(councilsJson, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("minutes/get_schedule")) {
        return new Response(schedulesJson, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("minutes/get_minute")) {
        return new Response(minutesJson, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("", { status: 404 });
  });
}

describe("discussnet-ssp バルクスクレイパー統合テスト", () => {
  describe("APIフィクスチャからのスクレイピング", () => {
    test("tenant.js → councils → schedules → minutes の一連のパース処理が動作する", async () => {
      setupFetchMock();

      const result = await scrapeAll(
        "test-muni-ssp",
        "テスト村",
        "https://ssp.kaigiroku.net/tenant/test-village/SpTop.html",
      );

      // 2 councils × 1 schedule = 2 meetings
      expect(result).toHaveLength(2);

      // 1件目: 本会議
      const plenary = result[0]!;
      expect(plenary.municipalityId).toBe("test-muni-ssp");
      expect(plenary.title).toBe("本会議 第1回定例会");
      expect(plenary.meetingType).toBe("plenary");
      expect(plenary.heldOn).toBe("2024-03-15");
      expect(plenary.externalId).toBe("discussnet_ssp_42_10_300");

      // minute_type_code=3 (議題) はスキップされるので5件の発言
      expect(plenary.statements).toHaveLength(5);

      // 議長発言 (code=4 → remark)
      expect(plenary.statements[0]!.kind).toBe("remark");
      expect(plenary.statements[0]!.speakerRole).toBe("議長");
      expect(plenary.statements[0]!.speakerName).toBe("山田太郎");
      expect(plenary.statements[0]!.content).toContain(
        "本日の議事日程は、お手元に配付のとおりであります",
      );

      // 質問 (code=5 → question)
      expect(plenary.statements[1]!.kind).toBe("question");
      expect(plenary.statements[1]!.speakerRole).toBe("１番");
      expect(plenary.statements[1]!.speakerName).toBe("佐藤花子");
      expect(plenary.statements[1]!.content).toContain("福祉政策について質問");

      // 答弁 (code=6 → answer)
      expect(plenary.statements[2]!.kind).toBe("answer");
      expect(plenary.statements[2]!.speakerRole).toBe("福祉部長");
      expect(plenary.statements[2]!.speakerName).toBe("鈴木一郎");
      expect(plenary.statements[2]!.content).toContain("訪問介護サービスの利用者数は月平均３２０名");

      // contentHash が生成されている
      expect(plenary.statements[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);

      // offset が正しく計算されている
      expect(plenary.statements[0]!.startOffset).toBe(0);
      expect(plenary.statements[0]!.endOffset).toBeGreaterThan(0);
      expect(plenary.statements[1]!.startOffset).toBe(
        plenary.statements[0]!.endOffset + 1,
      );

      // 2件目: 総務委員会
      const committee = result[1]!;
      expect(committee.meetingType).toBe("committee");
      expect(committee.title).toBe("総務委員会 第1回定例会");
    });

    test("テナントスラッグ抽出失敗時は空配列を返す", async () => {
      setupFetchMock();

      const result = await scrapeAll(
        "muni-id",
        "テスト村",
        "https://ssp.kaigiroku.net/invalid-url",
      );
      expect(result).toEqual([]);
    });

    test("fetch が失敗した場合は空配列を返す", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        return new Response("", { status: 500 });
      });

      const result = await scrapeAll(
        "muni-id",
        "テスト村",
        "https://ssp.kaigiroku.net/tenant/test-village/SpTop.html",
      );
      expect(result).toEqual([]);
    });
  });

  describe("スクレイピング結果の DB インポート", () => {
    test("MeetingData → statement-chunking → DB INSERT の一連の流れが動作する", async () => {
      setupFetchMock();

      const meetingDataList = await scrapeAll(
        "placeholder",
        "テスト村",
        "https://ssp.kaigiroku.net/tenant/test-village/SpTop.html",
      );

      const meetingData = meetingDataList[0]!;

      await withRollback(db, async (tx) => {
        const [systemType] = await tx
          .insert(system_types)
          .values({ name: "discussnet_ssp", description: "DiscussNet SSP" })
          .returning();

        const [municipality] = await tx
          .insert(municipalities)
          .values({
            code: "999020",
            name: "テスト村",
            prefecture: "テスト県",
            systemTypeId: systemType!.id,
            baseUrl: "https://ssp.kaigiroku.net/tenant/test-village/SpTop.html",
            enabled: true,
          })
          .returning();

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

        // 検証: statements
        const stmtRows = await tx
          .select()
          .from(statements)
          .where(eq(statements.meetingId, dbMeeting!.id));
        expect(stmtRows).toHaveLength(5);

        const kinds = stmtRows.map((s) => s.kind).sort();
        expect(kinds).toEqual(["answer", "answer", "question", "question", "remark"]);

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
