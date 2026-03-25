import { describe, it, expect } from "vitest";
import {
  parseYearFromH2,
  cleanTitle,
  parseDateString,
  parseDateRange,
  parseListPage,
} from "./list";

describe("parseYearFromH2", () => {
  it("「令和7年津幡町議会　会議録」から2025を返す", () => {
    expect(parseYearFromH2("令和7年津幡町議会　会議録")).toBe(2025);
  });

  it("「令和元年津幡町議会　会議録」から2019を返す", () => {
    expect(parseYearFromH2("令和元年津幡町議会　会議録")).toBe(2019);
  });

  it("「平成30年津幡町議会　会議録」から2018を返す", () => {
    expect(parseYearFromH2("平成30年津幡町議会　会議録")).toBe(2018);
  });

  it("「平成21年津幡町議会　会議録」から2009を返す", () => {
    expect(parseYearFromH2("平成21年津幡町議会　会議録")).toBe(2009);
  });

  it("年度が含まれない場合は null を返す", () => {
    expect(parseYearFromH2("津幡町議会　会議録")).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("ファイルサイズ情報を除去する", () => {
    expect(cleanTitle("津幡町議会12月会議 [PDFファイル／1.82MB]")).toBe(
      "津幡町議会12月会議"
    );
  });

  it("ファイルサイズ情報がない場合はそのまま返す", () => {
    expect(cleanTitle("津幡町議会12月会議")).toBe("津幡町議会12月会議");
  });

  it("前後の空白を除去する", () => {
    expect(cleanTitle("  津幡町議会12月会議  ")).toBe("津幡町議会12月会議");
  });

  it("複数形式のファイルサイズ表記に対応する", () => {
    expect(cleanTitle("第2回津幡町議会定例会12月会議 [PDFファイル／500KB]")).toBe(
      "第2回津幡町議会定例会12月会議"
    );
  });
});

describe("parseDateString", () => {
  it("「令和7年12月4日」を「2025-12-04」に変換する", () => {
    expect(parseDateString("令和7年12月4日")).toBe("2025-12-04");
  });

  it("「令和8年1月21日」を「2026-01-21」に変換する", () => {
    expect(parseDateString("令和8年1月21日")).toBe("2026-01-21");
  });

  it("「令和元年9月10日」を「2019-09-10」に変換する", () => {
    expect(parseDateString("令和元年9月10日")).toBe("2019-09-10");
  });

  it("「平成30年3月5日」を「2018-03-05」に変換する", () => {
    expect(parseDateString("平成30年3月5日")).toBe("2018-03-05");
  });

  it("1桁の月日も正しくゼロパディングする", () => {
    expect(parseDateString("令和6年8月5日")).toBe("2024-08-05");
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseDateString("令和7年")).toBeNull();
  });
});

describe("parseDateRange", () => {
  it("「（令和7年12月4日～12月11日）」を正しく分解する", () => {
    const result = parseDateRange("（令和7年12月4日～12月11日）");
    expect(result.start).toBe("2025-12-04");
    expect(result.end).toBe("2025-12-11");
  });

  it("「（令和8年1月21日）」（単日）を正しく分解する", () => {
    const result = parseDateRange("（令和8年1月21日）");
    expect(result.start).toBe("2026-01-21");
    expect(result.end).toBeNull();
  });

  it("「（令和6年9月3日～9月10日）」を正しく分解する", () => {
    const result = parseDateRange("（令和6年9月3日～9月10日）");
    expect(result.start).toBe("2024-09-03");
    expect(result.end).toBe("2024-09-10");
  });

  it("日程情報がない場合は start/end ともに null を返す", () => {
    const result = parseDateRange("（日程未定）");
    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
  });
});

describe("parseListPage", () => {
  it("年度見出しとPDFリンクを正しく抽出する", () => {
    const html = `
      <div class="contents">
        <h2>令和7年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/6442.pdf">津幡町議会12月会議 [PDFファイル／1.82MB]</a>（令和7年12月4日～12月11日）</li>
          <li><a href="/uploaded/attachment/6400.pdf">津幡町議会9月会議 [PDFファイル／1.5MB]</a>（令和7年9月2日～9月9日）</li>
        </ul>
        <h2>令和6年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/6100.pdf">津幡町議会12月会議 [PDFファイル／1.7MB]</a>（令和6年12月3日～12月10日）</li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.tsubata.lg.jp/uploaded/attachment/6442.pdf"
    );
    expect(meetings[0]!.title).toBe("津幡町議会12月会議");
    expect(meetings[0]!.heldOn).toBe("2025-12-04");
    expect(meetings[0]!.heldUntil).toBe("2025-12-11");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.isProvisional).toBe(false);

    expect(meetings[2]!.year).toBe(2024);
    expect(meetings[2]!.heldOn).toBe("2024-12-03");
  });

  it("targetYear でフィルタリングできる", () => {
    const html = `
      <div class="contents">
        <h2>令和7年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/6442.pdf">津幡町議会12月会議 [PDFファイル／1.82MB]</a>（令和7年12月4日～12月11日）</li>
        </ul>
        <h2>令和6年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/6100.pdf">津幡町議会12月会議 [PDFファイル／1.7MB]</a>（令和6年12月3日～12月10日）</li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2025);
  });

  it("速報版セクション内のリンクは isProvisional=true になる", () => {
    const html = `
      <div class="contents">
        <h2>議会会議録　速報版</h2>
        <ul>
          <li><a href="/uploaded/attachment/9999.pdf">津幡町議会3月会議（速報版） [PDFファイル／1.0MB]</a>（令和8年3月5日～3月12日）</li>
        </ul>
        <h2>令和8年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/6500.pdf">津幡町議会1月会議 [PDFファイル／1.2MB]</a>（令和8年1月21日）</li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html);

    const provisional = meetings.find((m) => m.isProvisional);
    expect(provisional).toBeDefined();
    expect(provisional!.pdfUrl).toBe(
      "https://www.town.tsubata.lg.jp/uploaded/attachment/9999.pdf"
    );

    const official = meetings.find((m) => !m.isProvisional);
    expect(official).toBeDefined();
    expect(official!.year).toBe(2026);
  });

  it("単日開催の場合は heldUntil が null になる", () => {
    const html = `
      <div class="contents">
        <h2>令和8年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/6500.pdf">津幡町議会1月会議 [PDFファイル／1.2MB]</a>（令和8年1月21日）</li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2026-01-21");
    expect(meetings[0]!.heldUntil).toBeNull();
  });

  it("平成期の会議録も正しく抽出する", () => {
    const html = `
      <div class="contents">
        <h2>平成30年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/5000.pdf">津幡町議会3月会議 [PDFファイル／1.5MB]</a>（平成30年3月6日～3月13日）</li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2018);
    expect(meetings[0]!.heldOn).toBe("2018-03-06");
    expect(meetings[0]!.heldUntil).toBe("2018-03-13");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div class="contents"><p>会議録はありません</p></div>`;
    expect(parseListPage(html)).toHaveLength(0);
  });

  it("uploaded/attachment を含まないリンクはスキップする", () => {
    const html = `
      <div class="contents">
        <h2>令和7年津幡町議会　会議録</h2>
        <ul>
          <li><a href="/uploaded/attachment/6442.pdf">津幡町議会12月会議 [PDFファイル／1.82MB]</a>（令和7年12月4日）</li>
          <li><a href="/page/1738.html">その他ページ</a></li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });
});
