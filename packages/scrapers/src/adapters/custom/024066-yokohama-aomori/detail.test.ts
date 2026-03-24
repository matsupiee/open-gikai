import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHeldOn,
  extractHeldOnFromLinkText,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（田中太郎君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（山田一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("山田一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（鈴木二郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("鈴木二郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（佐藤次郎君）　質問いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○建設課長（高橋三郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長を正しくパースする（委員長より先にマッチ）", () => {
    const result = parseSpeaker("○副委員長（伊藤四郎君）　ご報告申し上げます。");
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（小林五郎君）　説明いたします。");
    expect(result.speakerName).toBe("小林五郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("説明いたします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("カッコパターンなし・役職ありのテキスト", () => {
    const result = parseSpeaker("○渡辺議長 ただいまから会議を開きます。");
    expect(result.speakerName).toBe("渡辺");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
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

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("建設課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("建設課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割して抽出する", () => {
    const text = `
○議長（田中太郎君）　ただいまから本日の会議を開きます。
○３番（佐藤次郎君）　一般質問いたします。
○町長（山田一郎君）　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("佐藤次郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = `
○３番（佐藤次郎君）（登壇）
○３番（佐藤次郎君）　一般質問いたします。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("一般質問いたします。");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const text = `○議長（田中太郎君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中君）　ただいま。\n○議員（佐藤君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("○ マーカーがないブロックはスキップする", () => {
    const text = `会議を開会します。\n○議長（田中君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("発言内容が空のブロックはスキップする", () => {
    const text = `○議長（田中君）\n○議員（佐藤君）　質問します。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議員");
  });

  it("statements が空の場合は空配列を返す", () => {
    const text = "会議録テキストに発言マーカーなし";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});

describe("extractHeldOn", () => {
  it("令和の日付を抽出する", () => {
    const text = "令和7年3月5日　横浜町議会定例会会議録";
    expect(extractHeldOn(text)).toBe("2025-03-05");
  });

  it("令和元年を正しく変換する", () => {
    const text = "令和元年9月10日　第3回定例会";
    expect(extractHeldOn(text)).toBe("2019-09-10");
  });

  it("全角数字の日付を抽出する", () => {
    const text = "令和６年１２月８日　第５回定例会";
    expect(extractHeldOn(text)).toBe("2024-12-08");
  });

  it("日付がない場合は null を返す", () => {
    const text = "会議録テキスト（日付なし）";
    expect(extractHeldOn(text)).toBeNull();
  });
});

describe("extractHeldOnFromLinkText", () => {
  it("全角数字の月日からリンクテキストの日付を抽出する", () => {
    const linkText = "１２月１日（月）　本会議１号（開会、提案理由）";
    const yearHeading = "令和7年会議録";
    expect(extractHeldOnFromLinkText(linkText, yearHeading)).toBe("2025-12-01");
  });

  it("半角数字の月日から日付を抽出する", () => {
    const linkText = "3月3日（月）　本会議１号（開会）";
    const yearHeading = "令和8年会議録";
    expect(extractHeldOnFromLinkText(linkText, yearHeading)).toBe("2026-03-03");
  });

  it("令和元年の yearHeading に対応する", () => {
    const linkText = "9月10日（火）　本会議１号（開会）";
    const yearHeading = "令和元年会議録";
    expect(extractHeldOnFromLinkText(linkText, yearHeading)).toBe("2019-09-10");
  });

  it("月日パターンがない場合は null を返す", () => {
    const linkText = "議事日程";
    const yearHeading = "令和7年会議録";
    expect(extractHeldOnFromLinkText(linkText, yearHeading)).toBeNull();
  });

  it("yearHeading が無効な場合は null を返す", () => {
    const linkText = "１２月１日（月）　本会議１号（開会）";
    const yearHeading = "無効な見出し";
    expect(extractHeldOnFromLinkText(linkText, yearHeading)).toBeNull();
  });
});
