import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseMeetingDateFromText } from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名 君）を解析する（1文字スペース区切り）", () => {
    const result = parseSpeaker("議 長（ 松 浦 隆 起 君 ） お は よ う ご ざ い ま す 。");
    expect(result.speakerName).toBe("松浦隆起");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toContain("おはようございます");
  });

  it("番号議員（氏名 君）を解析する（全角スペース入り）", () => {
    const result = parseSpeaker("５　番（ 橋 元 陽 一 君 ） 一 般 質 問 を さ せ て い た だ き ま す 。");
    expect(result.speakerName).toBe("橋元陽一");
    expect(result.speakerRole).toBe("議員");
  });

  it("町長（氏名 君）を解析する", () => {
    const result = parseSpeaker("町 長（ 戸 梶 真 弓 君 ） お 答 え い た し ま す 。");
    expect(result.speakerName).toBe("戸梶真弓");
    expect(result.speakerRole).toBe("町長");
  });

  it("副町長（氏名 君）を解析する", () => {
    const result = parseSpeaker("副町長（ 田 中 一 郎 君 ） ご 説 明 い た し ま す 。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副町長");
  });

  it("課長（氏名 君）を解析する", () => {
    const result = parseSpeaker("総務課長（ 山 脇 浩 二 君 ） お は よ う ご ざ い ま す 。");
    expect(result.speakerName).toBe("山脇浩二");
    expect(result.speakerRole).toBe("課長");
  });

  it("教育長（氏名 君）を解析する", () => {
    const result = parseSpeaker("教育長（ 佐 藤 次 郎 君 ） 答 弁 い た し ま す 。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("教育長");
  });

  it("副議長を解析する", () => {
    const result = parseSpeaker("副議長（ 田 中 花 子 君 ） ご 報 告 し ま す 。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("副議長");
  });

  it("副委員長が委員長より優先される", () => {
    const result = parseSpeaker("副委員長（ 佐 藤 一 郎 君 ） ご 説 明 し ま す 。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("事務局長を解析する", () => {
    const result = parseSpeaker("事務局長（ 鈴 木 太 郎 君 ） 点 呼 を 行 い ま す 。");
    expect(result.speakerName).toBe("鈴木太郎");
    expect(result.speakerRole).toBe("事務局長");
  });

  it("番号議員の全角数字を正規化する", () => {
    const result = parseSpeaker("１ 番（ 山 田 花 子 君 ） 質 問 が あ り ま す 。");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("山田花子");
  });

  it("氏名中のスペースがすべて除去される", () => {
    const result = parseSpeaker("議 長（ 松 浦 隆 起 君 ） 発 言 し ま す 。");
    expect(result.speakerName).toBe("松浦隆起");
  });

  it("発言者が解析できない行", () => {
    const result = parseSpeaker("令和6年3月定例会 会議録");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
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

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("課長補佐は answer", () => {
    expect(classifyKind("課長補佐")).toBe("answer");
  });

  it("総務課長（課長で終わる）は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseMeetingDateFromText", () => {
  it("令和年月日をパースする（1文字スペース区切り・全角数字）", () => {
    const text = "令 和 ６ 年 ３ 月 １ 日 午 前 ９ 時";

    expect(parseMeetingDateFromText(text)).toBe("2024-03-01");
  });

  it("令和年月日をパースする（全角数字・スペースなし）", () => {
    const text = "令和６年３月１日午前９時宣告";

    expect(parseMeetingDateFromText(text)).toBe("2024-03-01");
  });

  it("平成年月日をパースする", () => {
    const text = "平成30年9月10日午前9時宣告";

    expect(parseMeetingDateFromText(text)).toBe("2018-09-10");
  });

  it("令和元年をパースする", () => {
    const text = "令和元年6月10日午前9時宣告";

    expect(parseMeetingDateFromText(text)).toBe("2019-06-10");
  });

  it("日付が見つからない場合は null を返す", () => {
    expect(parseMeetingDateFromText("会議録テキスト")).toBeNull();
  });
});

describe("parseStatements", () => {
  it("佐川町形式の発言を分割する（1文字スペース区切り）", () => {
    const text = [
      "議 長（ 松 浦 隆 起 君 ） た だ い ま か ら 会 議 を 開 き ま す 。",
      "５ 番（ 橋 元 陽 一 君 ） 一 般 質 問 を さ せ て い た だ き ま す 。",
      "総務課長（ 山 脇 浩 二 君 ） お 答 え い た し ま す 。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("松浦隆起");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("課長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "議 長（ 松 浦 隆 起 君 ） た だ い ま か ら 会 議 を 開 き ま す 。";

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("複数行にまたがる発言内容を結合する", () => {
    const text = [
      "議 長（ 松 浦 隆 起 君 ） た だ い ま か ら 会 議 を 開 き ま す 。",
      "出 席 者 を 確 認 し ま す 。",
      "５ 番（ 橋 元 陽 一 君 ） 質 問 し ま す 。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("出席者");
  });

  it("発言者のいないテキストのみの場合は空配列を返す", () => {
    const text = "令和6年3月定例会 会議録";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "議 長（ 松 浦 隆 起 君 ） た だ い ま 。",
      "１ 番（ 田 中 太 郎 君 ） 質 問 で す 。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    // content は正規化後の文字列長
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });
});
