import { describe, expect, it } from "vitest";
import { parseYearPageUrls, parseYearPage } from "./list";

describe("parseYearPageUrls", () => {
  it("指定年度の年度別ページ URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.kawai.nara.jp/10/1_1/1/2/1951.html">定例会 会議録(平成23年)</a></li>
        <li><a href="https://www.town.kawai.nara.jp/10/1_1/1/2/6722gikai.html">定例会 会議録 令和6年</a></li>
        <li><a href="https://www.town.kawai.nara.jp/10/1_1/1/2/7122.html">定例会 会議録 令和7年</a></li>
      </ul>
    `;

    const urls = parseYearPageUrls(html, 2024);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.kawai.nara.jp/10/1_1/1/2/6722gikai.html");
  });

  it("平成年度の URL を正しく抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.kawai.nara.jp/10/1_1/1/2/1951.html">定例会 会議録(平成23年)</a></li>
        <li><a href="https://www.town.kawai.nara.jp/10/1_1/1/2/6722gikai.html">定例会 会議録 令和6年</a></li>
      </ul>
    `;

    const urls = parseYearPageUrls(html, 2011);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.kawai.nara.jp/10/1_1/1/2/1951.html");
  });

  it("対象年が存在しない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.kawai.nara.jp/10/1_1/1/2/7122.html">定例会 会議録 令和7年</a></li>
      </ul>
    `;

    const urls = parseYearPageUrls(html, 2020);

    expect(urls).toHaveLength(0);
  });

  it("プロトコル相対 URL を https: に補完する", () => {
    const html = `
      <ul>
        <li><a href="//www.town.kawai.nara.jp/10/1_1/1/2/6722gikai.html">定例会 会議録 令和6年</a></li>
      </ul>
    `;

    const urls = parseYearPageUrls(html, 2024);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.kawai.nara.jp/10/1_1/1/2/6722gikai.html");
  });
});

describe("parseYearPage", () => {
  it("h2 セクションと PDF リンクを正しく抽出する", () => {
    const html = `
      <h2><span><span><span>第3回9月（定例会）</span></span></span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/6961.pdf">（9月6日初日） (PDFファイル: 346.2KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/69102.pdf">（9月10日一般質問） (PDFファイル: 647.3KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/69264.pdf">（9月26日最終日） (PDFファイル: 533.8KB)</a></p>
      <h2><span><span><span>第2回6月（定例会）</span></span></span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/6671.pdf">（6月7日初日） (PDFファイル: 416.8KB)</a></p>
    `;

    const records = parseYearPage(html, 2024);

    expect(records).toHaveLength(4);

    expect(records[0]!.title).toBe("第3回（9月）定例会 9月6日 初日");
    expect(records[0]!.heldOn).toBe("2024-09-06");
    expect(records[0]!.pdfUrl).toBe("https://www.town.kawai.nara.jp/material/files/group/9/6961.pdf");
    expect(records[0]!.meetingType).toBe("plenary");

    expect(records[1]!.title).toBe("第3回（9月）定例会 9月10日 一般質問");
    expect(records[1]!.heldOn).toBe("2024-09-10");

    expect(records[2]!.title).toBe("第3回（9月）定例会 9月26日 最終日");
    expect(records[2]!.heldOn).toBe("2024-09-26");

    expect(records[3]!.title).toBe("第2回（6月）定例会 6月7日 初日");
    expect(records[3]!.heldOn).toBe("2024-06-07");
  });

  it("12月の日付を正しくパースする", () => {
    const html = `
      <h2><span><span><span>第4回12月（定例会）</span></span></span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/1261.pdf">（12月6日初日） (PDFファイル: 336.1KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/612184.pdf">（12月18日最終日） (PDFファイル: 241.5KB)</a></p>
    `;

    const records = parseYearPage(html, 2024);

    expect(records).toHaveLength(2);
    expect(records[0]!.heldOn).toBe("2024-12-06");
    expect(records[1]!.heldOn).toBe("2024-12-18");
  });

  it("PDF がない場合は空配列を返す", () => {
    const html = `
      <h2><span>第1回3月（定例会）</span></h2>
      <p>準備中</p>
    `;

    const records = parseYearPage(html, 2024);

    expect(records).toHaveLength(0);
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <h2><span>第3回9月（定例会）</span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/6961.pdf">（9月6日初日） (PDFファイル: 346.2KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kawai.nara.jp/material/files/group/9/6961.pdf">（9月6日初日） (PDFファイル: 346.2KB)</a></p>
    `;

    const records = parseYearPage(html, 2024);

    expect(records).toHaveLength(1);
  });
});
