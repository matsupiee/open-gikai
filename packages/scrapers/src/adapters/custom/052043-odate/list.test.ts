import { describe, expect, it } from "vitest";
import {
  matchesYear,
  parseYearPageUrls,
  isCurrentYearPage,
  parseYearPage,
  parseDateFromCell,
  extractCaptionText,
  extractPrecedingSessionTitle,
} from "./list";

describe("matchesYear", () => {
  it("令和6年 → 2024", () => {
    expect(matchesYear("令和6年会議録", 2024)).toBe(true);
  });

  it("令和7年 → 2025", () => {
    expect(matchesYear("令和7年会議録", 2025)).toBe(true);
  });

  it("平成30年 → 2018", () => {
    expect(matchesYear("平成30年会議録", 2018)).toBe(true);
  });

  it("平成31年・令和元年 → 2019（平成31年側）", () => {
    expect(matchesYear("平成31年・令和元年会議録", 2019)).toBe(true);
  });

  it("令和元年 → 2019", () => {
    expect(matchesYear("令和元年会議録", 2019)).toBe(true);
  });

  it("一致しない年は false", () => {
    expect(matchesYear("令和6年会議録", 2023)).toBe(false);
  });
});

describe("isCurrentYearPage", () => {
  it("h3 に令和7年があれば 2025 で true", () => {
    const html = `
      <h3>【令和７年３月定例会】</h3>
      <table></table>
    `;
    expect(isCurrentYearPage(html, 2025)).toBe(true);
  });

  it("h3 に令和7年がなければ 2025 で false", () => {
    const html = `
      <h3>【令和６年３月定例会】</h3>
      <table></table>
    `;
    expect(isCurrentYearPage(html, 2025)).toBe(false);
  });

  it("複数年度があり該当年があれば true", () => {
    const html = `
      <h3>【令和７年６月定例会】</h3>
      <h3>【令和７年３月定例会】</h3>
    `;
    expect(isCurrentYearPage(html, 2025)).toBe(true);
  });
});

describe("parseYearPageUrls", () => {
  const baseUrl = "https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku";

  it("年度ナビリンクから対象年の URL を抽出する", () => {
    const html = `
      <a href="/city/handbook/handbook13/page56/kaigiroku/p12038">令和６年会議録</a>
      <a href="/city/handbook/handbook13/page56/kaigiroku/p11169">令和５年会議録</a>
      <a href="/city/handbook/handbook13/page56/kaigiroku/h30">平成30年会議録</a>
    `;
    const result = parseYearPageUrls(html, 2024, baseUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku/p12038"
    );
  });

  it("平成31年・令和元年ページは 2019 にマッチする", () => {
    const html = `
      <a href="/city/handbook/handbook13/page56/kaigiroku/r1">平成31年・令和元年会議録</a>
      <a href="/city/handbook/handbook13/page56/kaigiroku/p12038">令和６年会議録</a>
    `;
    const result = parseYearPageUrls(html, 2019, baseUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku/r1"
    );
  });

  it("平成30年の URL を抽出する", () => {
    const html = `
      <a href="/city/handbook/handbook13/page56/kaigiroku/h30">平成30年会議録</a>
      <a href="/city/handbook/handbook13/page56/kaigiroku/h29">平成29年会議録</a>
    `;
    const result = parseYearPageUrls(html, 2018, baseUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku/h30"
    );
  });

  it("対象年のページがない場合は空配列を返す", () => {
    const html = `
      <a href="/city/handbook/handbook13/page56/kaigiroku/p12038">令和６年会議録</a>
    `;
    const result = parseYearPageUrls(html, 2023, baseUrl);
    expect(result).toHaveLength(0);
  });

  it("baseUrl 自体がトップページ（最新年度）に該当する場合を含める", () => {
    const html = `
      <h3>【令和７年３月定例会】</h3>
      <a href="/city/handbook/handbook13/page56/kaigiroku/p12038">令和６年会議録</a>
    `;
    const result = parseYearPageUrls(html, 2025, baseUrl);
    expect(result).toContain(baseUrl);
  });

  it("重複 URL を除外する", () => {
    const html = `
      <a href="/city/handbook/handbook13/page56/kaigiroku/p12038">令和６年会議録</a>
      <a href="/city/handbook/handbook13/page56/kaigiroku/p12038">令和６年会議録（重複）</a>
    `;
    const result = parseYearPageUrls(html, 2024, baseUrl);
    expect(result).toHaveLength(1);
  });
});

describe("parseDateFromCell", () => {
  it("全角数字の日付を YYYY-MM-DD に変換する", () => {
    expect(parseDateFromCell("２月２６日（月）", 2024)).toBe("2024-02-26");
  });

  it("半角数字の日付を YYYY-MM-DD に変換する", () => {
    expect(parseDateFromCell("3月4日（月）", 2024)).toBe("2024-03-04");
  });

  it("月と日が1桁の場合もゼロ埋めする", () => {
    expect(parseDateFromCell("６月３日（月）", 2024)).toBe("2024-06-03");
  });

  it("2桁月の日付を正しく変換する", () => {
    expect(parseDateFromCell("１２月１２日（木）", 2024)).toBe("2024-12-12");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseDateFromCell("未定", 2024)).toBeNull();
  });

  it("空文字列の場合は null を返す", () => {
    expect(parseDateFromCell("", 2024)).toBeNull();
  });
});

describe("extractCaptionText", () => {
  it("table の caption タグからテキストを抽出する", () => {
    const tableHtml = `<table><caption>【令和６年３月定例会】</caption><tbody></tbody></table>`;
    expect(extractCaptionText(tableHtml)).toBe("【令和６年３月定例会】");
  });

  it("caption がない場合は null を返す", () => {
    const tableHtml = `<table><tbody></tbody></table>`;
    expect(extractCaptionText(tableHtml)).toBeNull();
  });
});

describe("extractPrecedingSessionTitle", () => {
  it("直前の p タグのスパンから会議名を抽出する", () => {
    const preceding = `<p><span style="color: #000000; font-size: 1rem;">【令和６年6月定例会】</span></p>`;
    expect(extractPrecedingSessionTitle(preceding)).toBe("【令和６年6月定例会】");
  });

  it("複数ある場合は最後の会議名を返す", () => {
    const preceding = `
      <p><span>【令和６年３月定例会】</span></p>
      </table>
      <p><span>【令和６年6月定例会】</span></p>
    `;
    expect(extractPrecedingSessionTitle(preceding)).toBe("【令和６年6月定例会】");
  });

  it("会議名がない場合は null を返す", () => {
    const preceding = `<p>その他のテキスト</p>`;
    expect(extractPrecedingSessionTitle(preceding)).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("caption を使った定例会の複数 PDF を抽出する（最初のテーブル形式）", () => {
    const html = `
      <h3>令和６年会議録</h3>
      <table class="table">
        <caption>【令和６年３月定例会】</caption>
        <tbody>
          <tr><th>議事日程</th><th>開催日時</th><th>内容</th></tr>
          <tr>
            <td><a href="/uploads/public/pages_0000012038_00/令和06年03月定例会01日目.pdf">第１日目</a> [PDF:592KB]</td>
            <td>２月２６日（月）</td>
            <td>開会、議席の一部変更</td>
          </tr>
          <tr>
            <td><a href="/uploads/public/pages_0000012038_00/令和06年03月定例会02日目.pdf">第２日目</a> [PDF:898KB]</td>
            <td>３月４日（月）</td>
            <td>一般質問</td>
          </tr>
        </tbody>
      </table>
    `;
    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("【令和６年３月定例会】 第１日目");
    expect(result[0]!.heldOn).toBe("2024-02-26");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/令和06年03月定例会01日目.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.sessionGroupTitle).toBe("【令和６年３月定例会】");
    expect(result[0]!.dayLabel).toBe("第１日目");
    expect(result[1]!.heldOn).toBe("2024-03-04");
  });

  it("p タグ内の会議名を使った定例会 PDF を抽出する（後続テーブル形式）", () => {
    const html = `
      <p><span style="color: #000000; font-size: 1rem;">【令和６年6月定例会】</span></p>
      <table class="table">
        <tbody>
          <tr><th>議事日程</th><th>開催日時</th><th>内容</th></tr>
          <tr>
            <td><a href="/uploads/public/pages_0000012038_00/令和06年06月定例会01日目.pdf">第１日目</a></td>
            <td>５月２７日（月）</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]!.sessionGroupTitle).toBe("【令和６年6月定例会】");
    expect(result[0]!.heldOn).toBe("2024-05-27");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("臨時会を正しく検出する", () => {
    const html = `
      <table class="table">
        <caption>【令和元年第１回臨時会】</caption>
        <tbody>
          <tr><th>議事日程</th><th>開催日時</th><th>内容</th></tr>
          <tr>
            <td><a href="/uploads/public/pages_0000000776_00/005_010501.pdf">第１日目</a></td>
            <td>５月２０日（月）</td>
            <td>開会</td>
          </tr>
        </tbody>
      </table>
    `;
    const result = parseYearPage(html, 2019);
    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2019-05-20");
  });

  it("複数の会議グループ（caption + p の混在）を処理する", () => {
    const html = `
      <h3>令和６年会議録</h3>
      <table class="table">
        <caption>【令和６年３月定例会】</caption>
        <tbody>
          <tr>
            <td><a href="/uploads/public/pages_0000012038_00/令和06年03月定例会01日目.pdf">第１日目</a></td>
            <td>２月２６日（月）</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <p><span style="color: #000000;">【令和６年6月定例会】</span></p>
      <table class="table">
        <tbody>
          <tr>
            <td><a href="/uploads/public/pages_0000012038_00/令和06年06月定例会01日目.pdf">第１日目</a></td>
            <td>５月２７日（月）</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(2);
    expect(result[0]!.sessionGroupTitle).toBe("【令和６年３月定例会】");
    expect(result[1]!.sessionGroupTitle).toBe("【令和６年6月定例会】");
  });

  it("PDF リンクがない table 行はスキップする", () => {
    const html = `
      <table class="table">
        <caption>【令和６年３月定例会】</caption>
        <tbody>
          <tr><th>議事日程</th><th>開催日時</th><th>内容</th></tr>
          <tr>
            <td>テキストのみ（リンクなし）</td>
            <td>２月２６日（月）</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(0);
  });

  it("日付が解析できない場合は heldOn が null", () => {
    const html = `
      <table class="table">
        <caption>【令和６年３月定例会】</caption>
        <tbody>
          <tr>
            <td><a href="/uploads/public/pages_0000012038_00/test.pdf">第１日目</a></td>
            <td>未定</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBeNull();
  });
});
