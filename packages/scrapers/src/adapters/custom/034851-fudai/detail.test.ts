import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyKind,
  mergePageTexts,
  normalizeText,
  parseSpeakerHeader,
  parseStatements,
  stripPageArtifacts,
} from "./detail";

describe("normalizeText", () => {
  it("PDF 抽出由来の空白を詰める", () => {
    expect(normalizeText("柾 屋 村 長。 議 長 の お 許 し")).toBe(
      "柾屋村長。議長のお許し",
    );
  });
});

describe("stripPageArtifacts", () => {
  it("ページ先頭のページ番号と欄外ヘッダを除去する", () => {
    const page = `
      8
      議 長
      柾屋村長
      とか、あるいは、「毎回聞きますよ」というように半強制的に押し付けるよ
      うな対応があったということも聞いております。
    `;

    expect(stripPageArtifacts(page)).toBe(
      [
        "とか、あるいは、「毎回聞きますよ」というように半強制的に押し付けるよ",
        "うな対応があったということも聞いております。",
      ].join("\n"),
    );
  });
});

describe("mergePageTexts", () => {
  it("ページ境界ノイズを落として連結する", () => {
    const merged = mergePageTexts([
      `
        7
        一般質問
        議 長
        中上議員
        久慈管内のある病院では、「毎回のように次には持ってきてください」
      `,
      `
        8
        議 長
        柾屋村長
        とか、あるいは、「毎回聞きますよ」というように半強制的に押し付けるよ
        うな対応があったということも聞いております。
      `,
    ]);

    expect(merged).not.toContain("8\n議 長");
    expect(merged).not.toContain("柾屋村長\nとか");
    expect(merged).toContain("「毎回のように次には持ってきてください」");
    expect(merged).toContain("とか、あるいは、「毎回聞きますよ」");
  });
});

describe("parseSpeakerHeader", () => {
  it("村長見出しをパースする", () => {
    expect(parseSpeakerHeader("柾屋村長")).toEqual({
      speakerName: "柾屋",
      speakerRole: "村長",
    });
  });

  it("番号付き議員見出しをパースする", () => {
    expect(parseSpeakerHeader("4番齊藤議員")).toEqual({
      speakerName: "齊藤",
      speakerRole: "議員",
    });
  });

  it("課長見出しをパースする", () => {
    expect(parseSpeakerHeader("松葉住民福祉課長")).toEqual({
      speakerName: "松葉",
      speakerRole: "住民福祉課長",
    });
  });

  it("名前なしの議長をパースする", () => {
    expect(parseSpeakerHeader("議長")).toEqual({
      speakerName: null,
      speakerRole: "議長",
    });
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("住民福祉課長は answer", () => {
    expect(classifyKind("住民福祉課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("話者見出しで発言を分割する", () => {
    const text = `
      日程第4「村長の行政報告」を行います。
      柾 屋 村 長。 議長のお許しがございましたので、報告をいたします。
      4 番 齊 藤 議 員。 ありがとうございます。質問いたします。
      松 葉 住 民 福 祉 課 長。 現在の状況をご説明いたします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("柾屋");
    expect(statements[0]!.speakerRole).toBe("村長");
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.content).toBe("議長のお許しがございましたので、報告をいたします。");
    expect(statements[0]!.contentHash).toBe(
      createHash("sha256")
        .update("議長のお許しがございましたので、報告をいたします。")
        .digest("hex"),
    );

    expect(statements[1]!.speakerName).toBe("齊藤");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("松葉");
    expect(statements[2]!.speakerRole).toBe("住民福祉課長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("時刻表記を本文から除去する", () => {
    const text = `
      議 長。 暫時休憩します。 （10：58）
      議 長。 休憩前に戻りまして、会議を再開します。 （10：58）
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("暫時休憩します。");
    expect(statements[1]!.content).toBe("休憩前に戻りまして、会議を再開します。");
  });

  it("話者見出しがない場合は空配列を返す", () => {
    expect(parseStatements("議事録本文のみです。")).toEqual([]);
  });
});
