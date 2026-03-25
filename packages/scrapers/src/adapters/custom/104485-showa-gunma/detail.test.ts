import { describe, expect, it } from "vitest";
import {
  buildMeetingData,
  parseDateFromPdfUrl,
  parseSpeaker,
  classifyKind,
  parseStatements,
} from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第4回定例会第1号",
        year: 2025,
        pdfUrl:
          "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/files/01/20251203_honbun.pdf",
        goNumber: "第1号",
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("municipality-id-123");
    expect(result!.title).toBe("令和7年第4回定例会第1号");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2025-12-03");
    expect(result!.sourceUrl).toBe(
      "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/files/01/20251203_honbun.pdf"
    );
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第1回臨時会第1号",
        year: 2024,
        pdfUrl: "https://www.vill.showa.gunma.jp/files/01/dai1gouhonbun.pdf",
        goNumber: "第1号",
        meetingType: "extraordinary",
      },
      "municipality-id-456"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    // ファイル名に日付がない場合は年から推定
    expect(result!.heldOn).toBe("2024-01-01");
  });

  it("year が 0 以下の場合は null を返す", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第4回定例会第1号",
        year: 0,
        pdfUrl: "https://example.com/file.pdf",
        goNumber: "第1号",
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result).toBeNull();
  });

  it("externalId が pdfUrl を含む", () => {
    const pdfUrl =
      "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/files/01/20251203_honbun.pdf";
    const result = buildMeetingData(
      {
        title: "令和7年第4回定例会第1号",
        year: 2025,
        pdfUrl,
        goNumber: "第1号",
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result!.externalId).toContain("showa_gunma_");
  });
});

describe("parseDateFromPdfUrl", () => {
  it("新形式（YYYYMMDD_honbun.pdf）から日付を抽出する", () => {
    const result = parseDateFromPdfUrl(
      "https://www.vill.showa.gunma.jp/files/01/20251203_honbun.pdf"
    );
    expect(result).toBe("2025-12-03");
  });

  it("月が1桁の日付も正しくパースする", () => {
    const result = parseDateFromPdfUrl(
      "https://www.vill.showa.gunma.jp/files/01/20250601_honbun.pdf"
    );
    expect(result).toBe("2025-06-01");
  });

  it("旧形式（dai1gouhonbun.pdf）は null を返す", () => {
    const result = parseDateFromPdfUrl(
      "https://www.vill.showa.gunma.jp/files/01/dai1gouhonbun.pdf"
    );
    expect(result).toBeNull();
  });

  it("中間形式（6-3-1-2.pdf）は null を返す", () => {
    const result = parseDateFromPdfUrl(
      "https://www.vill.showa.gunma.jp/files/01/6-3-1-2.pdf"
    );
    expect(result).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（永井一行君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("永井一行");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長を正しくパースする", () => {
    const result = parseSpeaker("○村長（髙橋幸一郎君） お答えいたします。");
    expect(result.speakerName).toBe("髙橋幸一郎");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（山田太郎君） ご報告いたします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("議員番号パターンを正しくパースする（全角数字）", () => {
    const result = parseSpeaker("○７番（鈴木一郎君） 質問いたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副村長を正しくパースする", () => {
    const result = parseSpeaker("○副村長（田中次郎君） 説明いたします。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("説明いたします。");
  });

  it("副委員長を正しくパースする（長い方を優先）", () => {
    const result = parseSpeaker("○副委員長（佐藤三郎君） 審議します。");
    expect(result.speakerName).toBe("佐藤三郎");
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

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
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
○議長（永井一行君） ただいまから本日の会議を開きます。
○７番（鈴木一郎君） 質問いたします。
○村長（髙橋幸一郎君） お答えいたします。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("永井一行");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木一郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("髙橋幸一郎");
    expect(statements[2]!.speakerRole).toBe("村長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ページ番号行（－{数字}－）を除去する", () => {
    const text = `
○議長（永井一行君） ただいまから会議を開きます。
－1－
○２番（田中花子君） 質問します。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
    expect(statements[1]!.content).toBe("質問します。");
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = `
○議長（永井一行君） ただいまから
本日の会議を
開きます。
○２番（田中花子君） 質問します。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("本日の会議を");
    expect(statements[0]!.content).toContain("開きます。");
  });

  it("contentHash が生成される", () => {
    const text = "○議長（永井一行君） ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("発言者がいない場合は空配列を返す", () => {
    const text = "議事日程\n第1 開会\n第2 議案審議";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
