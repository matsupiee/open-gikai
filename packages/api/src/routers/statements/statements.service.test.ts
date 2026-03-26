import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "@open-gikai/db-minutes/test-helpers";
import { municipalities, meetings, statements } from "@open-gikai/db-minutes";
import type { TestDb } from "@open-gikai/db-minutes/test-helpers";
import {
  searchStatements,
  semanticSearchStatements,
} from "./statements.service";

describe("searchStatements", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await getTestDb();
    await db.insert(municipalities).values([
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
      {
        code: "131001",
        name: "千代田区",
        prefecture: "東京都",
        regionSlug: "kanto",
        enabled: true,
      },
    ]);
    await db.insert(meetings).values([
      {
        id: "meeting-sapporo",
        municipalityCode: "010001",
        title: "札幌定例会",
        meetingType: "定例会",
        heldOn: "2024-03-01",
        sourceUrl: "https://example.com/sapporo",
      },
      {
        id: "meeting-tokyo",
        municipalityCode: "131001",
        title: "千代田定例会",
        meetingType: "定例会",
        heldOn: "2024-06-01",
        sourceUrl: "https://example.com/tokyo",
      },
    ]);
  });

  it("キーワード検索（q）で発言を検索できる", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-1",
        meetingId: "meeting-sapporo",
        kind: "question",
        speakerName: "田中太郎",
        content: "予算について質問します",
        contentHash: "hash-1",
      },
      {
        id: "stmt-2",
        meetingId: "meeting-sapporo",
        kind: "answer",
        speakerName: "市長",
        content: "教育政策について回答します",
        contentHash: "hash-2",
      },
    ]);

    const result = await searchStatements(db, { q: "予算" });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.content).toBe("予算について質問します");
    expect(result.statements[0]!.meetingTitle).toBe("札幌定例会");
    expect(result.statements[0]!.prefecture).toBe("北海道");
    expect(result.statements[0]!.municipality).toBe("札幌市");
  });

  it("複数キーワードで AND 検索", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-1",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "予算と教育について質問します",
        contentHash: "hash-1",
      },
      {
        id: "stmt-2",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "予算について質問します",
        contentHash: "hash-2",
      },
    ]);

    const result = await searchStatements(db, { q: "予算 教育" });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.content).toBe(
      "予算と教育について質問します",
    );
  });

  it("kind でフィルタ", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-q",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "質問です",
        contentHash: "hash-q",
      },
      {
        id: "stmt-a",
        meetingId: "meeting-sapporo",
        kind: "answer",
        content: "回答です",
        contentHash: "hash-a",
      },
    ]);

    const result = await searchStatements(db, { kind: "question" });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.kind).toBe("question");
  });

  it("speakerName で部分一致検索", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-1",
        meetingId: "meeting-sapporo",
        kind: "question",
        speakerName: "田中太郎",
        content: "質問A",
        contentHash: "hash-1",
      },
      {
        id: "stmt-2",
        meetingId: "meeting-sapporo",
        kind: "question",
        speakerName: "鈴木花子",
        content: "質問B",
        contentHash: "hash-2",
      },
    ]);

    const result = await searchStatements(db, { speakerName: "田中" });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.speakerName).toBe("田中太郎");
  });

  it("heldOnFrom / heldOnTo で期間フィルタ", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-old",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "古い発言",
        contentHash: "hash-old",
      },
      {
        id: "stmt-new",
        meetingId: "meeting-tokyo",
        kind: "question",
        content: "新しい発言",
        contentHash: "hash-new",
      },
    ]);

    const result = await searchStatements(db, {
      heldOnFrom: "2024-04-01",
      heldOnTo: "2024-12-31",
    });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.content).toBe("新しい発言");
  });

  it("prefecture でフィルタ", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-hokkaido",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "北海道の発言",
        contentHash: "hash-hk",
      },
      {
        id: "stmt-tokyo",
        meetingId: "meeting-tokyo",
        kind: "question",
        content: "東京の発言",
        contentHash: "hash-tk",
      },
    ]);

    const result = await searchStatements(db, { prefecture: "東京都" });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.content).toBe("東京の発言");
  });

  it("municipality でフィルタ", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-sapporo",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "札幌の発言",
        contentHash: "hash-sp",
      },
      {
        id: "stmt-chiyoda",
        meetingId: "meeting-tokyo",
        kind: "question",
        content: "千代田の発言",
        contentHash: "hash-cy",
      },
    ]);

    const result = await searchStatements(db, { municipality: "千代田区" });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.content).toBe("千代田の発言");
  });

  it("カーソルベースページネーション", async () => {
    await db.insert(statements).values([
      {
        id: "aaa",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "発言1",
        contentHash: "hash-1",
      },
      {
        id: "bbb",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "発言2",
        contentHash: "hash-2",
      },
      {
        id: "ccc",
        meetingId: "meeting-sapporo",
        kind: "question",
        content: "発言3",
        contentHash: "hash-3",
      },
    ]);

    const page1 = await searchStatements(db, { limit: 2 });

    expect(page1.statements).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await searchStatements(db, {
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.statements).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });

  it("複数フィルタの組み合わせ", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-match",
        meetingId: "meeting-sapporo",
        kind: "question",
        speakerName: "田中太郎",
        content: "予算について質問します",
        contentHash: "hash-match",
      },
      {
        id: "stmt-wrong-kind",
        meetingId: "meeting-sapporo",
        kind: "answer",
        speakerName: "田中太郎",
        content: "予算について回答します",
        contentHash: "hash-wrong-kind",
      },
      {
        id: "stmt-wrong-speaker",
        meetingId: "meeting-sapporo",
        kind: "question",
        speakerName: "鈴木花子",
        content: "予算について質問します",
        contentHash: "hash-wrong-speaker",
      },
    ]);

    const result = await searchStatements(db, {
      q: "予算",
      kind: "question",
      speakerName: "田中",
    });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.id).toBe("stmt-match");
  });

  it("データが0件のとき空配列を返す", async () => {
    const result = await searchStatements(db, { q: "存在しないキーワード" });

    expect(result.statements).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("semanticSearchStatements", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await getTestDb();
    await db.insert(municipalities).values({
      code: "010001",
      name: "札幌市",
      prefecture: "北海道",
      regionSlug: "hokkaido",
      enabled: true,
    });
    await db.insert(meetings).values({
      id: "meeting-1",
      municipalityCode: "010001",
      title: "定例会",
      meetingType: "定例会",
      heldOn: "2024-03-01",
    });
  });

  it("クエリにマッチする発言を返す", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-1",
        meetingId: "meeting-1",
        kind: "question",
        speakerName: "田中太郎",
        content: "予算について質問します",
        contentHash: "hash-1",
      },
      {
        id: "stmt-2",
        meetingId: "meeting-1",
        kind: "answer",
        content: "教育政策について",
        contentHash: "hash-2",
      },
    ]);

    const result = await semanticSearchStatements(db, {
      query: "予算",
      topK: 5,
    });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.content).toBe("予算について質問します");
    expect(result.statements[0]!.similarity).toBe(0.5);
  });

  it("topK で件数を制限", async () => {
    await db.insert(statements).values([
      {
        id: "stmt-1",
        meetingId: "meeting-1",
        kind: "question",
        content: "予算について質問1",
        contentHash: "hash-1",
      },
      {
        id: "stmt-2",
        meetingId: "meeting-1",
        kind: "question",
        content: "予算について質問2",
        contentHash: "hash-2",
      },
      {
        id: "stmt-3",
        meetingId: "meeting-1",
        kind: "question",
        content: "予算について質問3",
        contentHash: "hash-3",
      },
    ]);

    const result = await semanticSearchStatements(db, {
      query: "予算",
      topK: 2,
    });

    expect(result.statements).toHaveLength(2);
  });

  it("filters.prefecture でフィルタ", async () => {
    await db.insert(municipalities).values({
      code: "131001",
      name: "千代田区",
      prefecture: "東京都",
      regionSlug: "kanto",
      enabled: true,
    });
    await db.insert(meetings).values({
      id: "meeting-tokyo",
      municipalityCode: "131001",
      title: "東京定例会",
      meetingType: "定例会",
      heldOn: "2024-03-01",
    });
    await db.insert(statements).values([
      {
        id: "stmt-hokkaido",
        meetingId: "meeting-1",
        kind: "question",
        content: "予算の質問（北海道）",
        contentHash: "hash-hk",
      },
      {
        id: "stmt-tokyo",
        meetingId: "meeting-tokyo",
        kind: "question",
        content: "予算の質問（東京）",
        contentHash: "hash-tk",
      },
    ]);

    const result = await semanticSearchStatements(db, {
      query: "予算",
      topK: 10,
      filters: { prefecture: "東京都" },
    });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.municipality).toBe("千代田区");
  });

  it("filters.municipality でフィルタ", async () => {
    await db.insert(municipalities).values({
      code: "012025",
      name: "旭川市",
      prefecture: "北海道",
      regionSlug: "hokkaido",
      enabled: true,
    });
    await db.insert(meetings).values({
      id: "meeting-asahikawa",
      municipalityCode: "012025",
      title: "旭川定例会",
      meetingType: "定例会",
      heldOn: "2024-03-01",
    });
    await db.insert(statements).values([
      {
        id: "stmt-sapporo",
        meetingId: "meeting-1",
        kind: "question",
        content: "予算の質問（札幌）",
        contentHash: "hash-sp",
      },
      {
        id: "stmt-asahikawa",
        meetingId: "meeting-asahikawa",
        kind: "question",
        content: "予算の質問（旭川）",
        contentHash: "hash-ak",
      },
    ]);

    const result = await semanticSearchStatements(db, {
      query: "予算",
      topK: 10,
      filters: { municipality: "旭川市" },
    });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.municipality).toBe("旭川市");
  });

  it("filters.heldOnFrom / heldOnTo で期間フィルタ", async () => {
    await db.insert(meetings).values({
      id: "meeting-old",
      municipalityCode: "010001",
      title: "古い定例会",
      meetingType: "定例会",
      heldOn: "2023-01-01",
    });
    await db.insert(statements).values([
      {
        id: "stmt-old",
        meetingId: "meeting-old",
        kind: "question",
        content: "予算の質問（古い）",
        contentHash: "hash-old",
      },
      {
        id: "stmt-new",
        meetingId: "meeting-1",
        kind: "question",
        content: "予算の質問（新しい）",
        contentHash: "hash-new",
      },
    ]);

    const result = await semanticSearchStatements(db, {
      query: "予算",
      topK: 10,
      filters: {
        heldOnFrom: "2024-01-01",
        heldOnTo: "2024-12-31",
      },
    });

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.content).toBe("予算の質問（新しい）");
  });

  it("マッチ0件で空配列を返す", async () => {
    const result = await semanticSearchStatements(db, {
      query: "存在しないキーワード",
      topK: 5,
    });

    expect(result.statements).toHaveLength(0);
  });
});
