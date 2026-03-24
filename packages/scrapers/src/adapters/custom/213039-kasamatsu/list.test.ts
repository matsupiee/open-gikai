import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parseYearPage } from "./list";

describe("parseYearPageLinks", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/docs/2024031100018/">令和6年議会会議録</a></li>
          <li><a href="/docs/2023030100012/">令和5年議会会議録</a></li>
          <li><a href="/docs/2022050900015/">令和4年会議録</a></li>
          <li><a href="/about/">関係ないリンク</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseYearPageLinks(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.kasamatsu.gifu.jp/docs/2024031100018/");
    expect(urls[1]).toBe("https://www.town.kasamatsu.gifu.jp/docs/2023030100012/");
    expect(urls[2]).toBe("https://www.town.kasamatsu.gifu.jp/docs/2022050900015/");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/docs/2024031100018/">令和6年議会会議録</a></li>
        <li><a href="/docs/2024031100018/">令和6年議会会議録</a></li>
      </ul>
    `;

    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(1);
  });

  it("会議録リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("PDF リンクとメタ情報を抽出する（相対パスを年度ページ URL で解決）", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li>
            <a href="file_contents/R05-4teireikai-1gou-R051205.pdf">
              第4回定例会(第1号)　令和5年12月5日(PDF形式406KB)
            </a>
          </li>
          <li>
            <a href="file_contents/R05-3rinnjikai-1gou-R050725.pdf">
              第3回臨時会（第1号）　令和5年7月25日(PDF形式200KB)
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.kasamatsu.gifu.jp/docs/2023030100012/";

    const meetings = parseYearPage(html, pageUrl);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kasamatsu.gifu.jp/docs/2023030100012/file_contents/R05-4teireikai-1gou-R051205.pdf",
    );
    expect(meetings[0]!.title).toBe("第4回定例会(第1号)");
    expect(meetings[0]!.heldOn).toBe("2023-12-05");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.kasamatsu.gifu.jp/docs/2023030100012/file_contents/R05-3rinnjikai-1gou-R050725.pdf",
    );
    expect(meetings[1]!.title).toBe("第3回臨時会（第1号）");
    expect(meetings[1]!.heldOn).toBe("2023-07-25");
  });

  it("タイムスタンプ形式のファイル名も処理できる", () => {
    const html = `
      <ul>
        <li>
          <a href="file_contents/file_2026216110227_1.pdf">
            第4回臨時会（第1号）　令和7年12月22日(PDF形式304KBytes)
          </a>
        </li>
      </ul>
    `;
    const pageUrl = "https://www.town.kasamatsu.gifu.jp/docs/2025030500045/";

    const meetings = parseYearPage(html, pageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kasamatsu.gifu.jp/docs/2025030500045/file_contents/file_2026216110227_1.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2025-12-22");
  });

  it("令和6年のファイル名パターン（アンダースコア区切り）も処理できる", () => {
    const html = `
      <ul>
        <li>
          <a href="file_contents/R06_4teireikai-1gou-R061206.pdf">
            第4回定例会(第1号)　令和6年12月6日(PDF形式350KB)
          </a>
        </li>
      </ul>
    `;
    const pageUrl = "https://www.town.kasamatsu.gifu.jp/docs/2024031100018/";

    const meetings = parseYearPage(html, pageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-06");
  });

  it("開催日が解析できないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="file_contents/unknown.pdf">会議録（日付なし）</a></li>
        <li>
          <a href="file_contents/R05-4teireikai-1gou-R051205.pdf">
            第4回定例会(第1号)　令和5年12月5日(PDF形式406KB)
          </a>
        </li>
      </ul>
    `;
    const pageUrl = "https://www.town.kasamatsu.gifu.jp/docs/2023030100012/";

    const meetings = parseYearPage(html, pageUrl);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-12-05");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const pageUrl = "https://www.town.kasamatsu.gifu.jp/docs/2024031100018/";
    const meetings = parseYearPage(html, pageUrl);
    expect(meetings).toHaveLength(0);
  });

  it("平成の日付も正しくパースする", () => {
    const html = `
      <ul>
        <li>
          <a href="file_contents/H30-1teireikai.pdf">
            第1回定例会(第1号)　平成30年3月20日(PDF形式300KB)
          </a>
        </li>
      </ul>
    `;
    const pageUrl = "https://www.town.kasamatsu.gifu.jp/docs/2018061500030/";

    const meetings = parseYearPage(html, pageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-03-20");
  });
});
