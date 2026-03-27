import { describe, expect, it } from "vitest";
import { extractHeldOn, normalizePdfText, parseSpeakerLine, parseStatements } from "./detail";

describe("normalizePdfText", () => {
  it("PDF 抽出の文字間スペースを除去する", () => {
    const input = "奥 輝 人 議 長 お は よ う ご ざ い ま す 。";
    expect(normalizePdfText(input)).toBe("奥輝人議長おはようございます。");
  });
});

describe("parseSpeakerLine", () => {
  it("役職（氏名）形式をパースする", () => {
    expect(
      parseSpeakerLine(
        "議長（世門 光君） おはようございます。ただいまの出席議員は26人であります。",
      ),
    ).toEqual({
      speakerName: "世門光",
      speakerRole: "議長",
      content: "おはようございます。ただいまの出席議員は26人であります。",
    });
  });

  it("氏名 + 役職形式をパースする", () => {
    expect(
      parseSpeakerLine("奥 輝人 議長 日程に入ります。日程第1，会議録署名議員の指名を行います。"),
    ).toEqual({
      speakerName: "奥輝人",
      speakerRole: "議長",
      content: "日程に入ります。日程第1，会議録署名議員の指名を行います。",
    });
  });

  it("議員（席次）形式をパースする", () => {
    expect(
      parseSpeakerLine(
        "川口幸義 議員（22番） おはようございます。ちょっと字句の訂正をお願いしたいと思います。",
      ),
    ).toEqual({
      speakerName: "川口幸義",
      speakerRole: "議員",
      content: "おはようございます。ちょっと字句の訂正をお願いしたいと思います。",
    });
  });

  it("出席者一覧の行は発言者として誤検知しない", () => {
    expect(parseSpeakerLine("○ 出席議員は，次のとおりである。")).toBeNull();
    expect(
      parseSpeakerLine(
        "向井渉 議会事務局長 押川治 議会事務局次長兼調査係長事務取扱 田川正盛 議事係長",
      ),
    ).toBeNull();
  });
});

describe("extractHeldOn", () => {
  it("和暦日付を抽出する", () => {
    const text = "○令和７年２月13日 奄美市議会第１回定例会を招集した。";
    expect(extractHeldOn(text, "令和7年第1回定例会")).toBe("2025-02-13");
  });

  it("タイトル年と月日から開催日を補完する", () => {
    const text = "2月13日（第1日目）";
    expect(extractHeldOn(text, "令和7年第1回定例会")).toBe("2025-02-13");
  });
});

describe("parseStatements", () => {
  it("単独の ○ 区切り線と複数話者を正しく抽出する", () => {
    const text = `
      向井 渉 議会事務局長
      ──────────── ○ ────────────
      奥 輝人 議長 おはようございます。ただいまの出席議員は20人であります。
      会議は成立いたしました。
      ──────────── ○ ────────────
      安田壮平 市長 おはようございます。ただいま上程されました議案について御説明いたします。
      ──────────── ○ ────────────
      川口幸義 議員（22番） おはようございます。
      それでは，質問いたします。
      （「なし」と呼ぶ者あり）
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]?.speakerName).toBe("奥輝人");
    expect(statements[0]?.speakerRole).toBe("議長");
    expect(statements[0]?.kind).toBe("remark");
    expect(statements[0]?.content).toContain("会議は成立いたしました。");

    expect(statements[1]?.speakerName).toBe("安田壮平");
    expect(statements[1]?.speakerRole).toBe("市長");
    expect(statements[1]?.kind).toBe("answer");

    expect(statements[2]?.speakerName).toBe("川口幸義");
    expect(statements[2]?.speakerRole).toBe("議員");
    expect(statements[2]?.kind).toBe("question");
    expect(statements[2]?.content).toContain("それでは，質問いたします。");
  });
});
