import { describe, expect, it } from "vitest";
import {
  isMokujiPdf,
  parseIndexPage,
  parseYearPage,
  extractYearFromHeldOn,
} from "./list";
import {
  detectMeetingType,
  extractYearFromTitle,
  extractHeldOnFromFileName,
} from "./shared";

describe("extractYearFromTitle", () => {
  it("令和6年を2024に変換する", () => {
    expect(extractYearFromTitle("令和6年")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(extractYearFromTitle("令和元年（平成31年）")).toBe(2019);
  });

  it("令和3年を2021に変換する", () => {
    expect(extractYearFromTitle("令和3年")).toBe(2021);
  });

  it("平成31年を2019に変換する", () => {
    expect(extractYearFromTitle("平成31年")).toBe(2019);
  });

  it("平成26年を2014に変換する", () => {
    expect(extractYearFromTitle("平成26年")).toBe(2014);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("野洲市議会定例会")).toBeNull();
  });
});

describe("extractHeldOnFromFileName", () => {
  it("_YYYYMMDD.pdf 形式のファイル名から日付を抽出する", () => {
    expect(extractHeldOnFromFileName("r7dai3kai_20250605.pdf")).toBe("2025-06-05");
  });

  it("令和7年第5回臨時会の日付を抽出する", () => {
    expect(extractHeldOnFromFileName("r7dai5kai_20251110.pdf")).toBe("2025-11-10");
  });

  it("目次 PDF はアンダースコアなしで null を返す", () => {
    expect(extractHeldOnFromFileName("r6dai6kai_mokuji.pdf")).toBeNull();
  });

  it("旧形式の数値 ID ファイル名は null を返す", () => {
    expect(extractHeldOnFromFileName("23754.pdf")).toBeNull();
  });

  it("日付パターンがないファイル名は null を返す", () => {
    expect(extractHeldOnFromFileName("kaigiroku.pdf")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和6年定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和6年臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("isMokujiPdf", () => {
  it("_mokuji.pdf で終わる URL は true", () => {
    expect(isMokujiPdf("https://www.city.yasu.lg.jp/material/files/group/2/r6dai6kai_mokuji.pdf")).toBe(true);
  });

  it("本文 PDF は false", () => {
    expect(isMokujiPdf("https://www.city.yasu.lg.jp/material/files/group/2/r7dai3kai_20250605.pdf")).toBe(false);
  });

  it("旧形式数値 ID PDF は false", () => {
    expect(isMokujiPdf("https://www.city.yasu.lg.jp/material/files/group/2/23754.pdf")).toBe(false);
  });
});

describe("parseIndexPage", () => {
  it("年度別ページ URL を抽出する（新形式）", () => {
    const html = `
      <ul>
        <li><a href="/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4457.html">令和6年</a></li>
        <li><a href="/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4456.html">令和5年</a></li>
        <li><a href="/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4455.html">令和4年</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe("https://www.city.yasu.lg.jp/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4457.html");
    expect(result[0]!.title).toBe("令和6年");
    expect(result[1]!.url).toBe("https://www.city.yasu.lg.jp/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4456.html");
    expect(result[2]!.url).toBe("https://www.city.yasu.lg.jp/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4455.html");
  });

  it("旧形式ページ URL も抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai/teirei/h23/4445.html">平成23年</a></li>
        <li><a href="/soshiki/gikai/teirei/h22/4444.html">平成22年</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe("https://www.city.yasu.lg.jp/soshiki/gikai/teirei/h23/4445.html");
    expect(result[0]!.title).toBe("平成23年");
  });

  it("重複 URL は除外する", () => {
    const html = `
      <a href="/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4457.html">令和6年</a>
      <a href="/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4457.html">令和6年（再掲）</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
  });

  it("無関係なリンクは無視する", () => {
    const html = `
      <a href="/top.html">トップ</a>
      <a href="/gyoseijoho/gikai/index.html">議会</a>
      <a href="/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4457.html">令和6年</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://www.city.yasu.lg.jp/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4457.html");
  });
});

describe("parseYearPage", () => {
  const yearPageUrl = "https://www.city.yasu.lg.jp/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/4457.html";

  it("本文 PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/2/r7dai3kai_mokuji.pdf">目次</a></li>
        <li><a href="/material/files/group/2/r7dai3kai_20250605.pdf">6月5日 会議録</a></li>
        <li><a href="/material/files/group/2/r7dai3kai_20250606.pdf">6月6日 会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, "令和7年", yearPageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe("https://www.city.yasu.lg.jp/material/files/group/2/r7dai3kai_20250605.pdf");
    expect(result[0]!.sessionTitle).toBe("令和7年");
    expect(result[0]!.heldOn).toBe("2025-06-05");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.yearPageUrl).toBe(yearPageUrl);

    expect(result[1]!.pdfUrl).toBe("https://www.city.yasu.lg.jp/material/files/group/2/r7dai3kai_20250606.pdf");
    expect(result[1]!.heldOn).toBe("2025-06-06");
  });

  it("目次 PDF は除外する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/2/r6dai6kai_mokuji.pdf">目次</a></li>
        <li><a href="/material/files/group/2/r6dai6kai_20241205.pdf">12月5日 会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, "令和6年", yearPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-12-05");
  });

  it("臨時会 PDF を correctly に抽出する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/2/r7dai5kai_20251110.pdf">11月10日 会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, "令和7年臨時会", yearPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2025-11-10");
  });

  it("重複 PDF URL は除外する", () => {
    const html = `
      <a href="/material/files/group/2/r7dai3kai_20250605.pdf">6月5日</a>
      <a href="/material/files/group/2/r7dai3kai_20250605.pdf">6月5日（再掲）</a>
    `;

    const result = parseYearPage(html, "令和7年", yearPageUrl);

    expect(result).toHaveLength(1);
  });

  it("旧形式数値 ID の PDF も抽出する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/2/23754.pdf">会議録</a></li>
        <li><a href="/material/files/group/2/23755.pdf">会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, "平成23年", yearPageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBeNull();
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li>会議録はありません</li>
      </ul>
    `;

    const result = parseYearPage(html, "令和7年", yearPageUrl);

    expect(result).toHaveLength(0);
  });
});

describe("extractYearFromHeldOn", () => {
  it("YYYY-MM-DD から年を抽出する", () => {
    expect(extractYearFromHeldOn("2024-03-01")).toBe(2024);
  });

  it("null の場合は null を返す", () => {
    expect(extractYearFromHeldOn(null)).toBeNull();
  });

  it("不正なフォーマットの場合は null を返す", () => {
    expect(extractYearFromHeldOn("invalid")).toBeNull();
  });
});
