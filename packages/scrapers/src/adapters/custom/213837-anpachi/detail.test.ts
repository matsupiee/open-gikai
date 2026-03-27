import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractCalledSpeaker,
  extractHeldOn,
  extractTitle,
  parseCueName,
  parseSpeakerBlock,
  parseStatements,
} from "./detail";

describe("parseSpeakerBlock", () => {
  it("議長の発言ブロックを解析する", () => {
    const result = parseSpeakerBlock("議 長 おはようございます。");

    expect(result).not.toBeNull();
    expect(result?.speakerRole).toBe("議長");
    expect(result?.content).toBe("おはようございます。");
  });

  it("課長の発言ブロックを解析する", () => {
    const result = parseSpeakerBlock(
      "総務課長 西松幸子議員の１点目の御質問に回答させていただきます。",
    );

    expect(result).not.toBeNull();
    expect(result?.speakerRole).toBe("総務課長");
    expect(result?.content).toBe(
      "西松幸子議員の1点目の御質問に回答させていただきます。",
    );
  });

  it("番号付き議員の発言ブロックを解析する", () => {
    const result = parseSpeakerBlock(
      "９ 番 町長、どうもありがとうございました。",
    );

    expect(result).not.toBeNull();
    expect(result?.speakerRole).toBe("議員");
    expect(result?.content).toBe("町長、どうもありがとうございました。");
  });
});

describe("parseCueName", () => {
  it("君付きの指名行から名前を抽出する", () => {
    expect(parseCueName("岡田立君。")).toBe("岡田立");
  });

  it("本文がある場合は null を返す", () => {
    expect(parseCueName("皆様、おはようございます。")).toBeNull();
  });
});

describe("extractCalledSpeaker", () => {
  it("議長発言末尾の役職付き呼び出しを抽出する", () => {
    const result = extractCalledSpeaker(
      "町長から発言の申出がありますので、これを許します。 町長 岡田立君。",
    );

    expect(result).toEqual({
      markerKey: "町長",
      name: "岡田立",
    });
  });

  it("議員名の呼び出しを抽出する", () => {
    const result = extractCalledSpeaker(
      "それでは引き続きまして、３番 西松幸子さん。",
    );

    expect(result).toEqual({
      markerKey: "3番",
      name: "西松幸子",
    });
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("総務課長は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("extractHeldOn", () => {
  it("開会日の和暦を抽出する", () => {
    const text =
      "令和６年３月 ４日 開会 令和６年３月１５日 閉会 令和６年第１回安八町議会定例会会議録";

    expect(extractHeldOn(text)).toBe("2024-03-04");
  });
});

describe("extractTitle", () => {
  it("PDF 冒頭から会議タイトルを抽出する", () => {
    const text =
      "岐 阜 県 安 八 町 議 会 令 和 ６ 年 第 １ 回 安 八 町 議 会 定 例 会 会 議 録";

    expect(extractTitle(text, "fallback")).toBe("令和6年第1回安八町議会定例会");
  });
});

describe("parseStatements", () => {
  it("役職話者と番号議員をまとめて抽出する", () => {
    const text = `
      令和６年３月４日 開会
      （開会時間 午前10時00分）
      議 長 おはようございます。 ただいまより、令和６年第１回安八町議会定例会を開催いたします。
      ────────────────────────────────────────────
      議 長 町長から発言の申出がありますので、これを許します。 町長 岡田立君。
      町 長 皆様、おはようございます。 本日、令和６年第１回安八町議会定例会を招集しましたところ、議員各位におかれましては誠にありがとうございます。
      ────────────────────────────────────────────
      議 長 総務課長 山田靖君。
      総務課長 西松幸子議員の１点目の御質問に回答させていただきます。
      ────────────────────────────────────────────
      議 長 岩田讓治君。
      ９ 番 町長、どうもありがとうございました。
    `;

    const result = parseStatements(text);

    expect(result).toHaveLength(5);

    expect(result[0]?.speakerRole).toBe("議長");
    expect(result[0]?.kind).toBe("remark");
    expect(result[0]?.content).toContain("令和6年第1回安八町議会定例会");

    expect(result[1]?.speakerRole).toBe("議長");
    expect(result[1]?.content).toBe("町長から発言の申出がありますので、これを許します。");

    expect(result[2]?.speakerRole).toBe("町長");
    expect(result[2]?.speakerName).toBe("岡田立");
    expect(result[2]?.kind).toBe("answer");

    expect(result[3]?.speakerRole).toBe("総務課長");
    expect(result[3]?.speakerName).toBe("山田靖");
    expect(result[3]?.kind).toBe("answer");

    expect(result[4]?.speakerRole).toBe("議員");
    expect(result[4]?.speakerName).toBe("岩田讓治");
    expect(result[4]?.kind).toBe("question");
  });

  it("ページ番号ノイズを除去して発言を連結する", () => {
    const text = `
      （開会時間 午前10時00分）
      町 長 皆様、おはようございます。 －４－ 本日もよろしくお願いいたします。
    `;

    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe(
      "皆様、おはようございます。 本日もよろしくお願いいたします。",
    );
  });

  it("議長発言中の番号言及を別発言として誤検出しない", () => {
    const text = `
      （開会時間 午前10時00分）
      議 長 日程第１、会議録署名者の決定について、私から指名させていただきます。 ５番 坂悟君、６番 渡邊裕光君を指名いたします。
    `;

    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]?.speakerRole).toBe("議長");
    expect(result[0]?.content).toContain("5番坂悟君、6番渡邊裕光君を指名いたします。");
  });
});
