import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractTextFromHtml } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○議長（山下清美）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("山下清美");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("総務課長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○総務課長（藤田哲也）　お答えいたします。");
    expect(result.speakerName).toBe("藤田哲也");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員（全角）パターンを解析する", () => {
    const result = parseSpeaker("○４番（川上　均）　質問いたします。");
    expect(result.speakerName).toBe("川上　均");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号議員（半角）パターンを解析する", () => {
    const result = parseSpeaker("○4番（田中太郎）　発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("発言します。");
  });

  it("副町長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○副町長（鈴木一郎）　御説明申し上げます。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("御説明申し上げます。");
  });

  it("教育長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○教育長（伊藤花子）　お答えいたします。");
    expect(result.speakerName).toBe("伊藤花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("総務産業常任委員長パターンを解析する（委員長サフィックス）", () => {
    const result = parseSpeaker("○総務産業常任委員長（川上　均）　委員会の報告をいたします。");
    expect(result.speakerName).toBe("川上　均");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("委員会の報告をいたします。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker("○事務局長（大尾　智）　出席議員を報告いたします。");
    expect(result.speakerName).toBe("大尾　智");
    expect(result.speakerRole).toBe("局長");
    expect(result.content).toBe("出席議員を報告いたします。");
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

  it("局長は answer", () => {
    expect(classifyKind("局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("extractTextFromHtml", () => {
  it("<p> タグのテキストを連結する", () => {
    const html = `
      <html><body>
      <main>
        <p>○議長（山下清美）　ただいまから会議を開きます。</p>
        <p>○４番（川上　均）　質問があります。</p>
      </main>
      </body></html>
    `;
    const text = extractTextFromHtml(html);
    expect(text).toContain("○議長（山下清美）");
    expect(text).toContain("○４番（川上　均）");
  });

  it("旧サイトの #contents_in 内から抽出する", () => {
    const html = `
      <html><body>
      <div id="contents_in">
        <p>○議長（山下清美）　ただいまから会議を開きます。</p>
      </div>
      </body></html>
    `;
    const text = extractTextFromHtml(html);
    expect(text).toContain("○議長（山下清美）");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = [
      "○議長（山下清美）　ただいまから本日の会議を開きます。",
      "○４番（川上　均）　質問があります。",
      "○総務課長（藤田哲也）　お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山下清美");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("川上　均");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("藤田哲也");
    expect(statements[2]!.speakerRole).toBe("課長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山下清美）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("複数行の発言をひとつの statement にまとめる", () => {
    const text = [
      "○４番（川上　均）　質問の第一点目は、",
      "道路整備について伺います。",
      "また、第二点目は予算についてです。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toContain("質問の第一点目は、");
    expect(statements[0]!.content).toContain("道路整備について伺います。");
  });

  it("議事区切り（◇・・・◇）をスキップする", () => {
    const text = [
      "○議長（山下清美）　次の議題に移ります。",
      "◇・・・・・・・・・・・・・・・・・・・・・・◇",
      "○議長（山下清美）　日程第2を議題といたします。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("次の議題に移ります。");
    expect(statements[1]!.content).toBe("日程第2を議題といたします。");
  });

  it("傍聴者コメントをスキップする", () => {
    const text = [
      "○議長（山下清美）　異議はありますか。",
      "（「異議なし」と呼ぶ者あり）",
      "○議長（山下清美）　異議なしと認めます。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "○議長（山下清美）　ただいま。",
      "○４番（川上　均）　質問です。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});
