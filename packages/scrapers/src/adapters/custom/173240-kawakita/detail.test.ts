import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractMeetingTitleFromText,
  parseHeldOnFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseHeldOnFromText", () => {
  it("和暦日付を開催日に変換する", () => {
    expect(parseHeldOnFromText("令和７年３月４日（火曜日）")).toBe("2025-03-04");
  });
});

describe("extractMeetingTitleFromText", () => {
  it("本文先頭から会議タイトルを抽出する", () => {
    const text = "只今から、令和 7 年第 2 回川北町議会 定例会を開会します。";
    expect(extractMeetingTitleFromText(text)).toBe("令和7年第2回川北町議会定例会");
  });
});

describe("parseSpeaker", () => {
  it("議長・町長・議員番号の発言行を解釈する", () => {
    expect(parseSpeaker("◇議長 西田時雄 只今から会議を開きます。")).toEqual({
      speakerName: "西田時雄",
      speakerRole: "議長",
      content: "只今から会議を開きます。",
    });

    expect(parseSpeaker("◇町長 前 哲雄 はい、議長。")).toEqual({
      speakerName: "前哲雄",
      speakerRole: "町長",
      content: "はい、議長。",
    });

    expect(parseSpeaker("◇6 番 窪田 博 はい、議長。")).toEqual({
      speakerName: "窪田博",
      speakerRole: "議員",
      content: "はい、議長。",
    });
  });
});

describe("classifyKind", () => {
  it("役職に応じて発言種別を返す", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("議員")).toBe("question");
    expect(classifyKind("町長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("◇マーカーごとに発言を抽出する", () => {
    const text = `
      ≪開 会≫
      ◇議長 西田時雄 只今から会議を開きます。
      ≪会期の決定≫
      ◇議長 西田時雄 日程第1、会期の決定を議題にします。〔「異議なし」の声あり〕異議なしと認めます。
      ◇町長 前 哲雄 はい、議長。本日、定例会を開催致しました。
      ◇6 番 窪田 博 はい、議長。提案理由の説明を致します。
    `;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(4);
    expect(statements[0]?.speakerRole).toBe("議長");
    expect(statements[1]?.content).toBe("日程第1、会期の決定を議題にします。異議なしと認めます。");
    expect(statements[2]?.speakerName).toBe("前哲雄");
    expect(statements[3]?.speakerRole).toBe("議員");
  });
});
