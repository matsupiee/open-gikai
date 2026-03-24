import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildContentUrl,
  classifyKind,
  extractHeldOn,
  htmlToText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("buildContentUrl", () => {
  it("FINO から ACT=203 の URL を構築する", () => {
    expect(buildContentUrl(973)).toBe(
      "https://www.city.yatsushiro.kumamoto.jp/VOICES/CGI/voiweb.exe?ACT=203&FINO=973&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,2&HATSUGENMODE=1&HYOUJIMODE=0&STYLE=0",
    );
  });
});

describe("htmlToText", () => {
  it("<BR> タグを改行に変換する", () => {
    const html = "行1<BR>行2<BR/>行3";
    expect(htmlToText(html)).toBe("行1\n行2\n行3");
  });

  it("HTMLタグを除去する", () => {
    const html = "<B>太字</B>テキスト";
    expect(htmlToText(html)).toBe("太字テキスト");
  });

  it("&nbsp; を全角スペースに変換する", () => {
    const html = "テキスト&nbsp;テキスト";
    expect(htmlToText(html)).toContain("\u3000");
  });
});

describe("extractHeldOn", () => {
  it("令和の開催日を抽出する（全角数字）", () => {
    const html =
      "令和　７年　９月定例会<BR>・令和７年１０月３日（金曜日）<BR>午前１０時０分開議";
    expect(extractHeldOn(html)).toBe("2025-10-03");
  });

  it("令和の開催日を抽出する（半角数字）", () => {
    const html = "・令和7年10月3日（金曜日） 午前10時開議";
    expect(extractHeldOn(html)).toBe("2025-10-03");
  });

  it("令和元年に対応する", () => {
    const html = "・令和元年６月５日（水曜日）";
    expect(extractHeldOn(html)).toBe("2019-06-05");
  });

  it("平成の開催日を抽出する", () => {
    const html = "・平成17年3月11日（金曜日）";
    expect(extractHeldOn(html)).toBe("2005-03-11");
  });

  it("昭和の開催日を抽出する", () => {
    const html = "・昭和62年3月11日（水曜日）";
    expect(extractHeldOn(html)).toBe("1987-03-11");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOn("<p>日付なし</p>")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("○議長（氏名君）の発言を抽出する", () => {
    const result = parseSpeaker("○議長（高山正夫君）　これより開会いたします。");
    expect(result.speakerName).toBe("高山正夫");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("これより開会いたします。");
  });

  it("◎副市長（氏名君）の発言を抽出する", () => {
    const result = parseSpeaker("◎副市長（平井宏英君）　お許しをいただきましたので...");
    expect(result.speakerName).toBe("平井宏英");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("お許しをいただきましたので...");
  });

  it("◎市長（氏名君）の発言を抽出する", () => {
    const result = parseSpeaker("◎市長（小野泰輔君）　お答えいたします。");
    expect(result.speakerName).toBe("小野泰輔");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("◆氏名君の発言を抽出する（役職なし議員）", () => {
    const result = parseSpeaker("◆木村博幸君　皆様、こんにちは。");
    expect(result.speakerName).toBe("木村博幸");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("皆様、こんにちは。");
  });

  it("複合役職（理事兼水道局長）を局長として抽出する", () => {
    const result = parseSpeaker("◎理事兼水道局長（吉永哲也君）　お答えいたします。");
    expect(result.speakerName).toBe("吉永哲也");
    expect(result.speakerRole).toBe("局長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副議長の発言を抽出する", () => {
    const result = parseSpeaker("○副議長（田中次郎君）　休憩します。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩します。");
  });

  it("氏名内のスペースを除去する", () => {
    const result = parseSpeaker("◎市長（小野　泰輔君）　お答えします。");
    expect(result.speakerName).toBe("小野泰輔");
    expect(result.speakerRole).toBe("市長");
  });

  it("教育長の発言を抽出する", () => {
    const result = parseSpeaker("◎教育長（山下修君）　お答えします。");
    expect(result.speakerName).toBe("山下修");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark を返す", () => {
    expect(classifyKind("議長", "○")).toBe("remark");
  });

  it("副議長は remark を返す", () => {
    expect(classifyKind("副議長", "○")).toBe("remark");
  });

  it("委員長は remark を返す", () => {
    expect(classifyKind("委員長", "○")).toBe("remark");
  });

  it("副委員長は remark を返す", () => {
    expect(classifyKind("副委員長", "○")).toBe("remark");
  });

  it("市長は answer を返す", () => {
    expect(classifyKind("市長", "◎")).toBe("answer");
  });

  it("副市長は answer を返す", () => {
    expect(classifyKind("副市長", "◎")).toBe("answer");
  });

  it("教育長は answer を返す", () => {
    expect(classifyKind("教育長", "◎")).toBe("answer");
  });

  it("課長は answer を返す", () => {
    expect(classifyKind("課長", "◎")).toBe("answer");
  });

  it("局長は answer を返す", () => {
    expect(classifyKind("局長", "◎")).toBe("answer");
  });

  it("議員は question を返す", () => {
    expect(classifyKind("議員", "◆")).toBe("question");
  });

  it("null で ◆ マーカーは question を返す", () => {
    expect(classifyKind(null, "◆")).toBe("question");
  });

  it("null で ◎ マーカーは answer を返す", () => {
    expect(classifyKind(null, "◎")).toBe("answer");
  });

  it("null で ○ マーカーは remark を返す", () => {
    expect(classifyKind(null, "○")).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("HUID ブロックを分割して発言を抽出する", () => {
    const html = [
      '<A NAME="HUID1"></A>',
      '○議長（高山正夫君）　これより令和７年９月定例会を開会いたします。',
      '<A NAME="HUID2"></A>',
      '◆木村博幸君　皆様、こんにちは。一般質問を行います。',
      '<A NAME="HUID3"></A>',
      '◎市長（小野泰輔君）　お答えいたします。',
    ].join("\n");

    const result = parseStatements(html);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("高山正夫");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("これより令和７年９月定例会を開会いたします。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("これより令和７年９月定例会を開会いたします。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("木村博幸");
    expect(result[1]!.speakerRole).toBe("議員");
    expect(result[1]!.content).toBe("皆様、こんにちは。一般質問を行います。");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("小野泰輔");
    expect(result[2]!.speakerRole).toBe("市長");
    expect(result[2]!.content).toBe("お答えいたします。");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const html = [
      '<A NAME="HUID1"></A>',
      "○議長（高山正夫君）　発言を許します。",
      "○（木村博幸議員登壇）",
      "◆木村博幸君　質問いたします。",
    ].join("\n");

    const result = parseStatements(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("議員");
  });

  it("マーカーのないテキストのみの場合は空配列を返す", () => {
    const html = "<A NAME=\"HUID1\"></A>\n議事日程テキスト\n説明文";
    expect(parseStatements(html)).toHaveLength(0);
  });

  it("startOffset と endOffset が連続する", () => {
    const html = [
      '<A NAME="HUID1"></A>',
      "○議長（高山正夫君）　開会します。",
      '<A NAME="HUID2"></A>',
      "◎市長（小野泰輔君）　答弁します。",
    ].join("\n");

    const result = parseStatements(html);

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });
});
