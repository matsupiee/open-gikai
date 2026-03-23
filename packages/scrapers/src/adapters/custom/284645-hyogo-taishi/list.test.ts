import { describe, expect, it } from "vitest";
import { parseYearPageLinks, extractPdfRecords } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年本会議会議録")).toBe(2024);
    expect(parseWarekiYear("令和7年本会議会議録")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年（平成31年）本会議会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年本会議会議録")).toBe(2018);
    expect(parseWarekiYear("平成28年本会議会議録")).toBe(2016);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第511回太子町議会定例会（12月）会議録")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第508回太子町議会臨時会（5月）会議録")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会会議録")).toBe("committee");
  });
});

describe("parseYearPageLinks", () => {
  it("年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/7320.html">令和7年本会議会議録</a></li>
        <li><a href="https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html">令和6年本会議会議録</a></li>
        <li><a href="https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/index.html">本会議会議録（平成28年以前）</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年本会議会議録",
      url: "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/7320.html",
    });
    expect(result[1]).toEqual({
      title: "令和6年本会議会議録",
      url: "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html",
    });
  });

  it("index.html へのリンクを除外する", () => {
    const html = `
      <a href="https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/index.html">本会議会議録</a>
      <a href="https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/7320.html">令和7年本会議会議録</a>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年本会議会議録");
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/7320.html">令和7年本会議会議録</a>
      <a href="https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/7320.html">令和7年本会議会議録</a>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearPageLinks(html)).toEqual([]);
  });
});

describe("extractPdfRecords", () => {
  it("令和年度のPDFリンクからセッション日情報を抽出する", () => {
    const html = `
      <h2>第511回太子町議会定例会（12月）会議録</h2>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-12mokuji_.pdf">目次 (PDFファイル: 108.4KB)</a>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-11-29.pdf">第1日（令和6年11月29日） (PDFファイル: 314.3KB)</a>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-12-20.pdf">第2日（令和6年12月20日） (PDFファイル: 280.1KB)</a>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html"
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第511回太子町議会定例会（12月）会議録 第1日（令和6年11月29日）",
      heldOn: "2024-11-29",
      pdfUrl: "https://www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-11-29.pdf",
      meetingType: "plenary",
      sessionName: "第511回太子町議会定例会（12月）会議録",
    });
    expect(result[1]!.heldOn).toBe("2024-12-20");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <h2>第508回太子町議会臨時会（5月）会議録</h2>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-5-14.pdf">第1日（令和6年5月14日） (PDFファイル: 207.7KB)</a>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-05-14");
  });

  it("目次PDFをスキップする", () => {
    const html = `
      <h2>第511回太子町議会定例会（12月）会議録</h2>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-12mokuji_.pdf">目次 (PDFファイル: 108.4KB)</a>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-06-09mokuji.pdf">目次 (PDFファイル: 90KB)</a>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-11-29.pdf">第1日（令和6年11月29日） (PDFファイル: 314.3KB)</a>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-11-29");
  });

  it("複数セッションが同一ページにある場合", () => {
    const html = `
      <h2>第511回太子町議会定例会（12月）会議録</h2>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-11-29.pdf">第1日（令和6年11月29日） (PDFファイル: 314.3KB)</a>
      <h2>第510回太子町議会定例会（9月）会議録</h2>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-9-10.pdf">第1日（令和6年9月10日） (PDFファイル: 250KB)</a>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html"
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.sessionName).toBe("第511回太子町議会定例会（12月）会議録");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.sessionName).toBe("第510回太子町議会定例会（9月）会議録");
    expect(result[1]!.heldOn).toBe("2024-09-10");
  });

  it("日付を含まないリンクを除外する", () => {
    const html = `
      <h2>第511回太子町議会定例会（12月）会議録</h2>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/schedule.pdf">議事日程 (PDFファイル: 50KB)</a>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-11-29.pdf">第1日（令和6年11月29日） (PDFファイル: 314.3KB)</a>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-11-29");
  });

  it("平成年度のPDFリンクを処理する", () => {
    const html = `
      <h2>平成30年本会議会議録 定例会（12月）</h2>
      <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/56576362.pdf">第1日（平成30年12月4日） (PDFファイル: 200KB)</a>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/1464844345550.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2018-12-04");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<h2>令和7年本会議会議録</h2><p>準備中</p>`;

    const result = extractPdfRecords(
      html,
      "https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/7320.html"
    );

    expect(result).toEqual([]);
  });
});
