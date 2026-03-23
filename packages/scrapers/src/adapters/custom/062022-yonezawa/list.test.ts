import { describe, it, expect } from "vitest";
import {
  parseIndexPage,
  parseSessionPage,
  parseDateFromFilename,
} from "./list";

describe("parseDateFromFilename", () => {
  it("令和の定例会 PDF ファイル名から日付を抽出する", () => {
    expect(parseDateFromFilename("r06-12t-01-1205.pdf")).toBe("2024-12-05");
  });

  it("令和の臨時会 PDF ファイル名から日付を抽出する", () => {
    expect(parseDateFromFilename("r07-02r-01-0203.pdf")).toBe("2025-02-03");
  });

  it("平成の PDF ファイル名から日付を抽出する", () => {
    expect(parseDateFromFilename("h30-06t-02-0614.pdf")).toBe("2018-06-14");
  });

  it("非議事録 PDF にはマッチしない", () => {
    expect(parseDateFromFilename("teireikainittei_2412-fin.pdf")).toBeNull();
    expect(parseDateFromFilename("youshi_2412.pdf")).toBeNull();
  });
});

const INDEX_HTML = `
<h2><span class="bg"><span class="bg2"><span class="bg3">令和7年</span></span></span></h2>
<div>
  <h3>3月定例会</h3>
  <p class="link-item"><a class="icon" href="https://www.city.yonezawa.yamagata.jp/soshiki/12/1037/5/1/R6/9035.html">令和7年3月定例会</a></p>
  <p>一般質問15人</p>
  <h3>6月定例会</h3>
  <p class="link-item"><a class="icon" href="https://www.city.yonezawa.yamagata.jp/soshiki/12/1037/5/1/R7/10345.html">令和7年6月定例会</a></p>
  <p>一般質問17人</p>
  <p class="file-link-item"><a class="pdf" href="//www.city.yonezawa.yamagata.jp/material/files/group/38/r07-02r-01-0203.pdf">2月臨時会 (PDFファイル: 319.5KB)</a></p>
</div>
<h2><span class="bg"><span class="bg2"><span class="bg3">令和6年</span></span></span></h2>
<div>
  <h3>3月定例会</h3>
  <p class="link-item"><a class="icon" href="https://www.city.yonezawa.yamagata.jp/soshiki/12/1037/5/1/13/8024.html">令和6年3月定例会</a></p>
</div>
`;

describe("parseIndexPage", () => {
  it("令和7年のセッションページ URL を抽出する", () => {
    const result = parseIndexPage(INDEX_HTML, "令和", 7);

    expect(result.sessionPageUrls.length).toBe(2);
    expect(result.sessionPageUrls[0]!.url).toBe(
      "https://www.city.yonezawa.yamagata.jp/soshiki/12/1037/5/1/R6/9035.html"
    );
    expect(result.sessionPageUrls[0]!.sessionName).toBe("3月定例会");
    expect(result.sessionPageUrls[1]!.sessionName).toBe("6月定例会");
  });

  it("臨時会 PDF リンクを直接抽出する", () => {
    const result = parseIndexPage(INDEX_HTML, "令和", 7);

    expect(result.directPdfs.length).toBe(1);
    expect(result.directPdfs[0]!.pdfUrl).toBe(
      "https://www.city.yonezawa.yamagata.jp/material/files/group/38/r07-02r-01-0203.pdf"
    );
    expect(result.directPdfs[0]!.heldOn).toBe("2025-02-03");
    expect(result.directPdfs[0]!.sessionName).toBe("2月臨時会");
  });

  it("令和6年のセッションページ URL を抽出する", () => {
    const result = parseIndexPage(INDEX_HTML, "令和", 6);

    expect(result.sessionPageUrls.length).toBe(1);
    expect(result.sessionPageUrls[0]!.sessionName).toBe("3月定例会");
  });

  it("存在しない年は空を返す", () => {
    const result = parseIndexPage(INDEX_HTML, "令和", 99);

    expect(result.sessionPageUrls.length).toBe(0);
    expect(result.directPdfs.length).toBe(0);
  });
});

const SESSION_HTML = `
<div>
  <a href="//www.city.yonezawa.yamagata.jp/material/files/group/38/teireikainittei_2412-fin.pdf">定例会日程 (PDFファイル: 52.1KB)</a>
  <a href="//www.city.yonezawa.yamagata.jp/material/files/group/38/youshi_2412.pdf">一般質問の要旨 (PDFファイル: 311.7KB)</a>
  <a href="//www.city.yonezawa.yamagata.jp/material/files/group/38/r06-12t-01-1205.pdf">12月5日（木曜日） (PDFファイル: 400KB)</a>
  <a href="//www.city.yonezawa.yamagata.jp/material/files/group/38/r06-12t-02-1209.pdf">12月9日（月曜日） (PDFファイル: 500KB)</a>
  <a href="//www.city.yonezawa.yamagata.jp/material/files/group/38/r06-12t-03-1210.pdf">12月10日（火曜日） (PDFファイル: 600KB)</a>
</div>
`;

describe("parseSessionPage", () => {
  it("議事録 PDF リンクのみを抽出する（スケジュール・要旨はスキップ）", () => {
    const meetings = parseSessionPage(SESSION_HTML, "12月定例会");

    expect(meetings.length).toBe(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.yonezawa.yamagata.jp/material/files/group/38/r06-12t-01-1205.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2024-12-05");
    expect(meetings[0]!.title).toBe("12月定例会");

    expect(meetings[1]!.heldOn).toBe("2024-12-09");
    expect(meetings[2]!.heldOn).toBe("2024-12-10");
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="//www.city.yonezawa.yamagata.jp/material/files/group/38/r06-12t-01-1205.pdf">リンク1</a>
      <a href="//www.city.yonezawa.yamagata.jp/material/files/group/38/r06-12t-01-1205.pdf">リンク2</a>
    `;
    const meetings = parseSessionPage(html, "12月定例会");
    expect(meetings.length).toBe(1);
  });
});
