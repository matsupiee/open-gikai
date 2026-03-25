import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, splitIntoSessions } from "./detail";

describe("parseSpeaker", () => {
  it("議長（括弧あり）を正しくパースする", () => {
    const result = parseSpeaker("○議長（𠮷田茂広）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("𠮷田茂広");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○副議長（加藤義信）　暫時休憩します。");
    expect(result.speakerName).toBe("加藤義信");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩します。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("○市長（林宏優）　お答えいたします。");
    expect(result.speakerName).toBe("林宏優");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("○副市長（久保田聡）　ご説明いたします。");
    expect(result.speakerName).toBe("久保田聡");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員長（長い役職名）を正しくパースする", () => {
    const result = parseSpeaker("○議会運営委員会委員長（武藤孝成）　議題に入ります。");
    expect(result.speakerName).toBe("武藤孝成");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("議題に入ります。");
  });

  it("副委員長を正しくパースする（委員長より先にマッチ）", () => {
    const result = parseSpeaker("○副委員長（伊藤四郎）　申し上げます。");
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("申し上げます。");
  });

  it("番号付き議員（質疑形式）を正しくパースする", () => {
    const result = parseSpeaker("○３番  吉田昌樹議員質疑  一般質問いたします。");
    expect(result.speakerName).toBe("吉田昌樹");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("番号付き議員（質問形式）を正しくパースする", () => {
    const result = parseSpeaker("○１１番  山崎　通議員質問  通告に従い質問します。");
    expect(result.speakerName).toBe("山崎通");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("通告に従い質問します。");
  });

  it("行政職員（答弁・括弧なし）を正しくパースする", () => {
    const result = parseSpeaker("○谷村理事兼総務課長答弁  お答えいたします。");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長答弁を正しくパースする", () => {
    const result = parseSpeaker("○服部市民環境課長答弁  ご説明します。");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明します。");
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

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("総務課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("理事は answer", () => {
    expect(classifyKind("理事")).toBe("answer");
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
○議長（𠮷田茂広）　ただいまから本日の会議を開きます。
○３番  吉田昌樹議員質疑  一般質問いたします。
○市長（林宏優）　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("𠮷田茂広");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("吉田昌樹");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("林宏優");
    expect(statements[2]!.speakerRole).toBe("市長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = `
○３番（吉田昌樹）（登壇）
○３番  吉田昌樹議員質疑  一般質問いたします。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("一般質問いたします。");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const text = `○議長（𠮷田茂広）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ページ区切り文字（フォームフィード）を除去する", () => {
    const text = `○議長（田中）　開会します。\f○議員（佐藤）　質問します。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
  });

  it("ページ番号行（－ N －）を除去する", () => {
    const text = `○議長（田中）　開会します。\n－ 1 －\n○議員（佐藤）　質問します。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
  });

  it("statements が空の場合は空配列を返す", () => {
    const text = "会議録テキストに発言マーカーなし";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中）　ただいま。\n○議員（佐藤）　質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});

describe("splitIntoSessions", () => {
  it("令和年の会議日で分割する", () => {
    const text = `令和7年2月27日（木曜日）第1号\n○議長（田中）　開会します。\n令和7年3月5日（水曜日）第2号\n○議長（田中）　本日の会議を開きます。`;

    const sessions = splitIntoSessions(text);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.heldOn).toBe("2025-02-27");
    expect(sessions[1]!.heldOn).toBe("2025-03-05");
  });

  it("平成年の会議日で分割する", () => {
    const text = `平成30年3月5日（月曜日）第1号\n○議長（鈴木）　開会します。`;

    const sessions = splitIntoSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.heldOn).toBe("2018-03-05");
  });

  it("令和元年を正しく処理する", () => {
    const text = `令和元年6月10日（月曜日）第1号\n○議長（山田）　開会します。`;

    const sessions = splitIntoSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.heldOn).toBe("2019-06-10");
  });

  it("会議日区切りがない場合は全体を1セッションとして返す", () => {
    const text = `○議長（田中）　開会します。\n○議員（佐藤）　質問します。`;

    const sessions = splitIntoSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.heldOn).toBeNull();
  });
});
