import { describe, expect, it } from "vitest";
import { classifyKind, parsePageText, parseStatements } from "./detail";

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

describe("parsePageText", () => {
  it("議事の経過テーブルから発言者と発言内容を抽出する", () => {
    const pageText = [
      "2",
      "議 事 の 経 過",
      "日 程 発 言 者 発 言",
      "10：00",
      "開会",
      "日程１",
      "議 長",
      "( 田 中 一 郎 )",
      "〃",
      "副 町 長",
      "( 佐 藤 二 郎 )",
      "ただいまの出席議員数は、10 人です。",
      "定足数に達しておりますので、ただいまから会議を開会します。",
      "提案理由の説明を求めます。",
    ].join("\n");

    const results = parsePageText(pageText);

    expect(results).toHaveLength(3);
    expect(results[0]!.speakerRole).toBe("議長");
    expect(results[0]!.speakerName).toBe("田中一郎");
    expect(results[1]!.speakerRole).toBe("議長");
    expect(results[2]!.speakerRole).toBe("副町長");
    expect(results[2]!.speakerName).toBe("佐藤二郎");
  });

  it("スペース入り役職名を正規化してマッチする", () => {
    const pageText = [
      "議 事 の 経 過",
      "日 程 発 言 者 発 言",
      "副 町 長",
      "( 山 田 三 郎 )",
      "ご説明申し上げます。",
    ].join("\n");

    const results = parsePageText(pageText);

    expect(results).toHaveLength(1);
    expect(results[0]!.speakerRole).toBe("副町長");
    expect(results[0]!.speakerName).toBe("山田三郎");
    expect(results[0]!.content).toBe("ご説明申し上げます。");
  });

  it("議事の経過セクションがない場合は空配列を返す", () => {
    const pageText = [
      "1",
      "令和６年 第１回蘭越町議会臨時会会議録",
      "○開会及び閉会",
      "開会 令和 6 年 1 月 30 日",
    ].join("\n");

    const results = parsePageText(pageText);
    expect(results).toHaveLength(0);
  });

  it("番号付き議員を議員ロールとして抽出する", () => {
    const pageText = [
      "議 事 の 経 過",
      "日 程 発 言 者 発 言",
      "5 番",
      "( 鈴 木 四 郎 )",
      "一般質問いたします。農業振興について。",
    ].join("\n");

    const results = parsePageText(pageText);
    expect(results).toHaveLength(1);
    expect(results[0]!.speakerRole).toBe("議員");
    expect(results[0]!.speakerName).toBe("鈴木四郎");
    expect(results[0]!.content).toBe("一般質問いたします。農業振興について。");
  });
});

describe("parseStatements", () => {
  it("複数ページから発言を抽出する", () => {
    const pages = [
      // ページ1: メタ情報のみ（議事の経過なし）
      [
        "1",
        "令和６年 第１回蘭越町議会臨時会会議録",
        "○開会及び閉会",
      ].join("\n"),
      // ページ2: 議事の経過
      [
        "2",
        "議 事 の 経 過",
        "日 程 発 言 者 発 言",
        "10：00",
        "議 長",
        "( 田 中 一 郎 )",
        "ただいまから会議を開きます。",
        "5 番",
        "( 鈴 木 四 郎 )",
        "一般質問いたします。",
        "町 長",
        "( 山 本 五 郎 )",
        "お答えいたします。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);

    expect(statements.length).toBeGreaterThan(0);
    const roles = statements.map((s) => s.speakerRole);
    expect(roles).toContain("議長");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const pages = [
      [
        "議 事 の 経 過",
        "日 程 発 言 者 発 言",
        "議 長",
        "( 田 中 一 郎 )",
        "ただいまから会議を開きます。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const pages = [
      [
        "議 事 の 経 過",
        "日 程 発 言 者 発 言",
        "議 長",
        "( 田 中 一 郎 )",
        "ただいま。",
        "5 番",
        "( 鈴 木 )",
        "質問です。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.startOffset).toBe(0);
  });

  it("全ページに議事の経過がない場合は空配列を返す", () => {
    const pages = [
      "令和６年 第１回蘭越町議会臨時会会議録",
      "出席議員一覧",
    ];

    const statements = parseStatements(pages);
    expect(statements).toHaveLength(0);
  });
});
