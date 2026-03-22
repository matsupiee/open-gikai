import { describe, expect, test } from "vitest";
import {
  buildDetailUrl,
  buildSidebarUrl,
  buildDetailUrlWithHuid,
  extractDateFromContent,
  parseDateFromLabel,
  detectMeetingType,
  parseSpeakerHeader,
  classifyKind,
  cleanHtmlText,
  extractStatements,
  parseStatementText,
  parseSidebarHuids,
  extractStatementFromHuidPage,
} from "./detail";

describe("buildDetailUrl", () => {
  test("g08v_search.asp 形式から ACT=203 URL を構築", () => {
    const url = buildDetailUrl(
      "http://tsukuba.gijiroku.com/voices/g08v_search.asp",
      "2736"
    );
    expect(url).toBe(
      "https://tsukuba.gijiroku.com/voices/cgi/voiweb.exe?ACT=203&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FINO=2736&HATSUGENMODE=0&HYOUJIMODE=0&STYLE=0"
    );
  });

  test("サブディレクトリ付き URL", () => {
    const url = buildDetailUrl(
      "http://warabi.gijiroku.com/gikai/voices/g08v_search.asp",
      "100"
    );
    expect(url).toContain("/gikai/voices/cgi/voiweb.exe");
    expect(url).toContain("FINO=100");
  });

  test("voices/ を含まない gijiroku.com URL からも ACT=203 URL を構築", () => {
    const url = buildDetailUrl(
      "https://www13.gijiroku.com/kawasaki_council/g07v_search.asp?Sflg=2",
      "100"
    );
    expect(url).toContain("/kawasaki_council/cgi/voiweb.exe");
    expect(url).toContain("FINO=100");
  });

  test("ルートパスのみの URL は null", () => {
    expect(
      buildDetailUrl("http://example.com/", "100")
    ).toBeNull();
  });

  test("自前ホスト VOICES は HTTP を保持", () => {
    const url = buildDetailUrl(
      "http://info.city.chigasaki.kanagawa.jp/VOICES/g08v_search.asp",
      "2736"
    );
    expect(url).toMatch(/^http:\/\/info\.city\.chigasaki/);
    expect(url).toContain("/VOICES/cgi/voiweb.exe");
    expect(url).toContain("FINO=2736");
  });
});

describe("buildSidebarUrl", () => {
  test("ACT=202 の URL を構築", () => {
    const url = buildSidebarUrl(
      "http://tsukuba.gijiroku.com/voices/g08v_search.asp",
      "2770"
    );
    expect(url).toBe(
      "https://tsukuba.gijiroku.com/voices/cgi/voiweb.exe?ACT=202&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FINO=2770&HATSUGENMODE=0&HYOUJIMODE=0&STYLE=0"
    );
  });

  test("自前ホスト VOICES は HTTP を保持", () => {
    const url = buildSidebarUrl(
      "http://info.city.chigasaki.kanagawa.jp/VOICES/g08v_search.asp",
      "100"
    );
    expect(url).toMatch(/^http:\/\/info\.city\.chigasaki/);
    expect(url).toContain("ACT=202");
  });
});

describe("buildDetailUrlWithHuid", () => {
  test("HUID 付き ACT=203 URL を構築", () => {
    const url = buildDetailUrlWithHuid(
      "http://tsukuba.gijiroku.com/voices/g08v_search.asp",
      "2770",
      "338263"
    );
    expect(url).toContain("ACT=203");
    expect(url).toContain("HUID=338263");
    expect(url).toContain("FINO=2770");
  });

  test("自前ホスト VOICES は HTTP を保持", () => {
    const url = buildDetailUrlWithHuid(
      "http://info.city.chigasaki.kanagawa.jp/VOICES/g08v_search.asp",
      "100",
      "5000"
    );
    expect(url).toMatch(/^http:\/\/info\.city\.chigasaki/);
    expect(url).toContain("HUID=5000");
  });
});

describe("extractDateFromContent", () => {
  test("令和の日付を抽出", () => {
    const html = "令和６年12月５日　午前10時44分開会";
    expect(extractDateFromContent(html)).toBe("2024-12-05");
  });

  test("全角数字を含む日付", () => {
    const html = "令和　５年　３月１５日　開会";
    expect(extractDateFromContent(html)).toBe("2023-03-15");
  });

  test("平成の日付", () => {
    const html = "平成30年6月20日　開会";
    expect(extractDateFromContent(html)).toBe("2018-06-20");
  });

  test("日付がない場合は null", () => {
    expect(extractDateFromContent("テキストのみ")).toBeNull();
  });
});

describe("parseDateFromLabel", () => {
  test("タイトルから和暦年を取得して日付を構築", () => {
    expect(
      parseDateFromLabel(
        "12月05日-01号",
        "令和 7年第6回12月定例会,12月05日-01号"
      )
    ).toBe("2025-12-05");
  });

  test("HTML から和暦年を取得して日付を構築", () => {
    expect(
      parseDateFromLabel(
        "12月05日-01号",
        "令和　７年第　６回１２月定例会"
      )
    ).toBe("2025-12-05");
  });

  test("yearSource なしの場合は null", () => {
    expect(parseDateFromLabel("12月05日-01号")).toBeNull();
  });

  test("yearSource に和暦がない場合は null", () => {
    expect(parseDateFromLabel("12月05日-01号", "定例会")).toBeNull();
  });

  test("dateLabel に月日がない場合は null", () => {
    expect(parseDateFromLabel("目次", "令和7年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  test("委員会を含むタイトルは committee", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  test("臨時会を含むタイトルは extraordinary", () => {
    expect(detectMeetingType("令和６年臨時会")).toBe("extraordinary");
  });

  test("その他は plenary", () => {
    expect(detectMeetingType("令和６年第２回定例会")).toBe("plenary");
  });
});

describe("parseSpeakerHeader", () => {
  // 形式A（本会議）: ◎/○ + 役職（氏名君）
  test("◎役職（氏名君）形式", () => {
    const result = parseSpeakerHeader("◎議会局長（川崎誠君）");
    expect(result.prefix).toBe("◎");
    expect(result.speakerRole).toBe("議会局長");
    expect(result.speakerName).toBe("川崎誠");
  });

  test("○役職（氏名君）形式", () => {
    const result = parseSpeakerHeader("○臨時議長（酒井泉君）");
    expect(result.prefix).toBe("○");
    expect(result.speakerRole).toBe("臨時議長");
    expect(result.speakerName).toBe("酒井泉");
  });

  test("議席番号形式", () => {
    const result = parseSpeakerHeader("○17番（山中真弓君）");
    expect(result.speakerRole).toBe("17番");
    expect(result.speakerName).toBe("山中真弓");
  });

  test("敬称を除去", () => {
    const result = parseSpeakerHeader("◎市長（田中太郎さん）");
    expect(result.speakerName).toBe("田中太郎");
  });

  test("氏名内のスペースを除去", () => {
    const result = parseSpeakerHeader("◎市長（五十嵐　立　青君）");
    expect(result.speakerName).toBe("五十嵐立青");
  });

  test("括弧なし（役職のみ）", () => {
    const result = parseSpeakerHeader("○議長");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBeNull();
  });

  // 形式B（委員会）: ◎/○/◆ + 氏名　役職
  test("◎氏名　役職 形式（委員会）", () => {
    const result = parseSpeakerHeader("◎中山　都市計画課長");
    expect(result.prefix).toBe("◎");
    expect(result.speakerName).toBe("中山");
    expect(result.speakerRole).toBe("都市計画課長");
  });

  test("○氏名　役職 形式（委員会委員長）", () => {
    const result = parseSpeakerHeader("○高野　分科会委員長");
    expect(result.prefix).toBe("○");
    expect(result.speakerName).toBe("高野");
    expect(result.speakerRole).toBe("分科会委員長");
  });

  test("◆氏名　役職 形式（委員会委員）", () => {
    const result = parseSpeakerHeader("◆川田青星　分科会委員");
    expect(result.prefix).toBe("◆");
    expect(result.speakerName).toBe("川田青星");
    expect(result.speakerRole).toBe("分科会委員");
  });

  test("マッチしない場合", () => {
    const result = parseSpeakerHeader("テキスト");
    expect(result.speakerRole).toBeNull();
    expect(result.speakerName).toBeNull();
    expect(result.prefix).toBeNull();
  });
});

describe("classifyKind", () => {
  test("◎ マークは answer", () => {
    expect(classifyKind("議会局長", "◎")).toBe("answer");
    expect(classifyKind("市長", "◎")).toBe("answer");
  });

  test("◆ マークは question", () => {
    expect(classifyKind("分科会委員", "◆")).toBe("question");
  });

  test("議員は question", () => {
    expect(classifyKind("議員", "○")).toBe("question");
  });

  test("議席番号は question", () => {
    expect(classifyKind("17番", "○")).toBe("question");
  });

  test("全角議席番号は question", () => {
    expect(classifyKind("１７番", "○")).toBe("question");
  });

  test("議長は remark", () => {
    expect(classifyKind("議長", "○")).toBe("remark");
    expect(classifyKind("臨時議長", "○")).toBe("remark");
  });

  test("委員長は remark", () => {
    expect(classifyKind("総務委員長", "○")).toBe("remark");
    expect(classifyKind("分科会委員長", "○")).toBe("remark");
  });

  test("null は remark", () => {
    expect(classifyKind(null, null)).toBe("remark");
  });
});

describe("cleanHtmlText", () => {
  test("BR タグを改行に変換", () => {
    expect(cleanHtmlText("行1<BR>行2")).toBe("行1\n行2");
    expect(cleanHtmlText("行1<BR/>行2")).toBe("行1\n行2");
    expect(cleanHtmlText("行1<br />行2")).toBe("行1\n行2");
  });

  test("P タグを改行に変換", () => {
    expect(cleanHtmlText("段落1<P>段落2")).toBe("段落1\n段落2");
  });

  test("HTML タグを除去", () => {
    expect(cleanHtmlText("<B>太字</B>")).toBe("太字");
  });

  test("HTML エンティティをデコード", () => {
    expect(cleanHtmlText("&amp; &lt; &gt; &quot; &nbsp;")).toBe('& < > "');
  });

  test("連続改行を圧縮", () => {
    expect(cleanHtmlText("行1\n\n\n\n行2")).toBe("行1\n\n行2");
  });
});

describe("parseStatementText", () => {
  test("◎ マーク付き発言を解析（本会議形式）", () => {
    const result = parseStatementText(
      "◎議会局長（川崎誠君）　おはようございます。"
    );
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe("◎");
    expect(result!.speakerRole).toBe("議会局長");
    expect(result!.speakerName).toBe("川崎誠");
    expect(result!.content).toBe("おはようございます。");
  });

  test("○ マーク付き発言を解析（本会議形式）", () => {
    const result = parseStatementText(
      "○臨時議長（酒井泉君）　ただいまから会議を開きます。"
    );
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe("○");
    expect(result!.speakerRole).toBe("臨時議長");
    expect(result!.content).toBe("ただいまから会議を開きます。");
  });

  test("◆ マーク付き発言を解析（委員会形式）", () => {
    const result = parseStatementText(
      "◆川田青星　分科会委員　　質問があります。"
    );
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe("◆");
    expect(result!.speakerName).toBe("川田青星");
    expect(result!.speakerRole).toBe("分科会委員");
    expect(result!.content).toBe("質問があります。");
  });

  test("マークなしの場合は null", () => {
    expect(parseStatementText("普通のテキスト")).toBeNull();
  });

  test("本文がない場合は null", () => {
    expect(parseStatementText("◎議長（田中太郎君）")).toBeNull();
  });
});

describe("extractStatements", () => {
  test("HUID アンカーで区切られた発言を抽出", () => {
    const html = `
      <BODY>
      <A NAME="HUID100"></A>令和　６年定例会<BR><BR>出席議員<BR>
      <A NAME="HUID101"></A>◎議会局長（川崎誠君）　おはようございます。<BR>
      <A NAME="HUID102"></A>○議長（酒井泉君）　ただいまから会議を開きます。<BR>
      <A NAME="HUID103"></A>△開会の宣告<BR>
      <A NAME="HUID104"></A>○17番（山中真弓君）　質問があります。<BR>
      </BODY>
    `;
    const stmts = extractStatements(html);
    // 最初のセグメント（名簿）と△（議題）はスキップ
    expect(stmts).toHaveLength(3);

    expect(stmts[0]!.speakerRole).toBe("議会局長");
    expect(stmts[0]!.speakerName).toBe("川崎誠");
    expect(stmts[0]!.kind).toBe("answer");
    expect(stmts[0]!.content).toBe("おはようございます。");

    expect(stmts[1]!.speakerRole).toBe("議長");
    expect(stmts[1]!.kind).toBe("remark");
    expect(stmts[1]!.content).toBe("ただいまから会議を開きます。");

    expect(stmts[2]!.speakerRole).toBe("17番");
    expect(stmts[2]!.speakerName).toBe("山中真弓");
    expect(stmts[2]!.kind).toBe("question");
    expect(stmts[2]!.content).toBe("質問があります。");
  });

  test("空のセグメントはスキップ", () => {
    const html = `
      <A NAME="HUID100"></A>
      <A NAME="HUID101"></A>◎市長（田中太郎君）　答弁します。<BR>
    `;
    const stmts = extractStatements(html);
    expect(stmts).toHaveLength(1);
  });

  test("(名簿) (議題) はスキップ", () => {
    const html = `
      <A NAME="HUID100"></A>(名簿)<BR>
      <A NAME="HUID101"></A>（議題）<BR>
      <A NAME="HUID102"></A>◎市長（田中太郎君）　発言します。<BR>
    `;
    const stmts = extractStatements(html);
    expect(stmts).toHaveLength(1);
  });

  test("offset が正しく計算される", () => {
    const html = `
      <A NAME="HUID100"></A>◎市長（A君）　あいう<BR>
      <A NAME="HUID101"></A>○議員（B君）　えお<BR>
    `;
    const stmts = extractStatements(html);
    expect(stmts[0]!.startOffset).toBe(0);
    expect(stmts[0]!.endOffset).toBe(3);
    expect(stmts[1]!.startOffset).toBe(4);
    expect(stmts[1]!.endOffset).toBe(6);
  });

  test("contentHash が生成される", () => {
    const html = `
      <A NAME="HUID100"></A>◎市長（A君）　テスト<BR>
    `;
    const stmts = extractStatements(html);
    expect(stmts[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseSidebarHuids", () => {
  test("サイドバー HTML から HUID を抽出", () => {
    const html = `
      <A NAME="338262"></A><TABLE><TR><TD><B>(名簿)</B></TD></TR></TABLE>
      <A NAME="338263"></A><TABLE><TR><TD><B>分科会委員長(高野)</B></TD></TR></TABLE>
      <A NAME="338264"></A><TABLE><TR><TD><B>分科会委員長(高野)</B></TD></TR></TABLE>
      <A NAME="338267"></A><TABLE><TR><TD><B>分科会委員(川田青星)</B></TD></TR></TABLE>
      <A NAME="338269"></A><TABLE><TR><TD><B>都市計画課長(中山)</B></TD></TR></TABLE>
    `;
    const huids = parseSidebarHuids(html);
    // (名簿) はスキップされる
    expect(huids).toEqual(["338263", "338264", "338267", "338269"]);
  });

  test("△ エントリはスキップ", () => {
    const html = `
      <A NAME="100"></A><TABLE><TR><TD><B>△議題</B></TD></TR></TABLE>
      <A NAME="101"></A><TABLE><TR><TD><B>議長(田中)</B></TD></TR></TABLE>
    `;
    const huids = parseSidebarHuids(html);
    expect(huids).toEqual(["101"]);
  });

  test("空の HTML は空配列", () => {
    expect(parseSidebarHuids("")).toEqual([]);
  });
});

describe("extractStatementFromHuidPage", () => {
  test("本会議形式の発言を抽出", () => {
    const html = `
      <BODY>
      <A NAME="HUID335022"></A>◎議会局長（川崎誠君）　おはようございます。<BR>　一般選挙後、最初の議会です。<BR>
      <P><FORM METHOD="POST"><INPUT TYPE="hidden"></FORM>
      <SCRIPT>...</SCRIPT>
      </BODY>
    `;
    const result = extractStatementFromHuidPage(html);
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe("◎");
    expect(result!.speakerRole).toBe("議会局長");
    expect(result!.speakerName).toBe("川崎誠");
    expect(result!.content).toBe(
      "おはようございます。\n　一般選挙後、最初の議会です。"
    );
  });

  test("委員会形式の発言を抽出", () => {
    const html = `
      <BODY>
      <A NAME="HUID338263"></A>○高野　分科会委員長　　本日は委員会を招集しました。<BR>
      <P><FORM METHOD="POST"></FORM>
      </BODY>
    `;
    const result = extractStatementFromHuidPage(html);
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe("○");
    expect(result!.speakerName).toBe("高野");
    expect(result!.speakerRole).toBe("分科会委員長");
    expect(result!.content).toBe("本日は委員会を招集しました。");
  });

  test("◆ マーク（委員質問者）の発言を抽出", () => {
    const html = `
      <BODY>
      <A NAME="HUID338267"></A>◆川田青星　分科会委員　　質問があります。<BR>
      <FORM></FORM>
      </BODY>
    `;
    const result = extractStatementFromHuidPage(html);
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe("◆");
    expect(result!.speakerName).toBe("川田青星");
    expect(result!.speakerRole).toBe("分科会委員");
  });

  test("HUID アンカーがない場合は null", () => {
    expect(extractStatementFromHuidPage("<BODY>テキスト</BODY>")).toBeNull();
  });

  test("△ 議題区切りは null", () => {
    const html = `<A NAME="HUID100"></A>△開会の宣告<BR>`;
    expect(extractStatementFromHuidPage(html)).toBeNull();
  });
});
