import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractMeetingTitleFromText,
  parseHeldOnFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("extractMeetingTitleFromText", () => {
  it("文字間スペースのある PDF 冒頭から正式タイトルを抽出する", () => {
    const text = `
      利 根 郡 片 品 村 令 和 ６ 年 １ ２ 月 ６ 日 －1－
      令 和 ６ 年 第 ４ 回 片 品 村 議 会 定 例 会 会 議 録 第 １ 号
      議事日程 第１号
    `;

    expect(extractMeetingTitleFromText(text)).toBe("令和6年第4回片品村議会定例会会議録第1号");
  });
});

describe("parseHeldOnFromText", () => {
  it("文字間スペースのある和暦日付を開催日として返す", () => {
    const text = `
      利 根 郡 片 品 村 令 和 ６ 年 １ ２ 月 ６ 日 －1－
      令 和 ６ 年 第 ４ 回 片 品 村 議 会 定 例 会 会 議 録 第 １ 号
    `;

    expect(parseHeldOnFromText(text)).toBe("2024-12-06");
  });
});

describe("parseSpeaker", () => {
  it("議員番号と役職付き発言ヘッダーを解釈する", () => {
    expect(parseSpeaker("７番（北澤佳子君）まず、観光施策について伺います。")).toEqual({
      speakerName: "北澤佳子",
      speakerRole: "議員",
      content: "まず、観光施策について伺います。",
    });

    expect(parseSpeaker("教育委員会事務局長（星野孝行君）学校給食の状況を報告します。")).toEqual({
      speakerName: "星野孝行",
      speakerRole: "教育委員会事務局長",
      content: "学校給食の状況を報告します。",
    });
  });
});

describe("classifyKind", () => {
  it("役職に応じて発言種別を返す", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("教育委員会事務局長")).toBe("answer");
    expect(classifyKind("議員")).toBe("question");
    expect(classifyKind("産業民教常任委員長")).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("丸マーカーがなくても役職ヘッダーごとに発言を抽出する", () => {
    const text = `
      利 根 郡 片 品 村 令 和 ６ 年 １ ２ 月 ６ 日 －5－
      議長（萩原正信君） ただいまから、令和６年第４回片品村議会定例会を開会します。
      本日の会議を開きます。
      議長（萩原正信君） 日程第１、会議録署名議員の指名を行います。
      産業民教常任委員長（小柳紀一君） 委員会の審査結果を報告いたします。
      教育長（萩原明富君） 学校施設整備の進捗について答弁します。
      ７番（北澤佳子君） まず、観光施策について伺います。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(5);
    expect(statements[0]?.speakerRole).toBe("議長");
    expect(statements[0]?.kind).toBe("remark");
    expect(statements[1]?.content).toBe("日程第1、会議録署名議員の指名を行います。");
    expect(statements[2]?.speakerRole).toBe("産業民教常任委員長");
    expect(statements[2]?.kind).toBe("remark");
    expect(statements[3]?.speakerRole).toBe("教育長");
    expect(statements[3]?.kind).toBe("answer");
    expect(statements[4]?.speakerName).toBe("北澤佳子");
    expect(statements[4]?.kind).toBe("question");
  });
});
