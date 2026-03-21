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
import { scrapeAll } from "./kensakusystem";

vi.mock("@open-gikai/scrapers/kensakusystem", () => ({
  isSapphireType: vi.fn(),
  isCgiType: vi.fn(),
  isIndexHtmlType: vi.fn(),
  fetchFromSapphire: vi.fn(),
  fetchFromCgi: vi.fn(),
  fetchFromIndexHtml: vi.fn(),
  extractSlugFromUrl: vi.fn(),
  fetchMeetingDataFromSchedule: vi.fn(),
}));

import {
  isSapphireType,
  fetchFromSapphire,
  isCgiType,
  isIndexHtmlType,
  extractSlugFromUrl,
  fetchMeetingDataFromSchedule,
} from "@open-gikai/scrapers/kensakusystem";

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
  heldOn: string,
): MeetingData {
  const content1 = "本日の議事に入ります。";
  const content2 = "環境政策について質問します。再生可能エネルギーの導入状況をお聞かせください。";
  const content3 = "再生可能エネルギーにつきましては、太陽光発電設備の導入を推進しております。";

  let offset = 0;
  const stmts = [
    { kind: "remark", speakerName: "議長", speakerRole: "議長", content: content1 },
    { kind: "question", speakerName: "木村次郎", speakerRole: "議員", content: content2 },
    { kind: "answer", speakerName: "環境課長", speakerRole: "環境課長", content: content3 },
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
    heldOn,
    sourceUrl: `https://www.kensakusystem.jp/test/cgi-bin/SrchIndex.exe`,
    externalId: `kensaku_${heldOn}`,
    statements: stmts,
  };
}

describe("kensakusystem バルクスクレイパー統合テスト", () => {
  test("Sapphire タイプで一覧取得 → 各スケジュールの詳細取得が動作する", async () => {
    const municipalityId = "test-muni-kensaku";

    vi.mocked(extractSlugFromUrl).mockReturnValue("test-city");
    vi.mocked(isSapphireType).mockReturnValue(true);
    vi.mocked(isCgiType).mockReturnValue(false);
    vi.mocked(isIndexHtmlType).mockReturnValue(false);
    vi.mocked(fetchFromSapphire).mockResolvedValue([
      { title: "令和６年第４回定例会", heldOn: "2024-12-10", url: "https://example.com/schedule/1" },
      { title: "令和６年総務委員会", heldOn: "2024-12-11", url: "https://example.com/schedule/2" },
    ]);
    vi.mocked(fetchMeetingDataFromSchedule)
      .mockResolvedValueOnce(
        createMockMeetingData(municipalityId, "令和６年第４回定例会", "2024-12-10"),
      )
      .mockResolvedValueOnce(
        createMockMeetingData(municipalityId, "令和６年総務委員会", "2024-12-11"),
      );

    const result = await scrapeAll(
      municipalityId,
      "テスト市",
      "https://www.kensakusystem.jp/test/index.html",
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和６年第４回定例会");
    expect(result[0]!.heldOn).toBe("2024-12-10");
    expect(result[1]!.title).toBe("令和６年総務委員会");
  });

  test("slug 抽出失敗時は空配列を返す", async () => {
    vi.mocked(extractSlugFromUrl).mockReturnValue(null);

    const result = await scrapeAll(
      "muni-id",
      "テスト市",
      "https://invalid-url.com",
    );
    expect(result).toEqual([]);
  });

  test("スケジュール取得失敗時は空配列を返す", async () => {
    vi.mocked(extractSlugFromUrl).mockReturnValue("test-city");
    vi.mocked(isSapphireType).mockReturnValue(true);
    vi.mocked(isCgiType).mockReturnValue(false);
    vi.mocked(isIndexHtmlType).mockReturnValue(false);
    vi.mocked(fetchFromSapphire).mockResolvedValue(null);

    const result = await scrapeAll(
      "muni-id",
      "テスト市",
      "https://www.kensakusystem.jp/test/index.html",
    );
    expect(result).toEqual([]);
  });

  test("スクレイピング結果を DB にインポートできる", async () => {
    const mockMeeting = createMockMeetingData("placeholder", "令和６年第４回定例会", "2024-12-10");

    vi.mocked(extractSlugFromUrl).mockReturnValue("test-city");
    vi.mocked(isSapphireType).mockReturnValue(true);
    vi.mocked(isCgiType).mockReturnValue(false);
    vi.mocked(isIndexHtmlType).mockReturnValue(false);
    vi.mocked(fetchFromSapphire).mockResolvedValue([
      { title: "令和６年第４回定例会", heldOn: "2024-12-10", url: "https://example.com/1" },
    ]);
    vi.mocked(fetchMeetingDataFromSchedule).mockResolvedValue(mockMeeting);

    const meetingDataList = await scrapeAll(
      "placeholder",
      "テスト市",
      "https://www.kensakusystem.jp/test/index.html",
    );
    const meetingData = meetingDataList[0]!;

    await withRollback(db, async (tx) => {
      const [systemType] = await tx
        .insert(system_types)
        .values({ name: "kensakusystem", description: "検索システム" })
        .returning();

      const [municipality] = await tx
        .insert(municipalities)
        .values({
          code: "999030",
          name: "テスト市",
          prefecture: "テスト県",
          systemTypeId: systemType!.id,
          baseUrl: "https://www.kensakusystem.jp/test/index.html",
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
