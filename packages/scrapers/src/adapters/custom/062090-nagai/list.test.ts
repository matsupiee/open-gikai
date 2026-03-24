import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseSessionPage,
} from "./list";
import { parseDateFromFilename, parseEraYear } from "./shared";

describe("parseDateFromFilename", () => {
  it("令和7年1月24日の通常 PDF ファイル名から日付を抽出する", () => {
    expect(parseDateFromFilename("nagaigikai_R7_01_24.pdf")).toBe("2025-01-24");
  });

  it("令和7年3月4日の開議 PDF ファイル名から日付を抽出する", () => {
    expect(parseDateFromFilename("nagaigikai_R7_03_04_kaigi.pdf")).toBe(
      "2025-03-04",
    );
  });

  it("予算委員会 PDF ファイル名から日付を抽出する", () => {
    expect(parseDateFromFilename("nagaigikai_yosan_R7_03_13_kaigi.pdf")).toBe(
      "2025-03-13",
    );
  });

  it("平成の PDF ファイル名から日付を抽出する", () => {
    expect(parseDateFromFilename("nagaigikai_H28_06_15.pdf")).toBe("2016-06-15");
  });

  it("対象外のファイル名には null を返す", () => {
    expect(parseDateFromFilename("other_document.pdf")).toBeNull();
    expect(parseDateFromFilename("schedule_2025.pdf")).toBeNull();
  });
});

describe("parseEraYear", () => {
  it("令和7年を西暦に変換する", () => {
    expect(parseEraYear("令和7年")).toBe(2025);
  });

  it("令和元年を西暦に変換する", () => {
    expect(parseEraYear("令和元年")).toBe(2019);
  });

  it("平成16年を西暦に変換する", () => {
    expect(parseEraYear("平成16年")).toBe(2004);
  });

  it("全角数字を含む年を変換する", () => {
    expect(parseEraYear("令和７年")).toBe(2025);
  });

  it("和暦を含まないテキストには null を返す", () => {
    expect(parseEraYear("2025年")).toBeNull();
  });
});

const TOP_HTML = `
<div class="section">
  <ul>
    <li><a href="/shigikai/kaigiroku/15203.html">令和7年</a></li>
    <li><a href="/shigikai/kaigiroku/14055.html">令和6年</a></li>
    <li><a href="/shigikai/kaigiroku/12001.html">令和5年</a></li>
    <li><a href="/shigikai/kaigiroku/10500.html">平成31年・令和元年</a></li>
    <li><a href="/shigikai/kaigiroku/8888.html">平成16年</a></li>
  </ul>
</div>
`;

describe("parseTopPage", () => {
  it("年度別ページのURLと年を抽出する", () => {
    const results = parseTopPage(TOP_HTML);

    expect(results.length).toBeGreaterThanOrEqual(2);

    const r7 = results.find((r) => r.year === 2025);
    expect(r7).toBeDefined();
    expect(r7!.url).toBe(
      "https://www.city.nagai.yamagata.jp/shigikai/kaigiroku/15203.html",
    );

    const r6 = results.find((r) => r.year === 2024);
    expect(r6).toBeDefined();
    expect(r6!.url).toBe(
      "https://www.city.nagai.yamagata.jp/shigikai/kaigiroku/14055.html",
    );
  });

  it("平成の年度も抽出する", () => {
    const results = parseTopPage(TOP_HTML);
    const h16 = results.find((r) => r.year === 2004);
    expect(h16).toBeDefined();
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/shigikai/kaigiroku/15203.html">令和7年</a>
      <a href="/shigikai/kaigiroku/15203.html">令和7年</a>
    `;
    const results = parseTopPage(html);
    expect(results.length).toBe(1);
  });
});

const YEAR_HTML = `
<div class="section">
  <ul>
    <li><a href="/soshiki/gikai/106/203/1/kaigiroku/r7/15057.html">1月臨時会、3月定例会会議録</a></li>
    <li><a href="/soshiki/gikai/106/203/1/kaigiroku/r7/15058.html">5月臨時会、6月定例会会議録</a></li>
    <li><a href="/soshiki/gikai/106/203/1/kaigiroku/r7/15059.html">9月定例会会議録</a></li>
    <li><a href="/shigikai/kaigiroku/index.html">会議録トップへ戻る</a></li>
  </ul>
</div>
`;

describe("parseYearPage", () => {
  it("会期別ページの URL とセッション名を抽出する", () => {
    const results = parseYearPage(YEAR_HTML);

    expect(results.length).toBe(3);
    expect(results[0]!.url).toBe(
      "https://www.city.nagai.yamagata.jp/soshiki/gikai/106/203/1/kaigiroku/r7/15057.html",
    );
    expect(results[0]!.sessionName).toBe("1月臨時会、3月定例会会議録");
    expect(results[1]!.sessionName).toBe("5月臨時会、6月定例会会議録");
    expect(results[2]!.sessionName).toBe("9月定例会会議録");
  });

  it("会議録・定例会・臨時会を含まないリンクはスキップする", () => {
    const results = parseYearPage(YEAR_HTML);
    expect(results.every((r) => !r.url.includes("index.html"))).toBe(true);
  });
});

const SESSION_HTML = `
<div class="section">
  <p>令和7年3月定例会の会議録です。</p>
  <ul>
    <li><a href="/material/files/group/19/nagaigikai_R7_03_04_kaigi.pdf">3月4日（火曜日）開議</a></li>
    <li><a href="/material/files/group/19/nagaigikai_R7_03_10.pdf">3月10日（月曜日）</a></li>
    <li><a href="/material/files/group/19/nagaigikai_R7_03_18.pdf">3月18日（火曜日）</a></li>
    <li><a href="/material/files/group/19/schedule_2025.pdf">会議日程</a></li>
  </ul>
</div>
`;

describe("parseSessionPage", () => {
  it("material/files/group/19 配下の PDF リンクを抽出する", () => {
    const meetings = parseSessionPage(SESSION_HTML, "3月定例会会議録");

    expect(meetings.length).toBe(3);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.nagai.yamagata.jp/material/files/group/19/nagaigikai_R7_03_04_kaigi.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2025-03-04");
    expect(meetings[0]!.sessionName).toBe("3月定例会会議録");
  });

  it("parseDateFromFilename でパースできない PDF はスキップする", () => {
    const meetings = parseSessionPage(SESSION_HTML, "3月定例会会議録");
    // schedule_2025.pdf はパースできないためスキップされる
    expect(meetings.every((m) => m.heldOn !== null)).toBe(true);
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="/material/files/group/19/nagaigikai_R7_03_04_kaigi.pdf">リンク1</a>
      <a href="/material/files/group/19/nagaigikai_R7_03_04_kaigi.pdf">リンク2</a>
    `;
    const meetings = parseSessionPage(html, "3月定例会会議録");
    expect(meetings.length).toBe(1);
  });
});
