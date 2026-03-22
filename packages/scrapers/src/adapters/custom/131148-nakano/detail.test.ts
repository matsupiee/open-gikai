import { describe, expect, test } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  detectCommitteeSpeaker,
  cleanHtmlText,
  parseStatements,
} from "./detail";
import { parseJapaneseDate, detectMeetingType } from "./shared";

describe("parseJapaneseDate", () => {
  test("半角数字の和暦日付を変換する", () => {
    expect(parseJapaneseDate("令和7年12月10日")).toBe("2025-12-10");
  });

  test("全角数字の和暦日付を変換する", () => {
    expect(parseJapaneseDate("令和７年１２月１０日")).toBe("2025-12-10");
  });

  test("平成の日付を変換する", () => {
    expect(parseJapaneseDate("平成16年3月5日")).toBe("2004-03-05");
  });

  test("マッチしない文字列は null", () => {
    expect(parseJapaneseDate("2025年12月10日")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  test("議長の発言を解析する", () => {
    const result = parseSpeaker(
      "○議長（森たかゆき）　日程第１、一般質問を行います。"
    );
    expect(result.speakerName).toBe("森たかゆき");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("日程第１、一般質問を行います。");
  });

  test("区長の発言を解析する", () => {
    const result = parseSpeaker(
      "○区長（酒井直人）　ただいま上程されました議案について御説明いたします。"
    );
    expect(result.speakerName).toBe("酒井直人");
    expect(result.speakerRole).toBe("区長");
    expect(result.content).toBe("ただいま上程されました議案について御説明いたします。");
  });

  test("議席番号の議員を解析する", () => {
    const result = parseSpeaker("○２９番（高橋かずちか）　質問いたします。");
    expect(result.speakerName).toBe("高橋かずちか");
    expect(result.speakerRole).toBe("２９番");
    expect(result.content).toBe("質問いたします。");
  });

  test("○ のみで括弧がない場合は speakerRole/Name なし", () => {
    const result = parseSpeaker("○不明なテキスト");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("不明なテキスト");
  });
});

describe("detectMeetingType", () => {
  test("本会議", () => {
    expect(
      detectMeetingType("令和７年１２月１０日中野区議会本会議（第４回定例会）")
    ).toBe("plenary");
  });

  test("委員会", () => {
    expect(
      detectMeetingType("令和７年１１月２８日中野区議会総務委員会")
    ).toBe("committee");
  });

  test("臨時会", () => {
    expect(detectMeetingType("令和７年中野区議会臨時会")).toBe("extraordinary");
  });
});

describe("classifyKind", () => {
  test("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  test("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  test("区長は answer", () => {
    expect(classifyKind("区長")).toBe("answer");
  });

  test("部長は answer", () => {
    expect(classifyKind("健康福祉部長")).toBe("answer");
  });

  test("議席番号は question", () => {
    expect(classifyKind("２９番")).toBe("question");
  });

  test("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("detectCommitteeSpeaker", () => {
  test("委員長を検出する", () => {
    expect(detectCommitteeSpeaker("委員長")).toEqual({ role: "委員長" });
  });

  test("副委員長を検出する", () => {
    expect(detectCommitteeSpeaker("副委員長")).toEqual({ role: "副委員長" });
  });

  test("名前+役職を検出する", () => {
    expect(detectCommitteeSpeaker("岩浅企画部長")).toEqual({ role: "岩浅企画部長" });
  });

  test("役職キーワードがない行は null", () => {
    expect(detectCommitteeSpeaker("定足数に達しましたので")).toBeNull();
  });
});

describe("cleanHtmlText", () => {
  test("HTML タグを除去する", () => {
    expect(cleanHtmlText("<p>テスト</p>")).toBe("テスト");
  });

  test("BR タグを改行に変換する", () => {
    expect(cleanHtmlText("行1<br>行2")).toBe("行1\n行2");
  });

  test("HTML エンティティをデコードする", () => {
    expect(cleanHtmlText("&amp; &lt; &gt;")).toBe("& < >");
  });
});

describe("parseStatements (plenary)", () => {
  test("本会議の発言を抽出する", () => {
    const html = `
      <div id="sh">
        <p class=MsoNormal>○議長（森たかゆき）　日程第１、一般質問を行います。</p>
        <p class=MsoNormal>○２９番（高橋かずちか）　質問いたします。</p>
        <p class=MsoNormal>○区長（酒井直人）　お答えいたします。</p>
      </div>
    `;

    const statements = parseStatements(html, "中野区議会本会議");
    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("森たかゆき");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.speakerRole).toBe("２９番");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.speakerRole).toBe("区長");
    expect(statements[2]!.kind).toBe("answer");
  });
});

describe("parseStatements (committee)", () => {
  test("委員会の発言を抽出する", () => {
    const html = `
      <div id="sh">
        <p>委員長</p>
        <p>　定足数に達しましたので、総務委員会を開会いたします。</p>
        <p>岩浅企画部長</p>
        <p>　企画部長の岩浅でございます。よろしくお願いいたします。</p>
      </div>
    `;

    const statements = parseStatements(html, "中野区議会総務委員会");
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("委員長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.speakerRole).toBe("岩浅企画部長");
    expect(statements[1]!.kind).toBe("answer");
  });
});
