import { describe, expect, it } from "vitest";
import {
  parseYearPageLinks,
  parseNewFormat,
  parseOldFormat,
  parsePdfLinksFromYearPage,
} from "./list";

describe("parseYearPageLinks", () => {
  it("ul.menu_list > li.linkList > a からリンクを抽出する", () => {
    const html = `
      <ul class="menu_list">
        <li class="linkList"><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/2024_gikai_kaigiroku.html">令和6年版</a></li>
        <li class="linkList"><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/2023_gikai_kaigiroku.html">令和5年版</a></li>
        <li class="linkList"><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20190520150618.html">令和元年版</a></li>
        <li class="linkList"><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20180521111536.html">平成30年版</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(4);
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.url).toBe(
      "https://www.town.shimonita.lg.jp/gikai/m01/m02/2024_gikai_kaigiroku.html"
    );
    expect(result[1]!.year).toBe(2023);
    expect(result[2]!.year).toBe(2019);
    expect(result[3]!.year).toBe(2018);
  });

  it("年情報が取れないリンクはスキップする", () => {
    const html = `
      <ul class="menu_list">
        <li class="linkList"><a href="/gikai/m01/m02/index.html">会議録一覧</a></li>
        <li class="linkList"><a href="/gikai/m01/m02/2024_gikai_kaigiroku.html">令和6年版</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2024);
  });

  it("menu_list が存在しない場合は空配列を返す", () => {
    const html = "<p>コンテンツなし</p>";
    expect(parseYearPageLinks(html)).toEqual([]);
  });
});

describe("parseNewFormat", () => {
  it("【...定例会】見出しと PDF リンクを正しくパースする", () => {
    const html = `
      <p>【令和6年12月定例会】</p>
      <table border="1">
        <tbody>
          <tr>
            <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20241209_teirei.pdf">会議録第1号12月9日</a></td>
            <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20241210_teirei.pdf">会議録第2号12月10日</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const result = parseNewFormat(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年12月定例会 会議録第1号12月9日");
    expect(result[0]!.heldOn).toBe("2024-12-09");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.meetingHeading).toBe("令和6年12月定例会");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.shimonita.lg.jp/gikai/m01/m02/20241209_teirei.pdf"
    );
    expect(result[1]!.heldOn).toBe("2024-12-10");
  });

  it("臨時会の meetingType を correctly 判定する", () => {
    const html = `
      <p>【令和6年7月臨時会】</p>
      <table border="1">
        <tbody>
          <tr>
            <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20240722_rinji.pdf">会議録第1号7月22日</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const result = parseNewFormat(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-07-22");
  });

  it("複数の会議種別が存在する場合も正しくパースする", () => {
    const html = `
      <p>【令和6年9月定例会】</p>
      <table border="1">
        <tbody>
          <tr>
            <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20240909_teirei.pdf">会議録第1号9月9日</a></td>
          </tr>
        </tbody>
      </table>
      <p>【令和6年7月臨時会】</p>
      <table border="1">
        <tbody>
          <tr>
            <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20240722_rinji.pdf">会議録第1号7月22日</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const result = parseNewFormat(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.meetingHeading).toBe("令和6年9月定例会");
    expect(result[1]!.meetingType).toBe("extraordinary");
    expect(result[1]!.meetingHeading).toBe("令和6年7月臨時会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>【令和6年12月定例会】</p><p>準備中です。</p>";
    expect(parseNewFormat(html)).toEqual([]);
  });

  it("見出しがない場合は空配列を返す", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><a href="/gikai/m01/m02/20241209_teirei.pdf">会議録第1号</a></td>
          </tr>
        </tbody>
      </table>
    `;
    expect(parseNewFormat(html)).toEqual([]);
  });
});

describe("parseOldFormat", () => {
  it("rowspan セルから会議種別を取得し PDF リンクをパースする", () => {
    const html = `
      <table border="0" cellspacing="0" cellpadding="0" width="481">
        <tbody>
          <tr>
            <td class="xl67" rowspan="3" style="background-color: #daeef3">
              <span style="font-family: ＭＳ Ｐゴシック">平成26年12月定例会</span>
            </td>
            <td class="xl66">
              <span style="font-family: ＭＳ Ｐゴシック">
                <a href="https://www.town.shimonita.lg.jp/gikai/content/20141205teirei.pdf">会議録第１号　12月5日 （263KB）</a>
              </span>
            </td>
          </tr>
          <tr>
            <td class="xl66">
              <span>
                <a href="https://www.town.shimonita.lg.jp/gikai/content/20141208teirei.pdf">会議録第２号　12月8日 （180KB）</a>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const result = parseOldFormat(html);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.shimonita.lg.jp/gikai/content/20141205teirei.pdf"
    );
    expect(result[0]!.heldOn).toBe("2014-12-05");
  });
});

describe("parsePdfLinksFromYearPage", () => {
  it("新形式ページから PDF リンクを抽出する", () => {
    const html = `
      <article class="article">
        <p>【令和6年12月定例会】</p>
        <table border="1">
          <tbody>
            <tr>
              <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20241209_teirei.pdf">会議録第1号12月9日</a></td>
              <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20241210_teirei.pdf">会議録第2号12月10日</a></td>
            </tr>
          </tbody>
        </table>
      </article>
    `;

    const result = parsePdfLinksFromYearPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2024-12-09");
    expect(result[1]!.heldOn).toBe("2024-12-10");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <article class="article">
        <p>準備中です。</p>
      </article>
    `;
    expect(parsePdfLinksFromYearPage(html)).toEqual([]);
  });
});
