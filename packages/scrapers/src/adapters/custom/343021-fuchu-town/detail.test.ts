import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHeldOn,
  normalizeSpacedText,
} from "./detail";

describe("normalizeSpacedText", () => {
  it("文字間のスペースを除去する", () => {
    expect(normalizeSpacedText("○ 議 長 （ 力 山 彰 君 ）")).toBe("○議長（力山彰君）");
  });

  it("複数スペースは残す", () => {
    expect(normalizeSpacedText("あ い う  え お")).toBe("あいう  えお");
  });

  it("スペースなしのテキストはそのまま返す", () => {
    expect(normalizeSpacedText("テスト")).toBe("テスト");
  });
});

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（力山彰君） それでは、ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("力山彰");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（寺尾光司君） お答えいたします。"
    );
    expect(result.speakerName).toBe("寺尾光司");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１０番（西山優君） 質問いたします。"
    );
    expect(result.speakerName).toBe("西山優");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（新田憲章君） お答えいたします。"
    );
    expect(result.speakerName).toBe("新田憲章");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副議長（森本将文君） 休憩前に引き続き会議を開きます。"
    );
    expect(result.speakerName).toBe("森本将文");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩前に引き続き会議を開きます。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○福祉保健部長（中本孝弘君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("中本孝弘");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（寺尾　光司君）　答弁します。"
    );
    expect(result.speakerName).toBe("寺尾光司");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
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

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する（スペース区切りテキスト）", () => {
    const text =
      "○ 議 長 （ 力 山 彰 君 ） た だ い ま か ら 本 日 の 会 議 を 開 き ま す 。 " +
      "○ １ ０ 番 （ 西 山 優 君 ） 質 問 が あ り ま す 。 " +
      "○ 町 長 （ 寺 尾 光 司 君 ） お 答 え し ま す 。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("力山彰");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("西山優");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("寺尾光司");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("スペースなしのテキストでも動作する", () => {
    const text = "○議長（力山彰君）　ただいまから会議を開きます。○町長（寺尾光司君）　お答えします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○ 議 長 （ 力 山 彰 君 ） テ ス ト 発 言 。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("区切り線 ○～～～ はスキップする", () => {
    const text =
      "○ 議 長 （ 力 山 彰 君 ） た だ い ま 。 " +
      "○ ～ ～ ～ ～ ～ ～ ～ ～ ～ " +
      "○ 町 長 （ 寺 尾 光 司 君 ） お 答 え 。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("extractHeldOn", () => {
  it("スペース区切りの開会年月日パターンから日付を抽出する", () => {
    const text =
      "１ ． 開 会 年 月 日 令 和 ７ 年 １ ２ 月 １ ２ 日 （ 金 ）";

    expect(extractHeldOn(text)).toBe("2025-12-12");
  });

  it("スペースなしの開会年月日パターンから日付を抽出する", () => {
    const text = "１．開会年月日 令和７年１２月１２日（金）";

    expect(extractHeldOn(text)).toBe("2025-12-12");
  });

  it("フォールバックで先頭付近の日付を抽出する", () => {
    const text = "令 和 ７ 年 第 ５ 回 府 中 町 議 会 定 例 会 令 和 ７ 年 １ ２ 月 １ ２ 日";

    expect(extractHeldOn(text)).toBe("2025-12-12");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOn("テキストのみ")).toBeNull();
  });
});
