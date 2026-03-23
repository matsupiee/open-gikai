import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearlyListPage, parseInfoPage } from "./list";

describe("parseTopPage", () => {
  it("年度別ジャンル ID と西暦を抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li>
            令和6(2024)年
            <a href="/0361/genre3-0-001.html">令和6(2024)年の会議録</a>
          </li>
          <li>
            令和5(2023)年
            <a href="/0341/genre3-0-001.html">令和5(2023)年の会議録</a>
          </li>
          <li>
            令和4(2022)年
            <a href="/0328/genre3-0-001.html">令和4(2022)年の会議録</a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.genreId).toBe("0361");
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.genreId).toBe("0341");
    expect(result[1]!.year).toBe(2023);
    expect(result[2]!.genreId).toBe("0328");
    expect(result[2]!.year).toBe(2022);
  });

  it("重複するジャンル ID を除外する", () => {
    const html = `
      令和6(2024)年
      <a href="/0361/genre3-0-001.html">最新</a>
      令和6(2024)年
      <a href="/0361/genre3-0-001.html">一覧</a>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.genreId).toBe("0361");
  });

  it("genre3-0-001.html へのリンクがない場合は空配列を返す", () => {
    const html = `<html><body><a href="/0361/genre2-0-001.html">トップ</a></body></html>`;
    expect(parseTopPage(html)).toEqual([]);
  });

  it("年度を特定できないリンクはスキップする", () => {
    const html = `<a href="/0361/genre3-0-001.html">会議録</a>`;
    const result = parseTopPage(html);
    expect(result).toHaveLength(0);
  });
});

describe("parseYearlyListPage", () => {
  it("会議詳細ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/0361/info-12345-0.html">令和6(2024)年第6回議会定例会(12月)会議録</a></li>
          <li><a href="/0361/info-12344-0.html">令和6(2024)年第5回議会臨時会(10月)会議録</a></li>
          <li><a href="/0361/info-12343-0.html">令和6(2024)年第4回議会定例会(9月)会議録</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseYearlyListPage(html, "0361");

    expect(result).toHaveLength(3);
    expect(result[0]!.infoUrl).toBe(
      "https://www.town.kaminokawa.lg.jp/0361/info-12345-0.html"
    );
    expect(result[0]!.title).toBe("令和6(2024)年第6回議会定例会(12月)会議録");
    expect(result[1]!.infoUrl).toBe(
      "https://www.town.kaminokawa.lg.jp/0361/info-12344-0.html"
    );
    expect(result[1]!.title).toBe("令和6(2024)年第5回議会臨時会(10月)会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/0361/info-12345-0.html">令和6(2024)年第6回議会定例会(12月)会議録</a>
      <a href="/0361/info-99999-0.html">その他のページ</a>
      <a href="/about/index.html">議会について</a>
    `;

    const result = parseYearlyListPage(html, "0361");
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6(2024)年第6回議会定例会(12月)会議録");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <a href="/0361/info-12345-0.html">令和6(2024)年第6回議会定例会(12月)会議録</a>
      <a href="/0361/info-12345-0.html">令和6(2024)年第6回議会定例会(12月)会議録</a>
    `;

    const result = parseYearlyListPage(html, "0361");
    expect(result).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseYearlyListPage("", "0361")).toEqual([]);
  });
});

describe("parseInfoPage", () => {
  it("テーブルから PDF リンクと開催日を抽出する（相対パス形式）", () => {
    // 実際のサイトの HTML 構造: href="../manage/contents/upload/{hash}.pdf"
    // 日付テキストは "MM月DD日(pdf NNN KB)" 形式
    const html = `
      <table border="1" class="table-1">
        <thead>
          <tr>
            <th>日にち</th><th>曜日</th><th>審議内容</th>
          </tr>
        </thead>
        <tbody>
          <tr valign="top">
            <td><a href="../manage/contents/upload/67b29378f06e1.pdf" target="_blank"><img alt="pdf" src="/images/icons/adobe-pdf03.png">12月3日(pdf 613 KB)</a></td>
            <td>火曜日</td>
            <td>一般質問（4人）</td>
          </tr>
          <tr valign="top">
            <td><a href="../manage/contents/upload/67b2939b2939d.pdf" target="_blank"><img alt="pdf" src="/images/icons/adobe-pdf03.png">12月10日(pdf 329 KB)</a></td>
            <td>火曜日</td>
            <td>議案審議</td>
          </tr>
        </tbody>
      </table>
    `;

    const result = parseInfoPage(
      html,
      "令和6(2024)年第6回議会定例会(12月)会議録"
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kaminokawa.lg.jp/manage/contents/upload/67b29378f06e1.pdf"
    );
    expect(result[0]!.heldOn).toBe("2024-12-03");
    expect(result[0]!.description).toBe("一般質問（4人）");
    expect(result[0]!.pdfHash).toBe("67b29378f06e1");
    expect(result[1]!.heldOn).toBe("2024-12-10");
    expect(result[1]!.description).toBe("議案審議");
  });

  it("PDF リンクがない行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <td>12月3日</td>
          <td>火</td>
          <td>一般質問（PDF なし）</td>
        </tr>
        <tr>
          <td><a href="../manage/contents/upload/67b29378f06e1.pdf" target="_blank">12月10日(pdf 329 KB)</a></td>
          <td>火</td>
          <td>議案審議</td>
        </tr>
      </table>
    `;

    const result = parseInfoPage(
      html,
      "令和6(2024)年第6回議会定例会(12月)会議録"
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-12-10");
  });

  it("日付が解析できない行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <td><a href="../manage/contents/upload/abc1234567890a.pdf">日程未定</a></td>
          <td></td>
          <td>審議内容</td>
        </tr>
      </table>
    `;

    const result = parseInfoPage(
      html,
      "令和6(2024)年第6回議会定例会(12月)会議録"
    );
    expect(result).toHaveLength(0);
  });

  it("臨時会の1日開催 PDF を抽出する", () => {
    const html = `
      <table>
        <tbody>
          <tr valign="top">
            <td><a href="../manage/contents/upload/664ae92678c34.pdf" target="_blank"><img alt="pdf" src="/images/icons/adobe-pdf03.png">1月22日(pdf 268 KB)</a></td>
            <td><p>月曜日</p></td>
            <td><p>議会の構成、議案等上程及び採決</p></td>
          </tr>
        </tbody>
      </table>
    `;

    const result = parseInfoPage(html, "令和6(2024)年第1回議会臨時会(1月22日)会議録");
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-01-22");
    expect(result[0]!.pdfHash).toBe("664ae92678c34");
  });

  it("和暦の完全な日付テキスト（令和X年MM月DD日）も解析できる", () => {
    const html = `
      <table>
        <tr>
          <td><a href="../manage/contents/upload/abc1234567890a.pdf">令和元年6月10日(pdf 100 KB)</a></td>
          <td>月</td>
          <td>一般質問</td>
        </tr>
      </table>
    `;

    const result = parseInfoPage(html, "令和元(2019)年第3回議会定例会(6月)会議録");
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2019-06-10");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseInfoPage("", "タイトル")).toEqual([]);
  });
});
