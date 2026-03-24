import { describe, expect, it } from "vitest";
import { classifyKind, parseDateFromUrl, parsePdfUrl, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君）　ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○村長（佐藤花子君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１番（鈴木一郎君）　質問いたします。"
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("総務課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（田中次郎君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副村長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副村長（山本三郎君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("山本三郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（伊藤四郎君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○村長（佐　藤　花　子君）　答弁します。"
    );
    expect(result.speakerName).toBe("佐藤花子");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("副委員長を解析する（長い方を先にマッチ）", () => {
    const result = parseSpeaker(
      "○副委員長（木村五郎君）　ありがとうございます。"
    );
    expect(result.speakerRole).toBe("副委員長");
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
○議長（山田太郎君）　ただいまから本日の会議を開きます。
○１番（鈴木一郎君）　質問があります。
○村長（佐藤花子君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("鈴木一郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("佐藤花子");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("◎ 議事項目見出しはスキップする", () => {
    const text = `
◎行政報告
○議長（山田太郎君）　行政報告を行います。
◎会議録署名議員の指名
○議長（山田太郎君）　署名議員を指名します。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎君）　ただいま。
○１番（鈴木一郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山田太郎君）　ただいまから会議を開きます。
（１番　鈴木一郎君登壇）
○１番（鈴木一郎君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });
});

describe("parsePdfUrl", () => {
  it("PDF URL を抽出する", () => {
    const html = `
      <div class="entry-content">
        <p><a href="https://www.vill.kouzushima.tokyo.jp/images/2024/11/20241119_teireikai.pdf">
          定例会会議録：PDF
        </a></p>
      </div>
    `;
    expect(parsePdfUrl(html)).toBe(
      "https://www.vill.kouzushima.tokyo.jp/images/2024/11/20241119_teireikai.pdf"
    );
  });

  it("相対パスの PDF URL を絶対 URL に変換する", () => {
    const html = `
      <a href="/images/2024/11/20241119_teireikai.pdf">定例会会議録：PDF</a>
    `;
    expect(parsePdfUrl(html)).toBe(
      "https://www.vill.kouzushima.tokyo.jp/images/2024/11/20241119_teireikai.pdf"
    );
  });

  it("PDF URL がない場合は null を返す", () => {
    const html = `<div><p>PDFなし</p></div>`;
    expect(parsePdfUrl(html)).toBeNull();
  });
});

describe("parseDateFromUrl", () => {
  it("URL から日付を抽出する", () => {
    expect(parseDateFromUrl("https://www.vill.kouzushima.tokyo.jp/2024-1119/")).toBe("2024-11-19");
    expect(parseDateFromUrl("https://www.vill.kouzushima.tokyo.jp/2025-0301/")).toBe("2025-03-01");
    expect(parseDateFromUrl("https://www.vill.kouzushima.tokyo.jp/2026-0206/")).toBe("2026-02-06");
  });

  it("パターンに合致しない URL は null を返す", () => {
    expect(parseDateFromUrl("https://www.vill.kouzushima.tokyo.jp/busyo/gikai/")).toBeNull();
    expect(parseDateFromUrl("https://www.vill.kouzushima.tokyo.jp/")).toBeNull();
  });
});
