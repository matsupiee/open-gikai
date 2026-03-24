import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parsePdfLinks, parseUpdateDate } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("◯山田議長 ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("◯田中町長 お答えいたします。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("◯鈴木副町長 ご説明いたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("◯佐藤一郎議員 質問いたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("◯木村委員長 ただいま議題に供されました。");
    expect(result.speakerName).toBe("木村");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいま議題に供されました。");
  });

  it("副委員長を正しくパースする（副が優先される）", () => {
    const result = parseSpeaker("◯高橋副委員長 進行いたします。");
    expect(result.speakerName).toBe("高橋");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("進行いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("◯伊藤建設課長 ご報告いたします。");
    expect(result.speakerName).toBe("伊藤建設");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("◯マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("◯マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("◯田中太郎 発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("発言します。");
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
  it("◯マーカー行から発言を抽出する", () => {
    const text = `
◯山田議長 ただいまから本日の会議を開きます。
◯佐藤議員 質問いたします。
◯田中町長 お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("山田");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("複数行にまたがる発言をまとめる", () => {
    const text = `
◯佐藤議員 質問の第一点目について
伺いたいと思います。
具体的には以下の通りです。
◯田中町長 お答えします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("質問の第一点目について");
    expect(statements[0]!.content).toContain("伺いたいと思います。");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "◯山田議長 ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `◯山田議長 ただいま。\n◯田中議員 質問です。`;
    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("短すぎる行はスキップする", () => {
    const text = `
◯山田議長 開会。
  `.trim();

    const statements = parseStatements(text);
    // "開会。" は3文字 → 含まれる
    expect(statements).toHaveLength(1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toHaveLength(0);
    expect(parseStatements("\n\n\n")).toHaveLength(0);
  });
});

describe("parsePdfLinks", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <p><a href="/files/file/box/05/053a73759464cc5d6f87c5e7789efe9ef28fa156.pdf">議事日程</a></p>
      <p><a href="/files/file/box/62/62fdafb475ab7da742e6569ff5dd3d33169a47db.pdf">通告書</a></p>
    `;

    const links = parsePdfLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0]).toBe("/files/file/box/05/053a73759464cc5d6f87c5e7789efe9ef28fa156.pdf");
    expect(links[1]).toBe("/files/file/box/62/62fdafb475ab7da742e6569ff5dd3d33169a47db.pdf");
  });

  it("重複するリンクを除去する", () => {
    const html = `
      <a href="/files/file/box/05/abc.pdf">1回目</a>
      <a href="/files/file/box/05/abc.pdf">2回目</a>
    `;

    const links = parsePdfLinks(html);
    expect(links).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<p>PDFはありません</p>`;
    expect(parsePdfLinks(html)).toHaveLength(0);
  });
});

describe("parseUpdateDate", () => {
  it("令和の更新日を YYYY-MM-DD に変換する", () => {
    const html = `<p>更新日 : 令和08年03月04日（水曜日）</p>`;
    expect(parseUpdateDate(html)).toBe("2026-03-04");
  });

  it("令和7年の更新日を変換する", () => {
    const html = `<p>更新日 : 令和07年12月21日（日曜日）</p>`;
    expect(parseUpdateDate(html)).toBe("2025-12-21");
  });

  it("更新日が見つからない場合は null を返す", () => {
    const html = `<p>情報がありません</p>`;
    expect(parseUpdateDate(html)).toBeNull();
  });
});
