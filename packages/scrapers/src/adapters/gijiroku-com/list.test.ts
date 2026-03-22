import { describe, expect, test } from "vitest";
import {
  buildListUrl,
  parseListHtml,
  extractTitleFromPreceding,
} from "./list";

describe("buildListUrl", () => {
  test("g08v_search.asp 形式の URL から CGI URL を構築", () => {
    const url = buildListUrl(
      "http://tsukuba.gijiroku.com/voices/g08v_search.asp",
      2024
    );
    expect(url).toBe(
      "https://tsukuba.gijiroku.com/voices/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("g07v_search.asp 形式の URL から CGI URL を構築", () => {
    const url = buildListUrl(
      "http://sapporo.gijiroku.com/voices/g07v_search.asp",
      2024
    );
    expect(url).toBe(
      "https://sapporo.gijiroku.com/voices/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("サブディレクトリ付き URL", () => {
    const url = buildListUrl(
      "http://warabi.gijiroku.com/gikai/voices/g08v_search.asp",
      2024
    );
    expect(url).toBe(
      "https://warabi.gijiroku.com/gikai/voices/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("HTTPS URL もそのまま処理", () => {
    const url = buildListUrl(
      "https://akitashigikai.gijiroku.com/voices/g07v_search.asp",
      2023
    );
    expect(url).toBe(
      "https://akitashigikai.gijiroku.com/voices/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2023&TYY=2023&KGTP=1,3"
    );
  });

  test("voices/ を含まない gijiroku.com URL からも CGI URL を構築", () => {
    const url = buildListUrl(
      "https://www13.gijiroku.com/kawasaki_council/g07v_search.asp?Sflg=2",
      2024
    );
    expect(url).toBe(
      "https://www13.gijiroku.com/kawasaki_council/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("末尾スラッシュのみの gijiroku.com URL からも CGI URL を構築", () => {
    const url = buildListUrl(
      "http://www06.gijiroku.com/niigata/",
      2024
    );
    expect(url).toBe(
      "https://www06.gijiroku.com/niigata/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("自前ホスト /voices/ パス（草加市）は HTTP を保持", () => {
    const url = buildListUrl(
      "http://www.soka-shigikai.jp/voices/g07v_search.asp",
      2024
    );
    expect(url).toBe(
      "http://www.soka-shigikai.jp/voices/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("自前ホスト /voices/ なし（大田区）は HTTP を保持", () => {
    const url = buildListUrl(
      "http://www.gikai-ota-tokyo.jp/ota/g08v_search.asp",
      2024
    );
    expect(url).toBe(
      "http://www.gikai-ota-tokyo.jp/ota/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("ルートパスのみの URL は null", () => {
    expect(buildListUrl("http://example.com/", 2024)).toBeNull();
  });

  test("不正な URL は null", () => {
    expect(buildListUrl("not-a-url", 2024)).toBeNull();
  });

  test("自前ホスト VOICES（大文字パス）は HTTP を保持", () => {
    const url = buildListUrl(
      "http://info.city.chigasaki.kanagawa.jp/VOICES/g08v_search.asp",
      2024
    );
    expect(url).toBe(
      "http://info.city.chigasaki.kanagawa.jp/VOICES/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=2024&TYY=2024&KGTP=1,3"
    );
  });

  test("gijiroku.com ドメインは HTTPS に変換", () => {
    const url = buildListUrl(
      "http://tsukuba.gijiroku.com/voices/g08v_search.asp",
      2024
    );
    expect(url).toMatch(/^https:\/\//);
  });
});

describe("parseListHtml", () => {
  test("winopen リンクから会議レコードを抽出", () => {
    const html = `
      <TABLE BORDER=0>
      <TR><TD NOWRAP BGCOLOR="#eff7ff" ALIGN=LEFT COLSPAN=3>
      <A HREF="voiweb.exe?ACT=100&FINO=2735"><IMG BORDER=0 SRC="/voices/image/folder.gif"></A>
      令和　６年第２回定例会１２月定例会議,<A HREF="javascript:;"  TARGET="HLD_WIN" onClick="winopen('voiweb.exe?ACT=200&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1&FYY=2024&TYY=2024&TITL_SUBT=test&KGNO=1844&FINO=2736&UNID=K_R06120500011');">12月05日-01号</A>
      </TD></TR>
      </TABLE>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.fino).toBe("2736");
    expect(records[0]!.kgno).toBe("1844");
    expect(records[0]!.unid).toBe("K_R06120500011");
    expect(records[0]!.dateLabel).toBe("12月05日-01号");
    expect(records[0]!.title).toContain("令和");
    expect(records[0]!.title).toContain("12月05日-01号");
  });

  test("複数の会議レコードを抽出", () => {
    const html = `
      <TR><TD>
      <A HREF="voiweb.exe?ACT=100&FINO=2735"><IMG SRC="folder.gif"></A>
      令和　６年定例会,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KGNO=100&FINO=2736&UNID=K_R06120500011');">12月05日-01号</A>
      </TD></TR>
      <TR><TD>
      <A HREF="voiweb.exe?ACT=100&FINO=2746"><IMG SRC="folder.gif"></A>
      令和　６年定例会,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KGNO=100&FINO=2746&UNID=K_R06120600021');">12月06日-02号</A>
      </TD></TR>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(2);
    expect(records[0]!.fino).toBe("2736");
    expect(records[1]!.fino).toBe("2746");
  });

  test("目次エントリはスキップされる", () => {
    const html = `
      <TD>
      タイトル,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KGNO=100&FINO=2735&UNID=K_R06120500001');">12月05日-目次</A>
      </TD>
      <TD>
      タイトル,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KGNO=100&FINO=2736&UNID=K_R06120500011');">12月05日-01号</A>
      </TD>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.dateLabel).toBe("12月05日-01号");
  });

  test("重複 UNID は除外される", () => {
    const html = `
      <TD>タイトル,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KGNO=100&FINO=2736&UNID=K_R06120500011');">12月05日-01号</A></TD>
      <TD>タイトル,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KGNO=100&FINO=2736&UNID=K_R06120500011');">12月05日-01号</A></TD>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
  });

  test("会議がない場合は空配列", () => {
    expect(parseListHtml("<div>結果なし</div>")).toHaveLength(0);
  });

  test("HREF 形式（winopen なし）から会議レコードを抽出", () => {
    const html = `
      <TABLE BORDER=0>
      <TR><TD NOWRAP BGCOLOR="#DDDDEE" ALIGN=LEFT COLSPAN=3>
      <A HREF="voiweb.exe?ACT=100&FINO=1034"><IMG BORDER=0 SRC="/VOICES/image/folder.gif"></A>
      令和　７年１２月定例会,<A HREF="voiweb.exe?ACT=200&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FYY=2025&TYY=2025&TITL_SUBT=test&KGNO=196&FINO=1035&UNID=K_R07112800011" TARGET="HLD_WIN" onClick="window.open('','HLD_WIN','resizable=yes,menubar=yes,toolbar=yes');">11月28日-01号</A>
      </TD></TR>
      </TABLE>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.fino).toBe("1035");
    expect(records[0]!.kgno).toBe("196");
    expect(records[0]!.unid).toBe("K_R07112800011");
    expect(records[0]!.dateLabel).toBe("11月28日-01号");
    expect(records[0]!.title).toContain("令和");
  });

  test("HREF 形式で目次はスキップされる", () => {
    const html = `
      <TD>
      タイトル,<A HREF="voiweb.exe?ACT=200&KGNO=196&FINO=1034&UNID=K_R07112800001" TARGET="HLD_WIN" onClick="window.open('','HLD_WIN','resizable=yes,menubar=yes,toolbar=yes');">11月28日-目次</A>
      </TD>
      <TD>
      タイトル,<A HREF="voiweb.exe?ACT=200&KGNO=196&FINO=1035&UNID=K_R07112800011" TARGET="HLD_WIN" onClick="window.open('','HLD_WIN','resizable=yes,menubar=yes,toolbar=yes');">11月28日-01号</A>
      </TD>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.dateLabel).toBe("11月28日-01号");
  });

  test("winopen で UNID なしの場合は KGNO_FINO を unid に使用", () => {
    const html = `
      <TD>
      令和　７年１２月広報委員会,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FYY=2025&TYY=2025&TITL_SUBT=test&KGNO=2559&FINO=3304');">12月17日-01号</A>
      </TD>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.fino).toBe("3304");
    expect(records[0]!.kgno).toBe("2559");
    expect(records[0]!.unid).toBe("2559_3304");
    expect(records[0]!.dateLabel).toBe("12月17日-01号");
  });

  test("HREF 形式で UNID なしの場合は KGNO_FINO を unid に使用（八代市パターン）", () => {
    const html = `
      <TABLE BORDER=0>
      <TR><TD NOWRAP BGCOLOR="#DDDDEE" ALIGN=LEFT COLSPAN=3>
      <A HREF="voiweb.exe?ACT=100&FINO=972"><IMG BORDER=0 SRC="/VOICES/image/folder.gif"></A>
      令和　７年 ９月定例会,<A HREF="voiweb.exe?ACT=200&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FYY=2025&TYY=2025&TITL_SUBT=test&KGNO=220&FINO=973" TARGET="HLD_WIN" onClick="window.open('','HLD_WIN','resizable=yes,menubar=yes,toolbar=yes');">10月03日-01号</A>
      </TD></TR>
      </TABLE>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.fino).toBe("973");
    expect(records[0]!.kgno).toBe("220");
    expect(records[0]!.unid).toBe("220_973");
    expect(records[0]!.dateLabel).toBe("10月03日-01号");
    expect(records[0]!.title).toContain("令和");
  });

  test("HREF 形式で UNID なしの複数レコードを抽出", () => {
    const html = `
      <TD>
      タイトルA,<A HREF="voiweb.exe?ACT=200&KGNO=220&FINO=973" TARGET="HLD_WIN" onClick="window.open('','HLD_WIN');">10月03日-01号</A>
      </TD>
      <TD>
      タイトルB,<A HREF="voiweb.exe?ACT=200&KGNO=220&FINO=974" TARGET="HLD_WIN" onClick="window.open('','HLD_WIN');">10月04日-02号</A>
      </TD>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(2);
    expect(records[0]!.unid).toBe("220_973");
    expect(records[1]!.unid).toBe("220_974");
  });

  test("winopen 形式が優先され HREF 形式は fallback", () => {
    // winopen 形式がある場合は HREF 形式は使用されない
    const html = `
      <TD>
      タイトルA,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&KGNO=100&FINO=2736&UNID=K_R06120500011');">12月05日-01号</A>
      </TD>
    `;
    const records = parseListHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.unid).toBe("K_R06120500011");
  });
});

describe("extractTitleFromPreceding", () => {
  test("folder link の後のタイトルテキストを抽出", () => {
    const preceding =
      '<A HREF="voiweb.exe?ACT=100"><IMG SRC="folder.gif"></A>\n令和　６年第２回定例会１２月定例会議,';
    expect(extractTitleFromPreceding(preceding)).toBe(
      "令和　６年第２回定例会１２月定例会議"
    );
  });

  test("カンマがない場合は null", () => {
    expect(extractTitleFromPreceding("テキストのみ")).toBeNull();
  });

  test("空テキストの場合は null", () => {
    expect(extractTitleFromPreceding(",")).toBeNull();
  });
});
