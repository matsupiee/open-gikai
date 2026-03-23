import { describe, expect, it } from "vitest";
import {
  parseYearPages,
  parseMeetingLinks,
  extractSessionRecords,
} from "./list";
import { parseWarekiYear, toWareki } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和6年")).toBe(2024);
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("toWareki", () => {
  it("西暦を令和に変換する", () => {
    expect(toWareki(2025)).toBe("令和7");
    expect(toWareki(2024)).toBe("令和6");
    expect(toWareki(2019)).toBe("令和1");
  });

  it("令和以前はnullを返す", () => {
    expect(toWareki(2018)).toBeNull();
  });
});

describe("parseYearPages", () => {
  it("トップページから年度ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="../../shigikai/honkaigiroku/1005180/index.html">本会議録（令和7年）</a></li>
        <li><a href="../../shigikai/honkaigiroku/1004776/index.html">本会議録（令和6年）</a></li>
        <li><a href="../../shigikai/honkaigiroku/1004469/index.html">本会議録（令和5年）</a></li>
      </ul>
    `;

    const result = parseYearPages(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: 2025,
      nendoId: "1005180",
    });
    expect(result[1]).toEqual({
      year: 2024,
      nendoId: "1004776",
    });
    expect(result[2]).toEqual({
      year: 2023,
      nendoId: "1004469",
    });
  });

  it("年度リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearPages(html)).toEqual([]);
  });
});

describe("parseMeetingLinks", () => {
  it("年度ページから会議詳細リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="../../../shigikai/honkaigiroku/1005180/1005452.html">令和7年12月定例会会議録</a></li>
        <li><a href="../../../shigikai/honkaigiroku/1005180/1005357.html">令和7年9月定例会会議録</a></li>
        <li><a href="../../../shigikai/honkaigiroku/1005180/1005277.html">令和7年6月定例会会議録</a></li>
        <li><a href="../../../shigikai/honkaigiroku/1005180/1005183.html">令和7年2月定例会会議録</a></li>
      </ul>
    `;

    const result = parseMeetingLinks(html, "1005180");

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      title: "令和7年12月定例会会議録",
      nendoId: "1005180",
      meetingId: "1005452",
    });
    expect(result[1]).toEqual({
      title: "令和7年9月定例会会議録",
      nendoId: "1005180",
      meetingId: "1005357",
    });
  });

  it("重複するmeetingIdを除外する", () => {
    const html = `
      <a href="../../../shigikai/honkaigiroku/1005180/1005452.html">令和7年12月定例会会議録</a>
      <a href="../../../shigikai/honkaigiroku/1005180/1005452.html">令和7年12月定例会会議録（重複）</a>
    `;

    const result = parseMeetingLinks(html, "1005180");
    expect(result).toHaveLength(1);
  });
});

describe("extractSessionRecords", () => {
  it("セッション日PDFを抽出する", () => {
    const html = `
      <ul>
        <li><a href="../../../_res/projects/default_project/_page_/001/005/452/1_r07_12_giansetsumei.pdf">第1日　令和7年12月1日（開会・議案説明） （PDF 194.2KB）</a></li>
        <li><a href="../../../_res/projects/default_project/_page_/001/005/452/2_r07_12_ippansitsumon_giansitsugi.pdf">第2日　令和7年12月11日（一般質問・議案質疑） （PDF 397.7KB）</a></li>
        <li><a href="../../../_res/projects/default_project/_page_/001/005/452/3_r07_12_giansingi.pdf">第3日　令和7年12月22日（追加議案・討論・議案審議・閉会） （PDF 359.5KB）</a></li>
      </ul>
    `;

    const result = extractSessionRecords(html, "令和7年12月定例会会議録", "1005452", "1005180");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和7年12月定例会 第1日（開会・議案説明）",
      heldOn: "2025-12-01",
      pdfUrl: "https://www.city.arida.lg.jp/_res/projects/default_project/_page_/001/005/452/1_r07_12_giansetsumei.pdf",
      meetingType: "plenary",
      meetingId: "1005452",
    });
    expect(result[1]!.heldOn).toBe("2025-12-11");
    expect(result[1]!.title).toBe("令和7年12月定例会 第2日（一般質問・議案質疑）");
    expect(result[2]!.heldOn).toBe("2025-12-22");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はまだ掲載されていません。</p>";

    const result = extractSessionRecords(html, "令和7年12月定例会会議録", "1005452", "1005180");
    expect(result).toEqual([]);
  });

  it("日付のないPDFリンクは除外する", () => {
    const html = `
      <a href="../../../_res/projects/default_project/_page_/001/005/452/nittei.pdf">会期日程表 （PDF 50KB）</a>
    `;

    const result = extractSessionRecords(html, "令和7年12月定例会会議録", "1005452", "1005180");
    expect(result).toEqual([]);
  });

  it("絶対パスのPDFリンクを処理する", () => {
    const html = `
      <a href="/_res/projects/default_project/_page_/001/005/452/1_r07_12_giansetsumei.pdf">第1日　令和7年12月1日（開会） （PDF 100KB）</a>
    `;

    const result = extractSessionRecords(html, "令和7年12月定例会会議録", "1005452", "1005180");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.arida.lg.jp/_res/projects/default_project/_page_/001/005/452/1_r07_12_giansetsumei.pdf",
    );
  });

  it("令和6年の会議録を正しく処理する", () => {
    const html = `
      <a href="../../../_res/projects/default_project/_page_/001/004/898/1_r06_06_giansetsumei.pdf">第1日　令和6年6月10日（開会・議案説明） （PDF 150KB）</a>
    `;

    const result = extractSessionRecords(html, "令和6年6月定例会会議録", "1004898", "1004776");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-06-10");
    expect(result[0]!.meetingType).toBe("plenary");
  });
});
