import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearPage, extractDateFromTitle } from "./list";

describe("parseIndexPage", () => {
  it("対象年に対応する年度ページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/minutes/1/index.html">議会の会議録（平成30年以前）</a></li>
        <li><a href="/gikai/minutes/807.html">議会の会議録（令和2年）</a></li>
        <li><a href="/gikai/minutes/810.html">議会の会議録（令和6年度）</a></li>
        <li><a href="/gikai/minutes/811.html">議会の会議録（令和5年度）</a></li>
        <li><a href="/gikai/minutes/20260304kaigiroku12gatukaigi.html">議会の会議録（令和7年度）</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2024);

    // 令和6年度（2024）と令和5年度（2023=2024-1）が対象
    expect(urls).toContain(
      "https://www.town.minamisanriku.miyagi.jp/gikai/minutes/810.html"
    );
    expect(urls).toContain(
      "https://www.town.minamisanriku.miyagi.jp/gikai/minutes/811.html"
    );
    // 令和7年度（2025）と令和2年（2020）は対象外
    expect(urls).not.toContain(
      "https://www.town.minamisanriku.miyagi.jp/gikai/minutes/20260304kaigiroku12gatukaigi.html"
    );
    expect(urls).not.toContain(
      "https://www.town.minamisanriku.miyagi.jp/gikai/minutes/807.html"
    );
  });

  it("令和元年のリンクも処理できる", () => {
    const html = `
      <ul>
        <li><a href="/gikai/minutes/858.html">議会の会議録（令和元年）</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2019);
    expect(urls).toContain(
      "https://www.town.minamisanriku.miyagi.jp/gikai/minutes/858.html"
    );
  });

  it("一覧ページ自体は除外する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/minutes/index.html">会議録一覧</a></li>
        <li><a href="/gikai/minutes/810.html">議会の会議録（令和6年度）</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2024);
    expect(urls).not.toContain(
      "https://www.town.minamisanriku.miyagi.jp/gikai/minutes/index.html"
    );
  });

  it("対象年に対応するページがない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/gikai/minutes/810.html">議会の会議録（令和6年度）</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2030);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("h2 見出し配下の PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年度12月会議</h2>
      <p><a href="//www.town.minamisanriku.miyagi.jp/material/files/group/16/r06-12t-01-1203.pdf">令和6年度12月会議会議録（1日目 12月3日開催） (PDFファイル: 633.8KB)</a></p>
      <p><a href="//www.town.minamisanriku.miyagi.jp/material/files/group/16/r06-12t-02-1204.pdf">令和6年度12月会議会議録（2日目 12月4日開催） (PDFファイル: 720.1KB)</a></p>
      <h2>令和6年度9月会議</h2>
      <p><a href="//www.town.minamisanriku.miyagi.jp/material/files/group/16/r06-09t-01-0903.pdf">令和6年度9月会議会議録（1日目 9月3日開催） (PDFファイル: 776.9KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.minamisanriku.miyagi.jp/material/files/group/16/r06-12t-01-1203.pdf"
    );
    expect(meetings[0]!.title).toBe(
      "令和6年度12月会議会議録（1日目 12月3日開催）"
    );
    expect(meetings[0]!.heldOn).toBe("2024-12-03");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.heldOn).toBe("2024-12-04");

    expect(meetings[2]!.heldOn).toBe("2024-09-03");
  });

  it("委員会の PDF は meetingType が committee になる", () => {
    const html = `
      <h2>令和5年度決算審査特別委員会</h2>
      <p><a href="//www.town.minamisanriku.miyagi.jp/material/files/group/16/r06-k-01-0909.pdf">令和5年度決算審査特別委員会会議の記録（1日目 9月9日） (PDFファイル: 612.8KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
    expect(meetings[0]!.heldOn).toBe("2024-09-09");
  });

  it("1月会議は翌暦年（年度+1）として処理される", () => {
    const html = `
      <h2>令和6年度1月会議</h2>
      <p><a href="//www.town.minamisanriku.miyagi.jp/material/files/group/16/r07-01t-01-0130.pdf">令和6年度1月会議会議録（1月30日開催） (PDFファイル: 673.5KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-01-30");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和6年度会議録</h2>
      <p>準備中</p>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });
});

describe("extractDateFromTitle", () => {
  it("月日パターンから開催日を抽出する（4月以降は同年）", () => {
    expect(extractDateFromTitle("令和6年度12月会議会議録（1日目 12月3日開催）", 2024)).toBe(
      "2024-12-03"
    );
    expect(extractDateFromTitle("令和6年度9月会議会議録（1日目 9月3日開催）", 2024)).toBe(
      "2024-09-03"
    );
    expect(extractDateFromTitle("令和6年度6月会議会議録（1日目 6月4日開催）", 2024)).toBe(
      "2024-06-04"
    );
  });

  it("1〜3月は年度+1の暦年として処理される", () => {
    expect(extractDateFromTitle("令和6年度1月会議会議録（1月30日開催）", 2024)).toBe(
      "2025-01-30"
    );
    expect(extractDateFromTitle("令和6年度3月会議会議録（1日目 3月4日開催）", 2024)).toBe(
      "2025-03-04"
    );
  });

  it("完全な日付パターンが含まれる場合はそれを優先する", () => {
    expect(
      extractDateFromTitle("令和6年12月3日の会議録", 2024)
    ).toBe("2024-12-03");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(extractDateFromTitle("令和6年度会議録", 2024)).toBeNull();
  });
});
