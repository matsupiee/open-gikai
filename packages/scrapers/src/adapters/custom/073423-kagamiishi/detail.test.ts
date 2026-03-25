import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseHeldOn, buildStatements, buildMeetingData } from "./detail";

describe("parseSpeaker", () => {
  it("議員サフィックスを除いて名前を返す", () => {
    const result = parseSpeaker("込山靖子議員");
    expect(result.speakerName).toBe("込山靖子");
    expect(result.speakerRole).toBe("議員");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("佐藤町長");
    expect(result.speakerName).toBe("佐藤");
    expect(result.speakerRole).toBe("町長");
  });

  it("副町長を正しくパースする（長い方が優先される）", () => {
    const result = parseSpeaker("田中副町長");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("副町長");
  });

  it("議長を正しくパースする", () => {
    const result = parseSpeaker("山田議長");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("議長");
  });

  it("副議長を正しくパースする（長い方が優先される）", () => {
    const result = parseSpeaker("鈴木副議長");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副議長");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("高橋総務課長");
    expect(result.speakerName).toBe("高橋総務");
    expect(result.speakerRole).toBe("課長");
  });

  it("null の場合は両方 null を返す", () => {
    const result = parseSpeaker(null);
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
  });

  it("役職サフィックスがない場合は名前のみ返す", () => {
    const result = parseSpeaker("不明な人");
    expect(result.speakerName).toBe("不明な人");
    expect(result.speakerRole).toBeNull();
  });
});

describe("classifyKind", () => {
  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseHeldOn", () => {
  it("スケジュールラベルと会議年から開催日を組み立てる", () => {
    const result = parseHeldOn("06月12日　一般質問（1日目）", "2025-06-13");
    expect(result).toBe("2025-06-12");
  });

  it("別の月日パターンでも正しく動く", () => {
    const result = parseHeldOn("03月15日　定例会", "2025-03-20");
    expect(result).toBe("2025-03-15");
  });

  it("日付パターンがマッチしない場合は null を返す", () => {
    const result = parseHeldOn("一般質問", "2025-06-13");
    expect(result).toBeNull();
  });

  it("council.year が不正な場合は null を返す", () => {
    const result = parseHeldOn("06月12日　一般質問", "");
    expect(result).toBeNull();
  });
});

describe("buildStatements", () => {
  it("content から ParsedStatement を生成する", () => {
    const content = "１．子宮頸がんワクチンの危険性について\n２．太陽光パネルの自然環境への影響について";
    const statements = buildStatements(content, "込山靖子議員");

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("込山靖子");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.content).toBe(content.trim());
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(content.trim().length);
  });

  it("contentHash は SHA-256 形式", () => {
    const content = "テスト発言内容";
    const statements = buildStatements(content, "田中議員");

    const expected = createHash("sha256").update(content).digest("hex");
    expect(statements[0]!.contentHash).toBe(expected);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("content が null の場合は空配列を返す", () => {
    const statements = buildStatements(null, "込山靖子議員");
    expect(statements).toHaveLength(0);
  });

  it("content が空文字の場合は空配列を返す", () => {
    const statements = buildStatements("", "込山靖子議員");
    expect(statements).toHaveLength(0);
  });

  it("speaker が null の場合は speakerName も null", () => {
    const statements = buildStatements("発言内容", null);
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.kind).toBe("remark");
  });

  it("町長が発言者の場合は kind が answer", () => {
    const statements = buildStatements("お答えいたします。", "田中町長");
    expect(statements[0]!.kind).toBe("answer");
  });
});

describe("buildMeetingData", () => {
  it("正常なレコードから MeetingData を組み立てる", () => {
    const record = {
      councilId: "1",
      councilLabel: "令和7年6月鏡石町議会定例会（第8回）",
      councilYear: "2025-06-13",
      scheduleId: "2",
      scheduleLabel: "06月12日　一般質問（1日目）",
      playlistId: "1",
      speaker: "込山靖子議員",
      speakerId: "8",
      content: "１．子宮頸がんワクチンの危険性について",
    };

    const result = buildMeetingData(record, "municipality-1");

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("municipality-1");
    expect(result!.title).toBe("令和7年6月鏡石町議会定例会（第8回）");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2025-06-12");
    expect(result!.sourceUrl).toBe(
      "https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/speech.html?council_id=1&schedule_id=2&playlist_id=1",
    );
    expect(result!.externalId).toBe("kagamiishi_1_2_1");
    expect(result!.statements).toHaveLength(1);
  });

  it("開催日が解析できない場合は null を返す", () => {
    const record = {
      councilId: "1",
      councilLabel: "令和7年6月鏡石町議会定例会（第8回）",
      councilYear: "2025-06-13",
      scheduleId: "1",
      scheduleLabel: "一般質問",
      playlistId: "1",
      speaker: "込山靖子議員",
      speakerId: "8",
      content: "質問内容",
    };

    const result = buildMeetingData(record, "municipality-1");
    expect(result).toBeNull();
  });

  it("content が null の場合は null を返す（statements が空）", () => {
    const record = {
      councilId: "1",
      councilLabel: "令和7年6月鏡石町議会定例会（第8回）",
      councilYear: "2025-06-13",
      scheduleId: "2",
      scheduleLabel: "06月12日　一般質問（1日目）",
      playlistId: "1",
      speaker: "込山靖子議員",
      speakerId: "8",
      content: null,
    };

    const result = buildMeetingData(record, "municipality-1");
    expect(result).toBeNull();
  });
});
