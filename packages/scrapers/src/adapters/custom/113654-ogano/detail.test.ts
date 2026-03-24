import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名）パターンを解析する", () => {
    const result = parseSpeaker("議長（鈴木一郎）");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議長");
  });

  it("町長（氏名）パターンを解析する", () => {
    const result = parseSpeaker("町長（田中太郎）");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("町長");
  });

  it("番号付き議員（半角）を解析する", () => {
    const result = parseSpeaker("10番（山田花子）");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("議員");
  });

  it("番号付き議員（全角）を解析する", () => {
    const result = parseSpeaker("１０番（山田花子）");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("議員");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("副町長（佐藤次郎）");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副町長");
  });

  it("総務課長（複合役職）を解析する", () => {
    const result = parseSpeaker("総務課長（高橋三郎）");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("課長");
  });

  it("副委員長は委員長と区別される", () => {
    const result = parseSpeaker("副委員長（伊藤四郎）");
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("町長（田中　太郎）");
    expect(result.speakerName).toBe("田中太郎");
  });

  it("括弧なしのテキストは null を返す", () => {
    const result = parseSpeaker("午前10時開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
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

describe("parseStatements", () => {
  it("<b> タグで発言を分割する", () => {
    const html = `
<body>
<b>議長（鈴木一郎）</b>　ただいまから会議を開きます。
<b>１番（山田花子）</b>　質問いたします。
<b>町長（田中太郎）</b>　お答えします。
</body>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("鈴木一郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toContain("ただいまから会議を開きます");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("山田花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("田中太郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const html = `<b>議長（鈴木一郎）</b>　テスト発言。`;
    const statements = parseStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("HTML タグは除去されてプレーンテキストになる", () => {
    const html = `<b>議長（鈴木一郎）</b>　<font color="red">重要な発言</font>です。`;
    const statements = parseStatements(html);
    expect(statements[0]!.content).toBe("重要な発言です。");
  });

  it("&nbsp; はスペースに変換される", () => {
    const html = `<b>議長（鈴木一郎）</b>&nbsp;発言内容です。`;
    const statements = parseStatements(html);
    expect(statements[0]!.content).toContain("発言内容です");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
    expect(parseStatements("<html><body></body></html>")).toEqual([]);
  });

  it("発言内容のない <b> タグはスキップされる", () => {
    const html = `
<b>議長（鈴木一郎）</b>　発言があります。
<b>強調テキスト</b>
<b>２番（佐藤一朗）</b>　質問します。
    `;
    const statements = parseStatements(html);
    // 「強調テキスト」は括弧がないので発言者として扱われない
    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});

describe("extractHeldOn", () => {
  it("令和年の日付を抽出する", () => {
    const html = `
      <p>令和7年3月5日　小鹿野町議会定例会</p>
    `;
    expect(extractHeldOn(html)).toBe("2025-03-05");
  });

  it("平成年の日付を抽出する", () => {
    const html = `
      <p>平成29年3月6日　小鹿野町議会定例会</p>
    `;
    expect(extractHeldOn(html)).toBe("2017-03-06");
  });

  it("令和元年の日付を抽出する", () => {
    const html = `
      <p>令和元年6月3日　小鹿野町議会定例会</p>
    `;
    expect(extractHeldOn(html)).toBe("2019-06-03");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOn("<html><body>テスト</body></html>")).toBeNull();
  });
});
