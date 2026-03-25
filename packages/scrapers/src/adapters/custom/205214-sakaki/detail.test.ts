import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseHeldOn,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（若林敏明君） ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("若林敏明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（山村弘君） お答えいたします。"
    );
    expect(result.speakerName).toBe("山村弘");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（山岸正春君） お答えいたします。"
    );
    expect(result.speakerName).toBe("山岸正春");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（田中一郎君） ご説明します。"
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明します。");
  });

  it("半角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○1番（柳澤眞由美君） 質問いたします。"
    );
    expect(result.speakerName).toBe("柳澤眞由美");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("全角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○６番（山本太郎君） 質問いたします。"
    );
    expect(result.speakerName).toBe("山本太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker(
      "○事務局長（米沢正君） ご報告します。"
    );
    expect(result.speakerName).toBe("米沢正");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご報告します。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副議長（大久保義信君） 開会します。"
    );
    expect(result.speakerName).toBe("大久保義信");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("開会します。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○議長（若林　敏明君） 開会します。"
    );
    expect(result.speakerName).toBe("若林敏明");
    expect(result.speakerRole).toBe("議長");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分 開会");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseHeldOn", () => {
  it("令和の日付を抽出する", () => {
    const text = "令和6年3月1日\n坂城町議会定例会\n○議長（若林敏明君） 開会します。";
    expect(parseHeldOn(text, 2024)).toBe("2024-03-01");
  });

  it("全角数字の日付を抽出する", () => {
    const text = "令和６年３月１日\n坂城町議会定例会";
    expect(parseHeldOn(text, 2024)).toBe("2024-03-01");
  });

  it("令和元年の日付を抽出する", () => {
    const text = "令和元年12月5日\n坂城町議会第4回定例会";
    expect(parseHeldOn(text, 2019)).toBe("2019-12-05");
  });

  it("日付が見つからない場合はnullを返す", () => {
    expect(parseHeldOn("坂城町議会会議録", 2024)).toBeNull();
    expect(parseHeldOn("", 2024)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（若林敏明君） ただいまから本日の会議を開きます。
○1番（柳澤眞由美君） 質問があります。
○町長（山村弘君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("若林敏明");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("柳澤眞由美");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("山村弘");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（若林敏明君） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（若林敏明君） ただいま。
○1番（柳澤眞由美君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（若林敏明君） ただいまから会議を開きます。
（1番　柳澤眞由美君登壇）
○1番（柳澤眞由美君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○副町長（田中二郎君） ご説明いたします。
○教育長（山岸正春君） お答えいたします。
○総務課長（鈴木三郎君） ご報告します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("教育長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("課長");
  });
});
