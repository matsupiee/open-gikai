import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長をパースする", () => {
    const result = parseSpeaker("○議長（河野 浩一議員） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("河野 浩一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長をパースする", () => {
    const result = parseSpeaker("○町長（宮崎 吉敏君） お答えいたします。");
    expect(result.speakerName).toBe("宮崎 吉敏");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("議員をパースする（一般質問形式）", () => {
    const result = parseSpeaker("○議員（内藤 逸子議員） 質問いたします。");
    expect(result.speakerName).toBe("内藤 逸子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長をパースする", () => {
    const result = parseSpeaker("○福祉課長（河野 賢二君） ただいまの御質問にお答えします。");
    expect(result.speakerName).toBe("河野 賢二");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ただいまの御質問にお答えします。");
  });

  it("副町長をパースする", () => {
    const result = parseSpeaker("○副町長（田中 太郎君） ご説明いたします。");
    expect(result.speakerName).toBe("田中 太郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長をパースする", () => {
    const result = parseSpeaker("○教育長（長曽我部 敬一君） お答えいたします。");
    expect(result.speakerName).toBe("長曽我部 敬一");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("事務局長をパースする", () => {
    const result = parseSpeaker("○議会事務局長（谷 講平君） それでは朗読いたします。");
    expect(result.speakerName).toBe("谷 講平");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("それでは朗読いたします。");
  });

  it("産業推進課長をパースする（複合役職名）", () => {
    const result = parseSpeaker("○産業推進課長（河野 英樹君） 補足説明を申し上げます。");
    expect(result.speakerName).toBe("河野 英樹");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("補足説明を申し上げます。");
  });

  it("○マーカーなしのテキストはスピーカーなし", () => {
    const result = parseSpeaker("午前９時00分開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時00分開会");
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

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseHeldOn", () => {
  it("一般質問 PDF の開催日を抽出する（全角数字）", () => {
    const text = "川南町議会・令和６年 12 月定例会一般質問【 内藤 逸子 議員 】 （ 令和６年 12 月 10 日 午前９時 00 分 開始 ）";
    expect(parseHeldOn(text)).toBe("2024-12-10");
  });

  it("一般質問 PDF の開催日を抽出する（半角数字）", () => {
    const text = "（ 令和6年 3 月 5 日 午前9時 00 分 開始 ）";
    expect(parseHeldOn(text)).toBe("2024-03-05");
  });

  it("定例会 PDF の開催日を抽出する（開会パターン）", () => {
    const text = "令和6年12月6日 開 会 令和6年12月17日 閉 会";
    expect(parseHeldOn(text)).toBe("2024-12-06");
  });

  it("臨時会 PDF の開催日を抽出する", () => {
    const text = "令和5年11月1日 開会 川南町議会臨時会";
    expect(parseHeldOn(text)).toBe("2023-11-01");
  });

  it("日付が見つからない場合は null を返す", () => {
    const text = "会議録の内容です。日付情報なし。";
    expect(parseHeldOn(text)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○マーカーの発言を抽出する", () => {
    const text = `○議長（河野 浩一議員） ただいまから会議を開きます。
○町長（宮崎 吉敏君） お答えいたします。ご説明申し上げます。
○議員（内藤 逸子議員） 質問いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("河野 浩一");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("宮崎 吉敏");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("内藤 逸子");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("応招議員・不応招議員の名簿行はスキップする", () => {
    const text = `○ 応招議員（13名） １番 乙 津 弘 子 議員 2番 内 藤 逸 子 議員
○ 不応招議員（なし）
○議長（河野 浩一議員） ただいまから会議を開きます。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（河野 浩一議員） ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（河野 浩一議員） ただいま。
○町長（宮崎 吉敏君） お答えします。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言マーカーがない場合は空配列を返す", () => {
    const text = "このテキストには発言マーカーがありません。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
