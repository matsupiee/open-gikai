import { describe, it, expect } from "vitest";
import {
  parseYearFromTitle,
  parseContentLabel,
  parseDateFromLinkText,
  parseMeetingPageUrls,
  parseMeetingPageTitle,
  parsePdfLinks,
} from "./list";

describe("parseYearFromTitle", () => {
  it("「令和6年内灘町議会12月会議会議録」から2024を返す", () => {
    expect(parseYearFromTitle("令和6年内灘町議会12月会議会議録")).toBe(2024);
  });

  it("「令和元年内灘町議会9月会議会議録」から2019を返す", () => {
    expect(parseYearFromTitle("令和元年内灘町議会9月会議会議録")).toBe(2019);
  });

  it("「平成30年内灘町議会3月会議会議録」から2018を返す", () => {
    expect(parseYearFromTitle("平成30年内灘町議会3月会議会議録")).toBe(2018);
  });

  it("年度情報がない場合は null を返す", () => {
    expect(parseYearFromTitle("内灘町議会会議録")).toBeNull();
  });
});

describe("parseContentLabel", () => {
  it("【月日】とPDFファイルサイズ情報を除去する", () => {
    expect(
      parseContentLabel("町政一般質問【12月5日】[PDFファイル／689KB]")
    ).toBe("町政一般質問");
  });

  it("【月日】がない場合はPDFファイルサイズ情報のみ除去する", () => {
    expect(
      parseContentLabel("再開・提案理由の説明[PDFファイル／500KB]")
    ).toBe("再開・提案理由の説明");
  });

  it("余分な空白を除去する", () => {
    expect(
      parseContentLabel("委員長報告・採決【12月12日】[PDFファイル／300KB]")
    ).toBe("委員長報告・採決");
  });

  it("サイズ情報がない場合もそのまま返す", () => {
    expect(parseContentLabel("再開・提案理由の説明【12月3日】")).toBe(
      "再開・提案理由の説明"
    );
  });
});

describe("parseDateFromLinkText", () => {
  it("「町政一般質問【12月5日】[PDFファイル／689KB]」から2024-12-05を返す", () => {
    expect(
      parseDateFromLinkText(
        "町政一般質問【12月5日】[PDFファイル／689KB]",
        2024
      )
    ).toBe("2024-12-05");
  });

  it("1桁月日もゼロパディングする", () => {
    expect(
      parseDateFromLinkText("再開・提案理由の説明【3月1日】[PDFファイル／500KB]", 2025)
    ).toBe("2025-03-01");
  });

  it("【月日】がない場合は null を返す", () => {
    expect(parseDateFromLinkText("再開・提案理由の説明", 2024)).toBeNull();
  });
});

describe("parseMeetingPageUrls", () => {
  it("/soshiki/gikai/{ID}.html へのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai/19094.html">令和6年12月会議</a></li>
        <li><a href="/soshiki/gikai/18500.html">令和6年9月会議</a></li>
        <li><a href="/site/gikai/22389.html">別ページ</a></li>
        <li><a href="/uploaded/attachment/1234.pdf">PDF</a></li>
      </ul>
    `;
    const urls = parseMeetingPageUrls(html);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(
      "https://www.town.uchinada.lg.jp/soshiki/gikai/19094.html"
    );
    expect(urls[1]).toBe(
      "https://www.town.uchinada.lg.jp/soshiki/gikai/18500.html"
    );
  });

  it("重複した URL は除外する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai/19094.html">令和6年12月会議その1</a></li>
        <li><a href="/soshiki/gikai/19094.html">令和6年12月会議その2</a></li>
      </ul>
    `;
    const urls = parseMeetingPageUrls(html);
    expect(urls).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>リンクなし</p></div>`;
    expect(parseMeetingPageUrls(html)).toHaveLength(0);
  });
});

describe("parseMeetingPageTitle", () => {
  it("<h1> タグからタイトルを抽出する", () => {
    const html = `
      <html>
        <body>
          <h1 class="title">令和6年内灘町議会12月会議会議録</h1>
          <p>本文</p>
        </body>
      </html>
    `;
    expect(parseMeetingPageTitle(html)).toBe("令和6年内灘町議会12月会議会議録");
  });

  it("h1 内の HTML タグを除去する", () => {
    const html = `<h1><span>令和6年内灘町議会12月会議会議録</span></h1>`;
    expect(parseMeetingPageTitle(html)).toBe("令和6年内灘町議会12月会議会議録");
  });

  it("h1 がない場合は空文字を返す", () => {
    const html = `<div><p>タイトルなし</p></div>`;
    expect(parseMeetingPageTitle(html)).toBe("");
  });
});

describe("parsePdfLinks", () => {
  it("PDF リンクとメタ情報を正しく抽出する", () => {
    const html = `
      <div class="contents">
        <h1>令和6年内灘町議会12月会議会議録</h1>
        <ul>
          <li>
            <a href="/uploaded/attachment/12345.pdf">
              再開・提案理由の説明【12月3日】[PDFファイル／500KB]
            </a>
          </li>
          <li>
            <a href="/uploaded/attachment/12346.pdf">
              町政一般質問【12月5日】[PDFファイル／689KB]
            </a>
          </li>
          <li>
            <a href="/uploaded/attachment/12347.pdf">
              委員長報告・採決【12月12日】[PDFファイル／300KB]
            </a>
          </li>
        </ul>
      </div>
    `;

    const pageTitle = "令和6年内灘町議会12月会議会議録";
    const meetingPageUrl =
      "https://www.town.uchinada.lg.jp/soshiki/gikai/19094.html";
    const meetings = parsePdfLinks(html, pageTitle, 2024, meetingPageUrl);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.uchinada.lg.jp/uploaded/attachment/12345.pdf"
    );
    expect(meetings[0]!.pageTitle).toBe("令和6年内灘町議会12月会議会議録");
    expect(meetings[0]!.contentLabel).toBe("再開・提案理由の説明");
    expect(meetings[0]!.heldOn).toBe("2024-12-03");
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.meetingPageUrl).toBe(meetingPageUrl);

    expect(meetings[1]!.contentLabel).toBe("町政一般質問");
    expect(meetings[1]!.heldOn).toBe("2024-12-05");

    expect(meetings[2]!.contentLabel).toBe("委員長報告・採決");
    expect(meetings[2]!.heldOn).toBe("2024-12-12");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません</p></div>`;
    const meetings = parsePdfLinks(html, "タイトル", 2024, "https://example.com");
    expect(meetings).toHaveLength(0);
  });

  it("/uploaded/attachment/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/123.pdf">有効【1月1日】</a>
        <a href="/other/path/456.pdf">無効</a>
      </div>
    `;
    const meetings = parsePdfLinks(html, "タイトル", 2024, "https://example.com");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("/uploaded/attachment/123.pdf");
  });
});
