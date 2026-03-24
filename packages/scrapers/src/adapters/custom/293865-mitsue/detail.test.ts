import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOn,
  extractTitle,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○議長（田中一郎君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○村長（山本花子君）　お答えいたします。");
    expect(result.speakerName).toBe("山本花子");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("○３番（佐藤次郎君）　質問いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（鈴木三郎君）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○総務課長（高橋四郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副村長パターンを解析する", () => {
    const result = parseSpeaker("○副村長（中村五郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("中村五郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副議長は議長と誤マッチしない", () => {
    const result = parseSpeaker("○副議長（伊藤六郎君）　進行します。");
    expect(result.speakerRole).toBe("副議長");
    expect(result.speakerName).toBe("伊藤六郎");
  });

  it("副委員長は委員長と誤マッチしない", () => {
    const result = parseSpeaker("○副委員長（渡辺七郎君）　進行します。");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.speakerName).toBe("渡辺七郎");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○村長（山本　花子君）　答弁します。");
    expect(result.speakerName).toBe("山本花子");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開議");
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
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（田中一郎君）　ただいまから本日の会議を開きます。
○３番（佐藤次郎君）　質問があります。
○村長（山本花子君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中一郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤次郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("山本花子");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（田中一郎君）　テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中一郎君）　ただいま。
○３番（佐藤次郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田中一郎君）　ただいまから会議を開きます。
（３番　佐藤次郎君登壇）
○３番（佐藤次郎君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("extractHeldOn", () => {
  it("平成の日付を抽出する", () => {
    const text =
      "平成29年5月26日　御杖村議会臨時会会議録\n\n○議長（田中一郎君）　開会します。";
    expect(extractHeldOn(text)).toBe("2017-05-26");
  });

  it("令和の日付を抽出する", () => {
    const text = "令和7年12月定例会会議録\n令和7年12月3日\n○議長（田中一郎君）　開会します。";
    expect(extractHeldOn(text)).toBe("2025-12-03");
  });

  it("令和元年に対応する", () => {
    const text = "令和元年12月5日　御杖村議会定例会会議録";
    expect(extractHeldOn(text)).toBe("2019-12-05");
  });

  it("全角数字を含む日付を抽出する（御杖村 PDF の実際の形式）", () => {
    // 実際の PDF: "令和６年第４回（１２月）定例会 御杖村議会会議録 令和６年１２月 ２日開会"
    const text =
      "令和６年第４回（１２月）定例会 御杖村議会会議録 令和６年１２月 ２日開会 令和６年１２月１３日閉会";
    expect(extractHeldOn(text)).toBe("2024-12-02");
  });

  it("全角数字・スペース区切りの日付を抽出する", () => {
    // 実際の PDF: "令和６年 ６月１０日開会"
    const text = "令和６年第２回（６月）定例会 御杖村議会会議録 令和６年 ６月１０日開会";
    expect(extractHeldOn(text)).toBe("2024-06-10");
  });

  it("元号と年号の間にスペースがある日付を抽出する（臨時会 PDF の実際の形式）", () => {
    // 実際の PDF: "令和 ６年 ５月１３日開会"
    const text =
      "写 令和６年第１回臨時会 御杖村議会会議録 令和 ６年 ５月１３日開会 令和 ６年 ５月１３日閉会";
    expect(extractHeldOn(text)).toBe("2024-05-13");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOn("会議録")).toBeNull();
  });
});

describe("extractTitle", () => {
  it("PDF 冒頭から会議タイトルを抽出する", () => {
    const text = "令和5年第1回3月定例会会議録\n\n○議長（田中一郎君）　開会します。";
    expect(extractTitle(text, "fallback")).toBe("令和5年第1回3月定例会会議録");
  });

  it("臨時会タイトルを抽出する", () => {
    const text = "平成29年5月26日　御杖村議会臨時会会議録\n\n○議長";
    expect(extractTitle(text, "fallback")).toContain("臨時会会議録");
  });

  it("全角数字を含む会議タイトルを正規化して抽出する", () => {
    // 実際の PDF 冒頭形式: "令和６年第４回（１２月）定例会 御杖村議会会議録"
    const text =
      "令和６年第４回（１２月）定例会 御杖村議会会議録 令和６年１２月 ２日開会 令和６年１２月１３日閉会";
    const title = extractTitle(text, "fallback");
    // 全角数字が半角に変換され、会議録を含むタイトルが抽出されること
    expect(title).toContain("会議録");
    expect(title).toContain("令和6年");
    expect(title).not.toBe("fallback");
  });

  it("タイトルが見つからない場合は fallback を返す", () => {
    expect(extractTitle("何もない", "fallback title")).toBe("fallback title");
  });
});
