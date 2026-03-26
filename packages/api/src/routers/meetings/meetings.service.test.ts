import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "@open-gikai/db-minutes/test-helpers";
import { municipalities, meetings, statements } from "@open-gikai/db-minutes";
import type { TestDb } from "@open-gikai/db-minutes/test-helpers";
import { listMeetings, getMeetingStatements } from "./meetings.service";

describe("listMeetings", () => {
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
  });

  it("会議一覧を取得できる", async () => {
    await db.insert(meetings).values({
      id: "meeting-1",
      municipalityCode: "010001",
      title: "令和6年第1回定例会",
      meetingType: "定例会",
      heldOn: "2024-03-01",
    });

    const result = await listMeetings(db, {});

    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0]!.title).toBe("令和6年第1回定例会");
    expect(result.meetings[0]!.prefecture).toBe("北海道");
    expect(result.meetings[0]!.municipality).toBe("札幌市");
    expect(result.nextCursor).toBeNull();
  });

  it("heldOnFrom / heldOnTo で期間フィルタ", async () => {
    await db.insert(meetings).values([
      {
        id: "meeting-old",
        municipalityCode: "010001",
        title: "令和5年第1回定例会",
        meetingType: "定例会",
        heldOn: "2023-03-01",
      },
      {
        id: "meeting-new",
        municipalityCode: "010001",
        title: "令和6年第1回定例会",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
    ]);

    const result = await listMeetings(db, {
      heldOnFrom: "2024-01-01",
      heldOnTo: "2024-12-31",
    });

    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0]!.title).toBe("令和6年第1回定例会");
  });

  it("prefecture でフィルタ", async () => {
    await db.insert(meetings).values([
      {
        id: "meeting-hokkaido",
        municipalityCode: "010001",
        title: "北海道の会議",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
      {
        id: "meeting-tokyo",
        municipalityCode: "131001",
        title: "東京の会議",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
    ]);

    const result = await listMeetings(db, { prefecture: "東京都" });

    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0]!.title).toBe("東京の会議");
  });

  it("municipality でテキスト検索", async () => {
    await db.insert(meetings).values([
      {
        id: "meeting-sapporo",
        municipalityCode: "010001",
        title: "札幌の会議",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
      {
        id: "meeting-chiyoda",
        municipalityCode: "131001",
        title: "千代田の会議",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
    ]);

    const result = await listMeetings(db, { municipality: "札幌" });

    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0]!.title).toBe("札幌の会議");
  });

  it("meetingType でフィルタ", async () => {
    await db.insert(meetings).values([
      {
        id: "meeting-regular",
        municipalityCode: "010001",
        title: "定例会",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
      {
        id: "meeting-special",
        municipalityCode: "010001",
        title: "臨時会",
        meetingType: "臨時会",
        heldOn: "2024-03-01",
      },
    ]);

    const result = await listMeetings(db, { meetingType: "臨時会" });

    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0]!.title).toBe("臨時会");
  });

  it("カーソルベースページネーション", async () => {
    await db.insert(meetings).values([
      {
        id: "aaa",
        municipalityCode: "010001",
        title: "会議A",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
      {
        id: "bbb",
        municipalityCode: "010001",
        title: "会議B",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
      {
        id: "ccc",
        municipalityCode: "010001",
        title: "会議C",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
    ]);

    const page1 = await listMeetings(db, { limit: 2 });

    expect(page1.meetings).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listMeetings(db, {
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.meetings).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });

  it("データが0件のとき空配列を返す", async () => {
    const result = await listMeetings(db, {});

    expect(result.meetings).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("heldOn 降順でソートされる", async () => {
    await db.insert(meetings).values([
      {
        id: "meeting-march",
        municipalityCode: "010001",
        title: "3月の会議",
        meetingType: "定例会",
        heldOn: "2024-03-01",
      },
      {
        id: "meeting-june",
        municipalityCode: "010001",
        title: "6月の会議",
        meetingType: "定例会",
        heldOn: "2024-06-01",
      },
      {
        id: "meeting-jan",
        municipalityCode: "010001",
        title: "1月の会議",
        meetingType: "定例会",
        heldOn: "2024-01-01",
      },
    ]);

    const result = await listMeetings(db, {});

    expect(result.meetings[0]!.title).toBe("6月の会議");
    expect(result.meetings[1]!.title).toBe("3月の会議");
    expect(result.meetings[2]!.title).toBe("1月の会議");
  });
});

describe("getMeetingStatements", () => {
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
  });

  it("会議とその発言一覧を取得できる", async () => {
    await db.insert(meetings).values({
      id: "meeting-1",
      municipalityCode: "010001",
      title: "令和6年第1回定例会",
      meetingType: "定例会",
      heldOn: "2024-03-01",
      sourceUrl: "https://example.com/meeting/1",
    });
    await db.insert(statements).values([
      {
        id: "stmt-1",
        meetingId: "meeting-1",
        kind: "question",
        speakerName: "田中太郎",
        speakerRole: "議員",
        content: "質問です",
        contentHash: "hash-1",
      },
      {
        id: "stmt-2",
        meetingId: "meeting-1",
        kind: "answer",
        speakerName: "市長",
        speakerRole: "市長",
        content: "回答です",
        contentHash: "hash-2",
      },
    ]);

    const result = await getMeetingStatements(db, {
      meetingId: "meeting-1",
    });

    expect(result.title).toBe("令和6年第1回定例会");
    expect(result.prefecture).toBe("北海道");
    expect(result.municipality).toBe("札幌市");
    expect(result.sourceUrl).toBe("https://example.com/meeting/1");
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]!.kind).toBe("question");
    expect(result.statements[0]!.speakerName).toBe("田中太郎");
    expect(result.statements[0]!.content).toBe("質問です");
    expect(result.statements[1]!.kind).toBe("answer");
  });

  it("存在しない meetingId で Error を投げる", async () => {
    await expect(
      getMeetingStatements(db, { meetingId: "nonexistent" }),
    ).rejects.toThrow("Meeting not found");
  });

  it("発言が0件の会議は空配列を返す", async () => {
    await db.insert(meetings).values({
      id: "meeting-empty",
      municipalityCode: "010001",
      title: "発言なしの会議",
      meetingType: "定例会",
      heldOn: "2024-03-01",
    });

    const result = await getMeetingStatements(db, {
      meetingId: "meeting-empty",
    });

    expect(result.title).toBe("発言なしの会議");
    expect(result.statements).toHaveLength(0);
  });

  it("発言が id 昇順でソートされる", async () => {
    await db.insert(meetings).values({
      id: "meeting-1",
      municipalityCode: "010001",
      title: "テスト会議",
      meetingType: "定例会",
      heldOn: "2024-03-01",
    });
    await db.insert(statements).values([
      {
        id: "zzz",
        meetingId: "meeting-1",
        kind: "question",
        content: "最後に挿入",
        contentHash: "hash-z",
      },
      {
        id: "aaa",
        meetingId: "meeting-1",
        kind: "answer",
        content: "最初に挿入",
        contentHash: "hash-a",
      },
    ]);

    const result = await getMeetingStatements(db, {
      meetingId: "meeting-1",
    });

    expect(result.statements[0]!.id).toBe("aaa");
    expect(result.statements[1]!.id).toBe("zzz");
  });
});
