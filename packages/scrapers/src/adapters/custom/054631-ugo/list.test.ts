import { describe, expect, it } from "vitest";
import {
  extractYearFromPage,
  parseYearPageUrlsFromArchive,
  extractPdfRecords,
  splitIntoH2Sections,
  inferHeldOn,
} from "./list";

describe("extractYearFromPage", () => {
  it("h2 から令和７年を 2025 として取得する", () => {
    const html = `<h2>令和７年１２月定例会</h2><p>...</p>`;
    expect(extractYearFromPage(html)).toBe(2025);
  });

  it("h2 から令和６年を 2024 として取得する", () => {
    const html = `<h2>令和６年３月定例会</h2><p>...</p>`;
    expect(extractYearFromPage(html)).toBe(2024);
  });

  it("h2 がない場合は null を返す", () => {
    const html = `<p>何もありません</p>`;
    expect(extractYearFromPage(html)).toBeNull();
  });
});

describe("parseYearPageUrlsFromArchive", () => {
  it("指定年に対応する年度ページ URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/administration/detail.html?id=3231&category_id=51">令和６年会議録</a></li>
        <li><a href="/administration/detail.html?id=3103&category_id=46">令和５年会議録</a></li>
        <li><a href="/administration/detail.html?id=2947&category_id=51">令和４年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrlsFromArchive(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.ugo.lg.jp/administration/detail.html?id=3231&category_id=51");
  });

  it("令和５年（2023）のページを取得する", () => {
    const html = `
      <ul>
        <li><a href="/administration/detail.html?id=3103&category_id=46">令和５年会議録</a></li>
        <li><a href="/administration/detail.html?id=2947&category_id=51">令和４年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrlsFromArchive(html, 2023);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.ugo.lg.jp/administration/detail.html?id=3103&category_id=46");
  });

  it("対応する年度がない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/administration/detail.html?id=3231&category_id=51">令和６年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrlsFromArchive(html, 2020);
    expect(result).toHaveLength(0);
  });

  it("絶対 URL をそのまま返す", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.ugo.lg.jp/administration/detail.html?id=3231&category_id=51">令和６年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrlsFromArchive(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.ugo.lg.jp/administration/detail.html?id=3231&category_id=51");
  });
});

describe("splitIntoH2Sections", () => {
  it("h2 タグでセクションに分割する", () => {
    const html = `
      <h2>令和７年１２月臨時会</h2>
      <p><a href="/uploads/user/gikaijimu/File/2025議会/foo.pdf">第１日</a></p>
      <h2>令和７年１２月定例会</h2>
      <p><a href="/uploads/user/gikaijimu/File/2025議会/bar.pdf">第１日</a></p>
    `;

    const sections = splitIntoH2Sections(html);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.heading).toBe("令和７年１２月臨時会");
    expect(sections[1]!.heading).toBe("令和７年１２月定例会");
  });

  it("h2 がない場合は空配列を返す", () => {
    const html = `<p>会議録はありません</p>`;
    const sections = splitIntoH2Sections(html);
    expect(sections).toHaveLength(0);
  });
});

describe("extractPdfRecords", () => {
  it("複数の h2 セクションから PDF レコードを抽出する", () => {
    const html = `
      <h2>令和７年１２月臨時会</h2>
      <p><a href="/uploads/user/gikaijimu/File/2025%E8%AD%B0%E4%BC%9A/%E4%BB%A4%E5%92%8C%EF%BC%97%E5%B9%B4%EF%BC%91%EF%BC%92%E6%9C%88%E8%87%A8%E6%99%82%E4%BC%9A%E4%BC%9A%E8%AD%B0%E9%8C%B2%EF%BC%88%E7%AC%AC%EF%BC%91%E6%97%A5%EF%BC%89.pdf">第１日</a></p>
      <h2>令和７年１２月定例会</h2>
      <p><a href="/uploads/user/gikaijimu/File/2025%E8%AD%B0%E4%BC%9A/bar.pdf">第１日</a></p>
      <p><a href="/uploads/user/gikaijimu/File/2025%E8%AD%B0%E4%BC%9A/bar2.pdf">第２日</a></p>
    `;

    const yearPageUrl = "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51";
    const result = extractPdfRecords(html, yearPageUrl, 2025);

    expect(result).toHaveLength(3);
    expect(result[0]!.meetingName).toBe("令和７年１２月臨時会");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.pdfLabel).toBe("第１日");
    expect(result[0]!.title).toBe("令和７年１２月臨時会 第１日");
    expect(result[0]!.heldOn).toBe("2025-12-01");

    expect(result[1]!.meetingName).toBe("令和７年１２月定例会");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[1]!.heldOn).toBe("2025-12-01");

    expect(result[2]!.pdfLabel).toBe("第２日");
  });

  it("委員会セクションの meetingType が committee になる", () => {
    const html = `
      <h2>令和７年３月予算特別委員会</h2>
      <p><a href="/uploads/user/gikaijimu/File/2025議会/committee.pdf">第１日</a></p>
    `;

    const result = extractPdfRecords(html, "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51", 2025);
    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("committee");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和７年１２月定例会</h2>
      <p>準備中です</p>
    `;

    const result = extractPdfRecords(html, "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51", 2025);
    expect(result).toHaveLength(0);
  });

  it("h2 がない場合は空配列を返す", () => {
    const html = `<p><a href="/uploads/user/gikaijimu/File/2025議会/foo.pdf">第１日</a></p>`;
    const result = extractPdfRecords(html, "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51", 2025);
    expect(result).toHaveLength(0);
  });
});

describe("inferHeldOn", () => {
  it("令和７年１２月定例会 → 2025-12-01", () => {
    expect(inferHeldOn("令和７年１２月定例会", "第１日", 2025)).toBe("2025-12-01");
  });

  it("令和７年３月定例会 → 2025-03-01", () => {
    expect(inferHeldOn("令和７年３月定例会", "第１日", 2025)).toBe("2025-03-01");
  });

  it("令和６年９月臨時会 → 2024-09-01", () => {
    expect(inferHeldOn("令和６年９月臨時会", "第１日", 2024)).toBe("2024-09-01");
  });

  it("月情報がない場合は null を返す", () => {
    expect(inferHeldOn("羽後町議会会議録", "第１日", 2025)).toBeNull();
  });
});
