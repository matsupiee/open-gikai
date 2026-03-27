import { describe, expect, it } from "vitest";
import { parseIndexPage, parseRedirectUrl, parseYearPage } from "./list";

const INDEX_HTML = `
<ul class="g_navi" id="g_navi_404" style="display:none;">
  <li><a href="//www.town.arita.lg.jp/gikai/list00984.html">2025</a></li>
  <li><a href="//www.town.arita.lg.jp/gikai/list00946.html">2024</a></li>
  <li><a href="//www.town.arita.lg.jp/gikai/list00422.html">2023</a></li>
</ul>
<ul class="g_navi" id="g_navi_405" style="display:none;">
  <li><a href="//www.town.arita.lg.jp/gikai/list00983.html">2025</a></li>
  <li><a href="//www.town.arita.lg.jp/gikai/list00942.html">2024</a></li>
</ul>
`;

describe("parseIndexPage", () => {
  it("会議録・定例会の年度リンクだけを抽出する", () => {
    const result = parseIndexPage(INDEX_HTML);

    expect(result).toEqual([
      {
        year: 2025,
        url: "https://www.town.arita.lg.jp/gikai/list00984.html",
      },
      {
        year: 2024,
        url: "https://www.town.arita.lg.jp/gikai/list00946.html",
      },
      {
        year: 2023,
        url: "https://www.town.arita.lg.jp/gikai/list00422.html",
      },
    ]);
  });
});

describe("parseRedirectUrl", () => {
  it("meta refresh から detail.aspx URL を抽出する", () => {
    const html = `
      <meta http-equiv="refresh" content="0; url=https://www.town.arita.lg.jp/dynamic/gikai/hpkiji/pub/detail.aspx?c_id=3&amp;id=3377&amp;class_set_id=8&amp;class_id=984" />
    `;

    expect(parseRedirectUrl(html)).toBe(
      "https://www.town.arita.lg.jp/dynamic/gikai/hpkiji/pub/detail.aspx?c_id=3&id=3377&class_set_id=8&class_id=984"
    );
  });

  it("JavaScript の location.href からも URL を抽出する", () => {
    const html = `
      <script>
        location.href='https://www.town.arita.lg.jp/dynamic/gikai/hpkiji/pub/detail.aspx?c_id=3&id=2564&class_set_id=8&class_id=946';
      </script>
    `;

    expect(parseRedirectUrl(html)).toBe(
      "https://www.town.arita.lg.jp/dynamic/gikai/hpkiji/pub/detail.aspx?c_id=3&id=2564&class_set_id=8&class_id=946"
    );
  });
});

const YEAR_PAGE_HTML = `
<article>
  <h3 class="title">令和7年3月 第12回有田町議会定例会</h3>
  <div class="wys_template wys_list">
    <ul>
      <li>
        <p><a href="https://www.town.arita.lg.jp/gikai/kiji0033377/3_3377_4448_up_38u51xn6.pdf">会期日程</a></p>
      </li>
    </ul>
  </div>
  <table class="__wys_table">
    <tbody>
      <tr><td>月日</td><td>摘要（会議録）</td></tr>
      <tr>
        <td>3月4日（火曜日）</td>
        <td><a href="/gikai/kiji0033377/3_3377_4452_up_28xqxu08.pdf">一般質問（久保田議員）</a></td>
      </tr>
      <tr>
        <td>&nbsp;3月5日（水曜日）</td>
        <td><a href="https://www.town.arita.lg.jp/gikai/kiji0033377/3_3377_4453_up_bxsqxz1c.pdf">一般質問（樋渡議員）</a></td>
      </tr>
    </tbody>
  </table>
  <h3 class="title">令和7年4月 第1回有田町議会臨時会</h3>
  <table class="__wys_table">
    <tbody>
      <tr><th>月日</th><th>摘要（会議録）</th></tr>
      <tr>
        <td>4月1日（火曜日）</td>
        <td><a href="//www.town.arita.lg.jp/gikai/kiji0033377/rinji.pdf">臨時会会議録</a></td>
      </tr>
    </tbody>
  </table>
</article>
`;

describe("parseYearPage", () => {
  it("表内の PDF リンクだけを抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);

    expect(result.length).toBe(3);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.arita.lg.jp/gikai/kiji0033377/3_3377_4452_up_28xqxu08.pdf"
    );
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.arita.lg.jp/gikai/kiji0033377/3_3377_4453_up_bxsqxz1c.pdf"
    );
    expect(result[2]!.pdfUrl).toBe(
      "https://www.town.arita.lg.jp/gikai/kiji0033377/rinji.pdf"
    );
  });

  it("開催日と日次タイトルを組み立てる", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);

    expect(result[0]!.heldOn).toBe("2025-03-04");
    expect(result[0]!.title).toBe("第12回定例会 第1日");
    expect(result[1]!.heldOn).toBe("2025-03-05");
    expect(result[1]!.title).toBe("第12回定例会 第2日");
  });

  it("臨時会を extraordinary として扱う", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);

    expect(result[2]!.heldOn).toBe("2025-04-01");
    expect(result[2]!.title).toBe("第1回臨時会 第1日");
    expect(result[2]!.meetingType).toBe("extraordinary");
  });
});
