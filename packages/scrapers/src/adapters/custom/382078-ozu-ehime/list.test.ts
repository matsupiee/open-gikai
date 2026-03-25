import { describe, expect, it } from "vitest";
import { parseIndexPage } from "./list";

describe("parseIndexPage", () => {
  it("令和年の定例会リンクを抽出する", () => {
    const html = `
      <TABLE>
        <TR>
          <TD><A href="R08/202601rinji-mokuji.html">目次</A></TD>
          <TD><A href="R08/202601rinji-1.html">会議録</A></TD>
        </TR>
      </TABLE>
    `;

    const docs = parseIndexPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.year).toBe(2026);
    expect(docs[0]!.eraDir).toBe("R08");
    expect(docs[0]!.fileKey).toBe("202601rinji");
    expect(docs[0]!.detailUrl).toBe(
      "https://www.city.ozu.ehime.jp/kaigiroku/R08/202601rinji-1.html",
    );
    expect(docs[0]!.heldYearMonth).toBe("2026-01");
  });

  it("平成年の定例会リンクを抽出する", () => {
    const html = `
      <TABLE>
        <TR>
          <TD><A href="H30/201803teirei-mokuji.html">目次</A></TD>
          <TD><A href="H30/201803teirei-1.html">会議録</A></TD>
        </TR>
      </TABLE>
    `;

    const docs = parseIndexPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.year).toBe(2018);
    expect(docs[0]!.eraDir).toBe("H30");
    expect(docs[0]!.fileKey).toBe("201803teirei");
    expect(docs[0]!.heldYearMonth).toBe("2018-03");
  });

  it("複数会議を抽出する", () => {
    const html = `
      <TABLE>
        <TR>
          <TD><A href="R06/202403teirei-1.html">会議録</A></TD>
        </TR>
        <TR>
          <TD><A href="R06/202406teirei-1.html">会議録</A></TD>
        </TR>
        <TR>
          <TD><A href="R06/202409teirei-1.html">会議録</A></TD>
        </TR>
      </TABLE>
    `;

    const docs = parseIndexPage(html);

    expect(docs).toHaveLength(3);
    expect(docs[0]!.heldYearMonth).toBe("2024-03");
    expect(docs[1]!.heldYearMonth).toBe("2024-06");
    expect(docs[2]!.heldYearMonth).toBe("2024-09");
  });

  it("コメントアウト内のリンクは取得しない", () => {
    const html = `
      <!-- <A href="R08/202604teirei-1.html">会議録</A> -->
      <A href="R08/202601rinji-1.html">会議録</A>
    `;

    const docs = parseIndexPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.fileKey).toBe("202601rinji");
  });

  it("重複リンクは1件のみ返す", () => {
    const html = `
      <A href="R07/202506teirei-1.html">会議録</A>
      <A href="R07/202506teirei-1.html">会議録</A>
    `;

    const docs = parseIndexPage(html);

    expect(docs).toHaveLength(1);
  });

  it("会議録リンクがない場合は空配列を返す", () => {
    const html = `
      <TABLE>
        <TR><TD>データなし</TD></TR>
      </TABLE>
    `;

    const docs = parseIndexPage(html);

    expect(docs).toHaveLength(0);
  });

  it("sessionTitle に会議種別が含まれる", () => {
    const html = `
      <A href="R07/202501rinji-1.html">会議録</A>
      <A href="R07/202503teirei-1.html">会議録</A>
    `;

    const docs = parseIndexPage(html);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.sessionTitle).toContain("臨時会");
    expect(docs[1]!.sessionTitle).toContain("定例会");
  });
});
