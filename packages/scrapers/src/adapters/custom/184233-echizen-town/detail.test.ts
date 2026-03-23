import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parsePdfLinks,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker("○議長（山川知一郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山川知一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副議長パターンを抽出する", () => {
    const result = parseSpeaker("○副議長（田中太郎君）　休憩いたします。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩いたします。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker("○町長（内藤俊三君）　お答えいたします。");
    expect(result.speakerName).toBe("内藤俊三");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○５番（吉田太郎君）　質問いたします。");
    expect(result.speakerName).toBe("吉田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("総務部長パターンから部長を抽出する", () => {
    const result = parseSpeaker("○総務部長（佐藤次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前に全角スペースがある場合に除去する", () => {
    const result = parseSpeaker("○町長（内藤　俊三君）　お答えします。");
    expect(result.speakerName).toBe("内藤俊三");
    expect(result.speakerRole).toBe("町長");
  });

  it("マーカーなしの場合はそのまま content を返す", () => {
    const result = parseSpeaker("ただの文章です。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("ただの文章です。");
  });

  it("◯(白丸)マーカーも対応する", () => {
    const result = parseSpeaker("◯議長（山川知一郎君）　開会します。");
    expect(result.speakerName).toBe("山川知一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開会します。");
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

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
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
  it("○マーカーで分割して ParsedStatement 配列を生成する", () => {
    const text = [
      "○議長（山川知一郎君）　ただいまから会議を開きます。",
      "○５番（吉田太郎君）　質問いたします。",
      "○町長（内藤俊三君）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("山川知一郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("ただいまから会議を開きます。").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("吉田太郎");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("内藤俊三");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（山川知一郎君）　開会します。",
      "○（吉田太郎君登壇）",
      "○５番（吉田太郎君）　質問します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("議員");
  });

  it("○マーカーがないテキストは空配列を返す", () => {
    const result = parseStatements("普通のテキストです。マーカーはありません。");
    expect(result).toEqual([]);
  });

  it("startOffset / endOffset が正しく計算される", () => {
    const text = "○議長（山川知一郎君）　開会します。\n○町長（内藤俊三君）　お答えします。";
    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("空の content の発言はスキップする", () => {
    const text = "○議長（山川知一郎君）\n○町長（内藤俊三君）　お答えします。";
    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("町長");
  });
});

describe("parsePdfLinks", () => {
  it("本会議議事録ページから PDF リンクを抽出する", () => {
    const html = `
      <a href="p009573_d/fil/070903_first.pdf">令和7年9月越前町議会定例会本会議議事録_9月3日(第1号)（PDF形式 817キロバイト）</a>
      <a href="p009573_d/fil/070904_second.pdf">令和7年9月越前町議会定例会本会議議事録_9月4日(第2号)（PDF形式 546キロバイト）</a>
      <a href="p009573_d/fil/070912_last.pdf">令和7年9月越前町議会定例会本会議議事録_9月12日(第3号)（PDF形式 474キロバイト）</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      pdfUrl: "https://www.town.echizen.fukui.jp/chousei/04/06/p009573_d/fil/070903_first.pdf",
      linkText: "令和7年9月越前町議会定例会本会議議事録_9月3日(第1号)（PDF形式 817キロバイト）",
    });
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.echizen.fukui.jp/chousei/04/06/p009573_d/fil/070904_second.pdf",
    );
    expect(result[2]!.pdfUrl).toBe(
      "https://www.town.echizen.fukui.jp/chousei/04/06/p009573_d/fil/070912_last.pdf",
    );
  });

  it("旧形式の PDF リンクを抽出する", () => {
    const html = `
      <a href="p005179_d/fil/20170316_teireikai_01.pdf">3月16日_初日_(開会・議案上程)（PDF形式 585キロバイト）</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.echizen.fukui.jp/chousei/04/06/p005179_d/fil/20170316_teireikai_01.pdf",
    );
  });

  it("一般質問の PDF リンクを抽出する", () => {
    const html = `
      <a href="p009544_d/fil/R0709_ibe.pdf">議事録（PDF形式 265キロバイト）</a>
      <a href="p009544_d/fil/R0709_saitou.pdf">議事録（PDF形式 171キロバイト）</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.echizen.fukui.jp/chousei/04/06/p009544_d/fil/R0709_ibe.pdf",
    );
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.echizen.fukui.jp/chousei/04/06/p009544_d/fil/R0709_saitou.pdf",
    );
  });

  it("重複する PDF リンクは除外する", () => {
    const html = `
      <a href="p009573_d/fil/070903_first.pdf">リンク1</a>
      <a href="p009573_d/fil/070903_first.pdf">リンク1（重複）</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません。</p>";

    const result = parsePdfLinks(html);

    expect(result).toEqual([]);
  });

  it("絶対 URL の PDF リンクもそのまま扱う", () => {
    const html = `
      <a href="https://www.town.echizen.fukui.jp/chousei/04/06/p009573_d/fil/070903_first.pdf">リンク</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.echizen.fukui.jp/chousei/04/06/p009573_d/fil/070903_first.pdf",
    );
  });
});
