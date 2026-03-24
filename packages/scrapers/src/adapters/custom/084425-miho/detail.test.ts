import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長をパースする", () => {
    const result = parseSpeaker("○議長（田中 太郎君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中 太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長をパースする", () => {
    const result = parseSpeaker("○村長（鈴木 一郎君） お答えいたします。");
    expect(result.speakerName).toBe("鈴木 一郎");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副村長をパースする", () => {
    const result = parseSpeaker("○副村長（山田 次郎君） ご説明いたします。");
    expect(result.speakerName).toBe("山田 次郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長をパースする", () => {
    const result = parseSpeaker("○教育長（佐藤 三郎君） お答えします。");
    expect(result.speakerName).toBe("佐藤 三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("課長をパースする（複合役職名）", () => {
    const result = parseSpeaker("○福祉課長（高橋 四郎君） ご説明申し上げます。");
    expect(result.speakerName).toBe("高橋 四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("番号付き議員をパースする", () => {
    const result = parseSpeaker("○1番（山田 花子君） 質問いたします。");
    expect(result.speakerName).toBe("山田 花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副議長をパースする", () => {
    const result = parseSpeaker("○副議長（伊藤 五郎君） 暫時休憩いたします。");
    expect(result.speakerName).toBe("伊藤 五郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩いたします。");
  });

  it("事務局長をパースする", () => {
    const result = parseSpeaker("○議会事務局長（渡辺 六郎君） それでは朗読いたします。");
    expect(result.speakerName).toBe("渡辺 六郎");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("それでは朗読いたします。");
  });

  it("○マーカーなしのテキストはスピーカーなし", () => {
    const result = parseSpeaker("午前10時00分開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分開会");
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
  it("「開 会」パターンの開催日を抽出する", () => {
    const text = "令和6年12月6日 開 会 令和6年12月17日 閉 会";
    expect(parseHeldOn(text)).toBe("2024-12-06");
  });

  it("「開会」パターンの開催日を抽出する（スペースなし）", () => {
    const text = "令和6年3月1日開会";
    expect(parseHeldOn(text)).toBe("2024-03-01");
  });

  it("「午前」パターンの開催日を抽出する", () => {
    const text = "令和6年12月10日午前10時00分開会";
    expect(parseHeldOn(text)).toBe("2024-12-10");
  });

  it("全角数字を含む日付を抽出する", () => {
    const text = "令和６年１２月６日 開 会";
    expect(parseHeldOn(text)).toBe("2024-12-06");
  });

  it("令和元年の日付を抽出する", () => {
    const text = "令和元年9月10日 開 会";
    expect(parseHeldOn(text)).toBe("2019-09-10");
  });

  it("平成年の日付を抽出する", () => {
    const text = "平成30年12月5日 開 会";
    expect(parseHeldOn(text)).toBe("2018-12-05");
  });

  it("日付が見つからない場合は null を返す", () => {
    const text = "会議録の内容です。日付情報なし。";
    expect(parseHeldOn(text)).toBeNull();
  });

  it("単独の年月日パターンも抽出する（開会なし）", () => {
    const text = "令和5年6月15日";
    expect(parseHeldOn(text)).toBe("2023-06-15");
  });
});

describe("parseStatements", () => {
  it("○マーカーの発言を抽出する", () => {
    const text = `○議長（田中 太郎君） ただいまから会議を開きます。
○村長（鈴木 一郎君） お答えいたします。ご説明申し上げます。
○1番（山田 花子君） 質問いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("田中 太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木 一郎");
    expect(statements[1]!.speakerRole).toBe("村長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("山田 花子");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("応招議員・不応招議員の名簿行はスキップする", () => {
    const text = `○ 応招議員（10名） １番 山田 花子 議員 2番 鈴木 次郎 議員
○ 不応招議員（なし）
○議長（田中 太郎君） ただいまから会議を開きます。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（田中 太郎君） ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中 太郎君） ただいま。
○村長（鈴木 一郎君） お答えします。`;

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
