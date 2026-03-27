import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseHeldOnFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("192112-fuefuki/detail", () => {
  it("発言者ヘッダーから役職と氏名を抽出する", () => {
    expect(parseSpeaker("〇議長（神宮司正人君） ただいま開会いたします。")).toEqual({
      speakerName: "神宮司正人",
      speakerRole: "議長",
      content: "ただいま開会いたします。",
    });

    expect(parseSpeaker("〇１０番（山田宏司君） 質問いたします。")).toEqual({
      speakerName: "山田宏司",
      speakerRole: "議員",
      content: "質問いたします。",
    });
  });

  it("役職から発言種別を分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("市長")).toBe("answer");
    expect(classifyKind("議員")).toBe("question");
  });

  it("PDF テキストから開会日を抽出する", () => {
    const text = "令 和 ７ 年 笛 吹 市 議 会 第 １ 回 定 例 会 会 議 録 令和７年２月２０日 開会 令和７年３月２１日 閉会";
    expect(parseHeldOnFromText(text)).toBe("2025-02-20");
  });

  it("発言以外の見出しブロックを除外して statements を組み立てる", () => {
    const text = `
      ３ ○ 応招・不応招議員 応招議員（１９名）
      〇議長（神宮司正人君） ただいまの出席議員は１９名であります。
      〇市長（山下政樹君） 提出議案の概要を説明いたします。
      〇１０番（山田宏司君） 質問いたします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]?.speakerRole).toBe("議長");
    expect(statements[1]?.speakerRole).toBe("市長");
    expect(statements[1]?.kind).toBe("answer");
    expect(statements[2]?.speakerRole).toBe("議員");
    expect(statements[2]?.kind).toBe("question");
  });
});
