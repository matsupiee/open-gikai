import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseHtmlStatements,
  parseDateFromHtml,
  parseTitleFromHtml,
  parsePdfStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長(氏名君)パターンをパースする", () => {
    const result = parseSpeaker("〇<b>議長(福嶋尚人君)</b>　おはようございます。");
    expect(result.speakerName).toBe("福嶋尚人");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("町長(氏名君)パターンをパースする", () => {
    const result = parseSpeaker("〇<b>町長(大野克之君)</b>　お手元に配付されております。");
    expect(result.speakerName).toBe("大野克之");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お手元に配付されております。");
  });

  it("全角番号の議員パターンをパースする", () => {
    const result = parseSpeaker("〇<b>２番(池田一也君)</b>　通告に従い、質問をさせていただきます。");
    expect(result.speakerName).toBe("池田一也");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("通告に従い、質問をさせていただきます。");
  });

  it("半角番号の議員パターンをパースする", () => {
    const result = parseSpeaker("〇<b>13番(川端克美君)</b>　私は、令和５年度の...");
    expect(result.speakerName).toBe("川端克美");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("私は、令和５年度の...");
  });

  it("教育長パターンをパースする", () => {
    const result = parseSpeaker("〇<b>教育長(久保田達也君)</b>　教育行政報告を申し上げます。");
    expect(result.speakerName).toBe("久保田達也");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("教育行政報告を申し上げます。");
  });

  it("企業会計決算審査特別委員長パターンをパースする", () => {
    const result = parseSpeaker("〇<b>企業会計決算審査特別委員長(池田一也君)</b>　報告をさせていただきます。");
    expect(result.speakerName).toBe("池田一也");
    expect(result.speakerRole).toBe("企業会計決算審査特別委員長");
    expect(result.content).toBe("報告をさせていただきます。");
  });

  it("地域包括支援センター長補佐パターンをパースする", () => {
    const result = parseSpeaker("〇<b>地域包括支援センター長補佐(戸子台弘一君)</b>　お答えいたします。");
    expect(result.speakerName).toBe("戸子台弘一");
    expect(result.speakerRole).toBe("地域包括支援センター長補佐");
    expect(result.content).toBe("お答えいたします。");
  });

  it("地域包括支援センター長パターンをパースする（補佐より優先しない）", () => {
    const result = parseSpeaker("〇<b>地域包括支援センター長(及川啓明君)</b>　御答弁いたします。");
    expect(result.speakerName).toBe("及川啓明");
    expect(result.speakerRole).toBe("地域包括支援センター長");
    expect(result.content).toBe("御答弁いたします。");
  });

  it("PDF テキスト形式（全角カッコ）をパースする", () => {
    const result = parseSpeaker("〇議長（福嶋尚人）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("福嶋尚人");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
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

  it("地域包括支援センター長は answer", () => {
    expect(classifyKind("地域包括支援センター長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseHtmlStatements", () => {
  it("pre タグ内の発言を抽出する", () => {
    const html = `
<html><body>
<pre>
令和６年第７回新ひだか町議会定例会会議録

令和６年１２月１０日(火)　午前９時３０分開会

◎<b>開会の宣告</b>

〇<b>議長(福嶋尚人君)</b>　おはようございます。ただいまから会議を開きます。

〇<b>２番(池田一也君)</b>　通告に従い、質問をさせていただきます。

〇<b>町長(大野克之君)</b>　お答えします。
</pre>
</body></html>
    `;

    const statements = parseHtmlStatements(html);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("福嶋尚人");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("おはようございます。ただいまから会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("池田一也");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("大野克之");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const html = `<pre>〇<b>議長(福嶋尚人君)</b>　テスト発言。</pre>`;
    const statements = parseHtmlStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("pre タグがない場合は空配列を返す", () => {
    const html = `<html><body>テキストなし</body></html>`;
    expect(parseHtmlStatements(html)).toEqual([]);
  });

  it("発言がない場合は空配列を返す", () => {
    const html = `<pre>◎<b>開会の宣告</b>\n議事日程のみ</pre>`;
    expect(parseHtmlStatements(html)).toEqual([]);
  });
});

describe("parseDateFromHtml", () => {
  it("令和6年の開催日をパースする", () => {
    const html = `
<pre>
令和６年第７回新ひだか町議会定例会会議録

令和６年１２月１０日(火)　午前９時３０分開会
</pre>
    `;
    expect(parseDateFromHtml(html)).toBe("2024-12-10");
  });

  it("令和元年の開催日をパースする", () => {
    const html = `<pre>令和元年12月10日(火)　開会</pre>`;
    expect(parseDateFromHtml(html)).toBe("2019-12-10");
  });

  it("日付がない場合は null を返す", () => {
    const html = `<pre>テキストのみ</pre>`;
    expect(parseDateFromHtml(html)).toBeNull();
  });

  it("pre タグがなくても HTML 全体から日付を抽出する", () => {
    const html = `<html><body>令和6年12月10日</body></html>`;
    expect(parseDateFromHtml(html)).toBe("2024-12-10");
  });
});

describe("parseTitleFromHtml", () => {
  it("定例会タイトルを抽出する", () => {
    const html = `<pre>令和６年第７回新ひだか町議会定例会会議録</pre>`;
    expect(parseTitleFromHtml(html)).toBe("令和６年第７回新ひだか町議会定例会会議録");
  });

  it("臨時会タイトルを抽出する", () => {
    const html = `<pre>令和６年第６回新ひだか町議会臨時会会議録</pre>`;
    expect(parseTitleFromHtml(html)).toBe("令和６年第６回新ひだか町議会臨時会会議録");
  });

  it("タイトルがない場合は null を返す", () => {
    const html = `<pre>会議録テキスト</pre>`;
    expect(parseTitleFromHtml(html)).toBeNull();
  });
});

describe("parsePdfStatements", () => {
  it("〇マーカーで分割して発言を抽出する", () => {
    const text = `
〇議長（福嶋尚人）　ただいまから本日の会議を開きます。
〇２番（池田一也）　質問があります。
〇町長（大野克之）　お答えします。
`;
    const statements = parsePdfStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("福嶋尚人");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = `〇議長（福嶋尚人）　テスト発言。`;
    const statements = parsePdfStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parsePdfStatements("")).toEqual([]);
  });
});
