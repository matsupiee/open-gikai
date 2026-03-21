import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
import { eq } from "drizzle-orm";
import {
  parseListHtml,
  extractStatementFromHuidPage,
  parseSidebarHuids,
  extractDateFromContent,
  detectMeetingType,
  classifyKind,
} from "@open-gikai/scrapers/gijiroku-com";
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

describe("gijiroku-com HTMLフィクスチャパース + DB統合テスト", () => {
  test("一覧HTMLから会議レコードを抽出できる", () => {
    const listHtml = loadFixture("gijiroku-com-list.html");
    const records = parseListHtml(listHtml);

    // 目次エントリはスキップされるので2件
    expect(records).toHaveLength(2);

    expect(records[0]!.fino).toBe("5002");
    expect(records[0]!.kgno).toBe("500");
    expect(records[0]!.unid).toBe("K_R06031500011");
    expect(records[0]!.dateLabel).toBe("03月15日-01号");
    expect(records[0]!.title).toContain("令和");
    expect(records[0]!.title).toContain("03月15日-01号");

    expect(records[1]!.fino).toBe("5003");
    expect(records[1]!.unid).toBe("K_R06031600021");
    expect(records[1]!.dateLabel).toBe("03月16日-02号");
  });

  test("ヘッダーHTMLから開催日を抽出できる", () => {
    const headerHtml = loadFixture("gijiroku-com-header.html");
    const date = extractDateFromContent(headerHtml);
    expect(date).toBe("2024-03-15");
  });

  test("サイドバーHTMLからHUID一覧を抽出できる", () => {
    const sidebarHtml = loadFixture("gijiroku-com-sidebar.html");
    const huids = parseSidebarHuids(sidebarHtml);

    // (名簿) と △ はスキップ
    expect(huids).toEqual(["100002", "100004", "100005"]);
  });

  test("HUIDページHTMLから発言を抽出できる", () => {
    const huid002 = loadFixture("gijiroku-com-huid-100002.html");
    const stmt1 = extractStatementFromHuidPage(huid002);
    expect(stmt1).not.toBeNull();
    expect(stmt1!.prefix).toBe("○");
    expect(stmt1!.speakerRole).toBe("議長");
    expect(stmt1!.speakerName).toBe("山田太郎");
    expect(stmt1!.content).toContain("ただいまから令和６年第１回定例会を開会いたします");

    const huid004 = loadFixture("gijiroku-com-huid-100004.html");
    const stmt2 = extractStatementFromHuidPage(huid004);
    expect(stmt2).not.toBeNull();
    expect(stmt2!.prefix).toBe("○");
    expect(stmt2!.speakerRole).toBe("１番");
    expect(stmt2!.speakerName).toBe("佐藤花子");
    expect(stmt2!.content).toContain("子育て支援策について質問いたします");

    const huid005 = loadFixture("gijiroku-com-huid-100005.html");
    const stmt3 = extractStatementFromHuidPage(huid005);
    expect(stmt3).not.toBeNull();
    expect(stmt3!.prefix).toBe("◎");
    expect(stmt3!.speakerRole).toBe("市長");
    expect(stmt3!.speakerName).toBe("鈴木一郎");
    expect(stmt3!.content).toContain("待機児童の解消につきましては");
  });

  test("HTMLフィクスチャから構築した MeetingData を DB にインポートできる", async () => {
    const headerHtml = loadFixture("gijiroku-com-header.html");
    const sidebarHtml = loadFixture("gijiroku-com-sidebar.html");

    const heldOn = extractDateFromContent(headerHtml)!;
    const huids = parseSidebarHuids(sidebarHtml);

    // 各 HUID ページから発言を抽出
    const huidFixtures: Record<string, string> = {
      "100002": "gijiroku-com-huid-100002.html",
      "100004": "gijiroku-com-huid-100004.html",
      "100005": "gijiroku-com-huid-100005.html",
    };

    const parsedStatements: {
      speakerName: string | null;
      speakerRole: string | null;
      prefix: string | null;
      content: string;
    }[] = [];

    for (const huid of huids) {
      const fixtureName = huidFixtures[huid];
      if (!fixtureName) continue;
      const html = loadFixture(fixtureName);
      const parsed = extractStatementFromHuidPage(html);
      if (parsed) parsedStatements.push(parsed);
    }

    // MeetingData を手動構築
    const title = "令和 ６年第１回定例会３月定例会議,03月15日-01号";
    const meetingType = detectMeetingType(title);
    expect(meetingType).toBe("plenary");

    let offset = 0;
    const statementsData = parsedStatements.map((s) => {
      const contentHash = createHash("sha256").update(s.content).digest("hex");
      const startOffset = offset;
      const endOffset = offset + s.content.length;
      offset = endOffset + 1;
      return {
        kind: classifyKind(s.speakerRole, s.prefix),
        speakerName: s.speakerName,
        speakerRole: s.speakerRole,
        content: s.content,
        contentHash,
        startOffset,
        endOffset,
      };
    });

    expect(statementsData).toHaveLength(3);
    expect(statementsData[0]!.kind).toBe("remark"); // 議長
    expect(statementsData[1]!.kind).toBe("question"); // 1番
    expect(statementsData[2]!.kind).toBe("answer"); // ◎市長

    await withRollback(db, async (tx) => {
      const [systemType] = await tx
        .insert(system_types)
        .values({ name: "gijiroku_com", description: "議事録.comシステム" })
        .returning();

      const [municipality] = await tx
        .insert(municipalities)
        .values({
          code: "999002",
          name: "テスト町",
          prefecture: "テスト県",
          systemTypeId: systemType!.id,
          baseUrl:
            "http://test-town.gijiroku.com/voices/g08v_search.asp",
          enabled: true,
        })
        .returning();

      const meetingId = "test-gijiroku-meeting-001";

      await tx.insert(meetings).values({
        id: meetingId,
        municipalityId: municipality!.id,
        title,
        meetingType,
        heldOn,
        sourceUrl: "https://test-town.gijiroku.com/voices/cgi/voiweb.exe?ACT=203&FINO=5002",
        externalId: "gijiroku_K_R06031500011",
        status: "processed",
      });

      // statements をインポート
      const statementsWithIds = statementsData.map((s, i) => ({
        id: `test-gijiroku-stmt-${i}`,
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

      for (let i = 0; i < chunkInputs.length; i++) {
        const chunk = chunkInputs[i]!;
        const contentHash = createHash("sha256")
          .update(chunk.content)
          .digest("hex");
        await tx.insert(statement_chunks).values({
          id: `test-gijiroku-chunk-${i}`,
          meetingId,
          speakerName: chunk.speakerName,
          speakerRole: chunk.speakerRole,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash,
          embedding: null,
        });
      }

      // DB の検証
      const dbMeetings = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      expect(dbMeetings).toHaveLength(1);
      expect(dbMeetings[0]!.heldOn).toBe("2024-03-15");
      expect(dbMeetings[0]!.meetingType).toBe("plenary");

      const dbStatements = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, meetingId));
      expect(dbStatements).toHaveLength(3);

      // kind の分布を確認
      const kinds = dbStatements.map((s) => s.kind).sort();
      expect(kinds).toEqual(["answer", "question", "remark"]);

      // statement_chunks が正しく作成されていることを確認
      const dbChunks = await tx
        .select()
        .from(statement_chunks)
        .where(eq(statement_chunks.meetingId, meetingId));
      expect(dbChunks.length).toBeGreaterThan(0);

      for (const chunk of dbChunks) {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.contentHash).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  });
});
