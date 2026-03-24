import { describe, it, expect } from "vitest";
import {
  extractPdfLinks,
  parseDirectListPage,
  parseYearListPageLinks,
  parseIndividualMeetingPage,
  parseCommitteePage,
} from "./list";

describe("extractPdfLinks", () => {
  it("img/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <a href="img/kaigiroku_r3_5_6.pdf">会議録</a>
      <a href="img/230301_kiroku.pdf">委員会記録</a>
      <a href="https://example.com/other.pdf">外部リンク</a>
    `;
    const links = extractPdfLinks(html);
    expect(links).toHaveLength(2);
    expect(links[0]).toBe("img/kaigiroku_r3_5_6.pdf");
    expect(links[1]).toBe("img/230301_kiroku.pdf");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    expect(extractPdfLinks("<p>テキスト</p>")).toEqual([]);
  });
});

describe("parseDirectListPage", () => {
  it("col-title の th から会議名を取得して PDF リンクを抽出する", () => {
    const html = `
      <table class="sp-table">
        <tr>
          <th>名称</th><th>議事日程</th><th>録画</th><th>会議録</th>
        </tr>
        <tr>
          <th class="col-title">3月定例会議</th>
          <td><a href="img/r6.3.4_nittei.pdf">3月4日（月）</a></td>
          <td></td>
          <td><a href="img/kaigiroku_r6_3_4.pdf">会議録 令和6年3月4日（月）</a></td>
        </tr>
      </table>
    `;
    const meetings = parseDirectListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("3月定例会議 2024-03-04");
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
    expect(meetings[0]!.pdfUrl).toBe("http://gikai-sharitown.net/img/kaigiroku_r6_3_4.pdf");
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("会議録列が空の行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">1月臨時会議</th>
          <td><a href="img/r6.1.10_nittei.pdf">1月10日</a></td>
          <td></td>
          <td></td>
        </tr>
      </table>
    `;
    const meetings = parseDirectListPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("臨時会議は extraordinary に分類される", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">1月臨時会議</th>
          <td></td><td></td>
          <td><a href="img/kaigiroku_r6_1_10.pdf">会議録 令和6年1月10日</a></td>
        </tr>
      </table>
    `;
    const meetings = parseDirectListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("複数の会議を抽出する", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">3月定例会議</th>
          <td></td><td></td>
          <td><a href="img/kaigiroku_r6_3_4.pdf">会議録 令和6年3月4日</a></td>
        </tr>
        <tr>
          <th class="col-title">6月定例会議</th>
          <td></td><td></td>
          <td><a href="img/kaigiroku_r6_6_10.pdf">会議録 令和6年6月10日</a></td>
        </tr>
      </table>
    `;
    const meetings = parseDirectListPage(html);
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
    expect(meetings[1]!.heldOn).toBe("2024-06-10");
  });

  it("ファイル名から日付を解析する（リンクテキストに日付がない場合）", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">9月定例会議</th>
          <td></td><td></td>
          <td><a href="img/kaigiroku_r5_9_13.pdf">会議録</a></td>
        </tr>
      </table>
    `;
    const meetings = parseDirectListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-09-13");
  });
});

describe("parseYearListPageLinks", () => {
  it("年度一覧ページ（r3形式）から個別会議ページへのリンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title row-title">名称</th>
          <th class="row-title">開催日</th>
        </tr>
        <tr>
          <th class="col-title">3月定例会議</th>
          <td><a href="r4_3kaigi.html">令和4年3月9日（水）</a></td>
        </tr>
        <tr>
          <th class="col-title">6月定例会議</th>
          <td><a href="r4_6kaigi.html">令和4年6月8日（水）</a></td>
        </tr>
      </table>
    `;
    const links = parseYearListPageLinks(html, "http://gikai-sharitown.net/r3giji.html");
    expect(links).toHaveLength(2);
    expect(links[0]!.url).toBe("http://gikai-sharitown.net/r4_3kaigi.html");
    expect(links[0]!.title).toBe("3月定例会議 令和4年3月9日（水）");
    expect(links[0]!.heldOn).toBe("2022-03-09");
    expect(links[1]!.url).toBe("http://gikai-sharitown.net/r4_6kaigi.html");
    expect(links[1]!.heldOn).toBe("2022-06-08");
  });

  it("同じ個別会議ページへの複数リンクは重複排除する", () => {
    // 実際のr3giji.htmlのように同じ.htmlが複数回登場する場合
    const html = `
      <table>
        <tr>
          <th class="col-title">3月定例会議</th>
          <td>
            <a href="r4_3kaigi.html">令和4年3月9日（水）</a>
            <a href="r4_3kaigi.html">令和4年3月10日（木）</a>
            <a href="r4_3kaigi.html">令和4年3月14日（月）</a>
          </td>
        </tr>
      </table>
    `;
    const links = parseYearListPageLinks(html, "http://gikai-sharitown.net/r3giji.html");
    // 同じ URL は1件のみ
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe("http://gikai-sharitown.net/r4_3kaigi.html");
  });

  it("ヘッダ行（名称・開催日）はスキップする", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title row-title">名称</th>
          <th class="row-title">開催日</th>
        </tr>
      </table>
    `;
    const links = parseYearListPageLinks(html, "http://gikai-sharitown.net/r3giji.html");
    expect(links).toHaveLength(0);
  });

  it("年度ページ自身へのリンクはスキップする", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">令和3年</th>
          <td><a href="r3giji.html">令和3年度</a></td>
        </tr>
      </table>
    `;
    const links = parseYearListPageLinks(html, "http://gikai-sharitown.net/r3giji.html");
    expect(links).toHaveLength(0);
  });

  it("令和元年を正しくパースする", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">招集会議</th>
          <td><a href="r1_5kaigi.html">令和元年5月1日（水）</a></td>
        </tr>
      </table>
    `;
    const links = parseYearListPageLinks(html, "http://gikai-sharitown.net/r1giji.html");
    expect(links).toHaveLength(1);
    expect(links[0]!.heldOn).toBe("2019-05-01");
  });

  it("question_ で始まるリンクはスキップする", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">3月定例会議</th>
          <td>
            <a href="question_r3.html">令和4年3月14日（月）</a>
            <a href="r4_3kaigi.html">令和4年3月9日（水）</a>
          </td>
        </tr>
      </table>
    `;
    const links = parseYearListPageLinks(html, "http://gikai-sharitown.net/r3giji.html");
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe("http://gikai-sharitown.net/r4_3kaigi.html");
  });

  it("アンカー付きリンクはアンカーを除去して重複排除する", () => {
    const html = `
      <table>
        <tr>
          <th class="col-title">6月定例会議</th>
          <td>
            <a href="0624_1.html">令和3年6月24日（木）</a>
            <a href="0624_1.html#spb-page-title-10">令和3年6月25日（金）</a>
          </td>
        </tr>
      </table>
    `;
    const links = parseYearListPageLinks(html, "http://gikai-sharitown.net/r3giji.html");
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe("http://gikai-sharitown.net/0624_1.html");
  });
});

describe("parseIndividualMeetingPage", () => {
  it("個別会議ページから kaigiroku PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <th>第1</th>
          <td></td>
          <td>会議録署名議員の指名について</td>
          <td></td>
          <td><a href="https://www.youtube.com/watch?v=abc">再生</a></td>
          <td><a href="img/kaigiroku_r3_5_6.pdf">会議録 令和3年5月6日（木）</a></td>
        </tr>
      </table>
    `;
    const meetings = parseIndividualMeetingPage(html, "3月定例会議", "2021-05-06");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe("http://gikai-sharitown.net/img/kaigiroku_r3_5_6.pdf");
    expect(meetings[0]!.heldOn).toBe("2021-05-06");
    expect(meetings[0]!.title).toBe("3月定例会議");
  });

  it("同じ PDF が複数の行に出現しても1件のみ返す", () => {
    const html = `
      <a href="img/kaigiroku_r3_5_6.pdf">会議録</a>
      <a href="img/kaigiroku_r3_5_6.pdf">会議録（再掲）</a>
    `;
    const meetings = parseIndividualMeetingPage(html, "定例会議", null);
    expect(meetings).toHaveLength(1);
  });

  it("kaigiroku PDF がない場合は空配列を返す", () => {
    const html = `<p>会議録は準備中です。</p>`;
    const meetings = parseIndividualMeetingPage(html, "定例会議", null);
    expect(meetings).toHaveLength(0);
  });

  it("ファイル名から日付を解析する（リンクテキストに日付がない場合）", () => {
    const html = `<a href="img/kaigiroku_r4_3_9.pdf">会議録</a>`;
    const meetings = parseIndividualMeetingPage(html, "3月定例会議", null);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2022-03-09");
  });
});

describe("parseCommitteePage", () => {
  it("委員会ページから kiroku PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="img/230301_kiroku.pdf">令和5年3月1日 総務文教常任委員会</a></li>
        <li><a href="img/220916_kiroku2.pdf">令和4年9月16日 第2回</a></li>
      </ul>
    `;
    const meetings = parseCommitteePage(html, "総務文教常任委員会");
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe("http://gikai-sharitown.net/img/230301_kiroku.pdf");
    expect(meetings[0]!.heldOn).toBe("2023-03-01");
    expect(meetings[0]!.meetingType).toBe("committee");
    expect(meetings[0]!.title).toBe("総務文教常任委員会 2023-03-01");
    expect(meetings[1]!.heldOn).toBe("2022-09-16");
  });

  it("kiroku PDF がない場合は空配列を返す", () => {
    const html = `<p>記録はありません。</p>`;
    const meetings = parseCommitteePage(html, "議会運営委員会");
    expect(meetings).toHaveLength(0);
  });

  it("同じ PDF が複数出現しても1件のみ返す", () => {
    const html = `
      <a href="img/230301_kiroku.pdf">記録1</a>
      <a href="img/230301_kiroku.pdf">記録1（再掲）</a>
    `;
    const meetings = parseCommitteePage(html, "委員会");
    expect(meetings).toHaveLength(1);
  });
});
