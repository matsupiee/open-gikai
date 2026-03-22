import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractTitle } from "./detail";

describe("extractTitle", () => {
  it("h2 から会議録タイトルを抽出する", () => {
    const html = `
      <h2>サイトタイトル</h2>
      <h2>令和7年第1回江別市議会定例会会議録（第1号）令和7年2月20日</h2>
    `;
    expect(extractTitle(html)).toBe(
      "令和7年第1回江別市議会定例会会議録（第1号）令和7年2月20日",
    );
  });

  it("会議録を含まない場合は令和/平成で始まる h2 を返す", () => {
    const html = `<h2>令和7年第1回定例会 令和7年3月3日</h2>`;
    expect(extractTitle(html)).toBe("令和7年第1回定例会 令和7年3月3日");
  });

  it("該当する h2 がなければ null を返す", () => {
    const html = `<h2>江別市議会</h2>`;
    expect(extractTitle(html)).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("役職（氏名君） パターンをパースする", () => {
    const result = parseSpeaker("議長（島田泰美君）");
    expect(result).toEqual({ speakerName: "島田泰美", speakerRole: "議長" });
  });

  it("市長パターンをパースする", () => {
    const result = parseSpeaker("市長（後藤好人君）");
    expect(result).toEqual({ speakerName: "後藤好人", speakerRole: "市長" });
  });

  it("部長パターンをパースする", () => {
    const result = parseSpeaker("総務部長（白崎敬浩君）");
    expect(result).toEqual({ speakerName: "白崎敬浩", speakerRole: "総務部長" });
  });

  it("氏名君パターンをパースする", () => {
    const result = parseSpeaker("佐々木聖子君");
    expect(result).toEqual({ speakerName: "佐々木聖子", speakerRole: null });
  });

  it("番号付き議員パターンで role を null にする", () => {
    const result = parseSpeaker("１番（岩田優太君）");
    expect(result).toEqual({ speakerName: "岩田優太", speakerRole: null });
  });

  it("空文字は null を返す", () => {
    expect(parseSpeaker("")).toBeNull();
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("総務部長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("null (議員) は question", () => {
    expect(classifyKind(null)).toBe("question");
  });

  it("常任委員長は remark", () => {
    expect(classifyKind("予算決算常任委員長")).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("h4 タグから発言ブロックを抽出する", () => {
    const html = `
      <body>
        <h4>議長（島田泰美君）</h4>
        <p>これより会議を開きます。</p>
        <h4>市長（後藤好人君）</h4>
        <p>ご質問にお答えいたします。</p>
      </body>
    `;
    const statements = parseStatements(html);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("島田泰美");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("これより会議を開きます。");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("後藤好人");
    expect(statements[1]!.speakerRole).toBe("市長");
  });

  it("◎ 付きの h4 セクション見出しをスキップする", () => {
    const html = `
      <body>
        <h4>◎ 開会宣告</h4>
        <h4>議長（島田泰美君）</h4>
        <p>開会いたします。</p>
      </body>
    `;
    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("空の発言内容をスキップする", () => {
    const html = `
      <body>
        <h4>議長（島田泰美君）</h4>
        <h4>市長（後藤好人君）</h4>
        <p>答弁です。</p>
      </body>
    `;
    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("市長");
  });

  it("contentHash が SHA-256 で生成される", () => {
    const html = `
      <body>
        <h4>議長（島田泰美君）</h4>
        <p>テスト発言です。</p>
      </body>
    `;
    const statements = parseStatements(html);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
