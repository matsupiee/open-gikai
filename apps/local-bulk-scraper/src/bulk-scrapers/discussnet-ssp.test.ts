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
import type { MeetingData } from "@open-gikai/scrapers";
import { buildChunksFromStatements } from "@open-gikai/scrapers/statement-chunking";
import { scrapeAll } from "./discussnet-ssp";

vi.mock("@open-gikai/scrapers/discussnet-ssp", () => ({
  fetchTenantId: vi.fn(),
  fetchCouncils: vi.fn(),
  fetchSchedules: vi.fn(),
  fetchMinuteData: vi.fn(),
  buildApiBase: vi.fn(),
  extractHost: vi.fn(),
}));

import {
  fetchTenantId,
  fetchCouncils,
  fetchSchedules,
  fetchMinuteData,
} from "@open-gikai/scrapers/discussnet-ssp";

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

function createMockMeetingData(
  municipalityId: string,
  title: string,
): MeetingData {
  const content1 = "ただいまから会議を開きます。";
  const content2 = "福祉政策について質問いたします。高齢者支援の充実について伺います。";
  const content3 =
    "高齢者支援についてお答えします。在宅介護サービスの拡充を進めております。";

  let offset = 0;
  const stmts = [
    { kind: "remark", speakerName: "議長", speakerRole: "議長", content: content1 },
    { kind: "question", speakerName: "田中太郎", speakerRole: "議員", content: content2 },
    { kind: "answer", speakerName: "福祉部長", speakerRole: "福祉部長", content: content3 },
  ].map((s) => {
    const contentHash = createHash("sha256").update(s.content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + s.content.length;
    offset = endOffset + 1;
    return { ...s, contentHash, startOffset, endOffset };
  });

  return {
    municipalityId,
    title,
    meetingType: "plenary",
    heldOn: "2024-09-20",
    sourceUrl: "https://ssp.kaigiroku.net/tenant/test/SpMinute.html",
    externalId: `ssp_schedule_100`,
    statements: stmts,
  };
}

describe("discussnet-ssp バルクスクレイパー統合テスト", () => {
  test("テナント → councils → schedules → minutes の一連のフローが動作する", async () => {
    const municipalityId = "test-muni-ssp";
    const mockMeeting = createMockMeetingData(municipalityId, "令和６年第３回定例会");

    vi.mocked(fetchTenantId).mockResolvedValue(42);
    vi.mocked(fetchCouncils).mockResolvedValue([
      { councilId: 1, name: "本会議", viewYear: "2024" },
    ]);
    vi.mocked(fetchSchedules).mockResolvedValue([
      { scheduleId: 100, name: "第３回定例会", memberList: "<div>2024年9月20日</div>" },
    ]);
    vi.mocked(fetchMinuteData).mockResolvedValue(mockMeeting);

    const result = await scrapeAll(
      municipalityId,
      "テスト村",
      "https://ssp.kaigiroku.net/tenant/test/SpTop.html",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和６年第３回定例会");
    expect(result[0]!.statements).toHaveLength(3);
    expect(result[0]!.heldOn).toBe("2024-09-20");
  });

  test("テナントID取得失敗時は空配列を返す", async () => {
    vi.mocked(fetchTenantId).mockResolvedValue(null);

    const result = await scrapeAll(
      "muni-id",
      "テスト村",
      "https://ssp.kaigiroku.net/tenant/test/SpTop.html",
    );
    expect(result).toEqual([]);
  });

  test("スクレイピング結果を DB にインポートできる", async () => {
    const mockMeeting = createMockMeetingData("placeholder", "令和６年第３回定例会");

    vi.mocked(fetchTenantId).mockResolvedValue(42);
    vi.mocked(fetchCouncils).mockResolvedValue([
      { councilId: 1, name: "本会議", viewYear: "2024" },
    ]);
    vi.mocked(fetchSchedules).mockResolvedValue([
      { scheduleId: 100, name: "第３回定例会", memberList: "<div>2024年9月20日</div>" },
    ]);
    vi.mocked(fetchMinuteData).mockResolvedValue(mockMeeting);

    const meetingDataList = await scrapeAll(
      "placeholder",
      "テスト村",
      "https://ssp.kaigiroku.net/tenant/test/SpTop.html",
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
          baseUrl: "https://ssp.kaigiroku.net/tenant/test/SpTop.html",
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
        const contentHash = createHash("sha256").update(chunk.content).digest("hex");
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

      // 検証
      const stmtRows = await tx
        .select()
        .from(statements)
        .where(eq(statements.meetingId, dbMeeting!.id));
      expect(stmtRows).toHaveLength(3);

      const kinds = stmtRows.map((s) => s.kind).sort();
      expect(kinds).toEqual(["answer", "question", "remark"]);

      const chunkRows = await tx
        .select()
        .from(statement_chunks)
        .where(eq(statement_chunks.meetingId, dbMeeting!.id));
      expect(chunkRows.length).toBeGreaterThan(0);
    });
  });
});
