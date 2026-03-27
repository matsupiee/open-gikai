import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractMeetingTitleFromText,
  parseHeldOnFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("extractMeetingTitleFromText", () => {
  it("PDF 冒頭の正式タイトルを抽出する", () => {
    const text = `
      －1－ 令和７年第１回川場村議会定例会会議録第１号 令和７年３月５日（水曜日）
    `;

    expect(extractMeetingTitleFromText(text)).toBe(
      "令和7年第1回川場村議会定例会会議録第1号",
    );
  });
});

describe("parseHeldOnFromText", () => {
  it("最初に現れる和暦日付を開催日として返す", () => {
    const text = `
      令和７年第１回川場村議会定例会会議録第１号 令和７年３月５日（水曜日）
    `;

    expect(parseHeldOnFromText(text)).toBe("2025-03-05");
  });
});

describe("parseSpeaker", () => {
  it("事務局長と村長の発言ヘッダーを解釈する", () => {
    expect(parseSpeaker("○事務局長（今井 忠君） ただいまから開会します。")).toEqual({
      speakerName: "今井忠",
      speakerRole: "事務局長",
      content: "ただいまから開会します。",
    });

    expect(parseSpeaker("○村長（外山京太郎君） 皆さん、おはようございます。")).toEqual({
      speakerName: "外山京太郎",
      speakerRole: "村長",
      content: "皆さん、おはようございます。",
    });
  });
});

describe("classifyKind", () => {
  it("役職に応じて発言種別を返す", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("議員")).toBe("question");
    expect(classifyKind("村長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○マーカー付き発言だけを抽出する", () => {
    const text = `
      ○開会日に応招した議員 林 英明君
      ◎議長挨拶
      ○事務局長（今井 忠君） ただいまから、令和７年第１回川場村議会定例会が開かれます。
      ○議長（小菅秋雄君） 定例会開会に当たりまして、一言ご挨拶を申し上げます。
      ○村長（外山京太郎君） 皆さん、おはようございます。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]?.speakerRole).toBe("事務局長");
    expect(statements[0]?.kind).toBe("answer");
    expect(statements[1]?.speakerRole).toBe("議長");
    expect(statements[1]?.kind).toBe("remark");
    expect(statements[2]?.speakerName).toBe("外山京太郎");
  });
});
