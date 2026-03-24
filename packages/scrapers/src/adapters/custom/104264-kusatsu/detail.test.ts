import { describe, expect, it } from "vitest";
import { buildMeetingData, parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第2回草津町議会定例会会議録",
        year: 2024,
        pdfUrl:
          "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/R62.pdf",
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("municipality-id-123");
    expect(result!.title).toBe("令和6年第2回草津町議会定例会会議録");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-01-01");
    expect(result!.sourceUrl).toBe(
      "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/R62.pdf"
    );
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第1回草津町議会臨時会会議録",
        year: 2024,
        pdfUrl: "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/R61.pdf",
        meetingType: "extraordinary",
      },
      "municipality-id-456"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("year が null の場合は null を返す", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第2回草津町議会定例会会議録",
        year: null,
        pdfUrl: "https://example.com/file.pdf",
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result).toBeNull();
  });

  it("externalId が pdfUrl を含む", () => {
    const pdfUrl =
      "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/R62.pdf";
    const result = buildMeetingData(
      {
        title: "令和6年第2回草津町議会定例会会議録",
        year: 2024,
        pdfUrl,
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result!.externalId).toContain("kusatsu_");
  });
});

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（宮﨑謹一君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("宮﨑謹一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（黒岩信忠君） お答えいたします。");
    expect(result.speakerName).toBe("黒岩信忠");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（石坂恒久君） ご報告いたします。");
    expect(result.speakerName).toBe("石坂恒久");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("議員番号パターンを正しくパースする（全角数字）", () => {
    const result = parseSpeaker("○７番（金丸勝利君） 質問いたします。");
    expect(result.speakerName).toBe("金丸勝利");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("２桁の議員番号もパースする", () => {
    const result = parseSpeaker("○１０番（山田太郎君） 質問します。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○総務観光常任委員長（黒岩 卓君） 報告いたします。");
    expect(result.speakerName).toBe("黒岩 卓");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告いたします。");
  });

  it("副委員長を正しくパースする（長い方を優先）", () => {
    const result = parseSpeaker("○副委員長（田中一郎君） 審議します。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("審議します。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言者行から発言を抽出する", () => {
    const text = `
○議長（宮﨑謹一君） ただいまから本日の会議を開きます。
○７番（金丸勝利君） 質問いたします。
○町長（黒岩信忠君） お答えいたします。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("宮﨑謹一");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("金丸勝利");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("黒岩信忠");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ページ番号行（－{数字}－）を除去する", () => {
    const text = `
○議長（宮﨑謹一君） ただいまから会議を開きます。
－1－
○２番（安齋 努君） 質問します。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
    expect(statements[1]!.content).toBe("質問します。");
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = `
○議長（宮﨑謹一君） ただいまから
本日の会議を
開きます。
○２番（安齋 努君） 質問します。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("本日の会議を");
    expect(statements[0]!.content).toContain("開きます。");
  });

  it("contentHash が生成される", () => {
    const text = "○議長（宮﨑謹一君） ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("発言者がいない場合は空配列を返す", () => {
    const text = "議事日程\n第1 開会\n第2 議案審議";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
