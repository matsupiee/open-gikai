import { describe, expect, it } from "vitest";
import { parseDetailPage, parseListPage } from "./list";

const YEAR_INDEX_URL = "https://vill.toho-info.com/50000/50400/r7/index.html";

describe("parseListPage", () => {
  it("年度別一覧ページから会議録リンクを抽出する（新形式 post-N.html）", () => {
    const html = `
      <div class="entry-content">
        <ul>
          <li><a href="post-747.html">令和7年第7回東峰村議会定例会</a></li>
          <li><a href="post-731.html">令和7年第6回東峰村議会臨時会</a></li>
          <li><a href="post-730.html">令和7年第5回東峰村議会定例会</a></li>
        </ul>
      </div>
    `;

    const pages = parseListPage(html, YEAR_INDEX_URL);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.title).toBe("令和7年第7回東峰村議会定例会");
    expect(pages[0]!.pageUrl).toBe(
      "https://vill.toho-info.com/50000/50400/r7/post-747.html",
    );
    expect(pages[1]!.title).toBe("令和7年第6回東峰村議会臨時会");
    expect(pages[2]!.title).toBe("令和7年第5回東峰村議会定例会");
  });

  it("旧形式（数値列.html）のリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="289281267.html">平成28年第9回定例会</a></li>
        <li><a href="288289913.html">平成28年第8回定例会</a></li>
      </ul>
    `;

    const oldYearIndexUrl =
      "https://vill.toho-info.com/50000/50400/50401/index.html";
    const pages = parseListPage(html, oldYearIndexUrl);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.title).toBe("平成28年第9回定例会");
    expect(pages[0]!.pageUrl).toBe(
      "https://vill.toho-info.com/50000/50400/50401/289281267.html",
    );
  });

  it("混在形式（4-3.html）のリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="post-696.html">令和7年第3回東峰村議会臨時会</a></li>
        <li><a href="4-3.html">令和7年第4回東峰村議会定例会</a></li>
      </ul>
    `;

    const pages = parseListPage(html, YEAR_INDEX_URL);

    expect(pages).toHaveLength(2);
    expect(pages[1]!.pageUrl).toBe(
      "https://vill.toho-info.com/50000/50400/r7/4-3.html",
    );
  });

  it("index.html リンクはスキップする", () => {
    const html = `
      <a href="index.html">戻る</a>
      <a href="post-747.html">令和7年第7回東峰村議会定例会</a>
    `;

    const pages = parseListPage(html, YEAR_INDEX_URL);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe("令和7年第7回東峰村議会定例会");
  });

  it("絶対 URL リンクも正しく処理する", () => {
    const html = `
      <a href="https://vill.toho-info.com/50000/50400/r7/post-747.html">令和7年第7回東峰村議会定例会</a>
    `;

    const pages = parseListPage(html, YEAR_INDEX_URL);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.pageUrl).toBe(
      "https://vill.toho-info.com/50000/50400/r7/post-747.html",
    );
  });
});

describe("parseDetailPage", () => {
  it("個別ページから PDF リンクと開催日を抽出する", () => {
    const html = `
      <div class="entry-content">
        <p>令和7年12月9日〜11日</p>
        <p><a href="https://vill.toho-info.com/2025/12/24/0d27345e4595e4ea81d4598673001794.pdf">
          令和７年第７回東峰村議会定例会会議録.pdf
        </a></p>
      </div>
    `;

    const meetings = parseDetailPage(
      html,
      "令和7年第7回東峰村議会定例会",
      "https://vill.toho-info.com/50000/50400/r7/post-747.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://vill.toho-info.com/2025/12/24/0d27345e4595e4ea81d4598673001794.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2025-12-09");
    expect(meetings[0]!.title).toBe("令和7年第7回東峰村議会定例会");
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("臨時会の meetingType は extraordinary になる", () => {
    const html = `
      <div class="entry-content">
        <p>令和7年9月22日</p>
        <a href="https://vill.toho-info.com/2025/09/22/abc123.pdf">会議録.pdf</a>
      </div>
    `;

    const meetings = parseDetailPage(
      html,
      "令和7年第6回東峰村議会臨時会",
      "https://vill.toho-info.com/50000/50400/r7/post-731.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2025-09-22");
  });

  it("平成年度の日付も正しく変換する", () => {
    const html = `
      <div>
        <p>平成28年12月6日〜7日</p>
        <a href="https://vill.toho-info.com/2016/12/07/xyz789.pdf">会議録.pdf</a>
      </div>
    `;

    const meetings = parseDetailPage(
      html,
      "平成28年第9回定例会",
      "https://vill.toho-info.com/50000/50400/50401/289281267.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2016-12-06");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <div>
        <p>令和7年12月9日</p>
        <p>PDFはありません</p>
      </div>
    `;

    const meetings = parseDetailPage(
      html,
      "令和7年第7回東峰村議会定例会",
      "https://vill.toho-info.com/50000/50400/r7/post-747.html",
    );

    expect(meetings).toHaveLength(0);
  });

  it("日付が見つからない場合は空配列を返す", () => {
    const html = `
      <div>
        <a href="https://vill.toho-info.com/2025/12/24/abc123.pdf">会議録.pdf</a>
      </div>
    `;

    const meetings = parseDetailPage(
      html,
      "令和7年第7回東峰村議会定例会",
      "https://vill.toho-info.com/50000/50400/r7/post-747.html",
    );

    expect(meetings).toHaveLength(0);
  });

  it("<title> タグの全角数字日付から開催日を抽出する（実際のページ形式）", () => {
    const html = `
      <html>
        <head>
          <title>令和７年第７回東峰村議会定例会（令和７年１２月９日～１１日） | 東峰村役場ホームぺージ</title>
        </head>
        <body>
          <a href="../../../2025/12/24/0d27345e4595e4ea81d4598673001794.pdf">令和７年第７回東峰村議会定例会会議録.pdf</a>
        </body>
      </html>
    `;

    const meetings = parseDetailPage(
      html,
      "令和７年第７回東峰村議会定例会（令和７年１２月９日～１１日）",
      "https://vill.toho-info.com/50000/50400/r7/post-747.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-09");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://vill.toho-info.com/2025/12/24/0d27345e4595e4ea81d4598673001794.pdf",
    );
  });

  it("相対パス（../../../）の PDF URL を正しく解決する", () => {
    const html = `
      <html>
        <head>
          <title>令和７年第１回東峰村議会臨時会（令和７年１月１５日） | 東峰村役場</title>
        </head>
        <body>
          <a href="../../../2025/01/20/abc456def789.pdf">会議録.pdf</a>
        </body>
      </html>
    `;

    const meetings = parseDetailPage(
      html,
      "令和７年第１回東峰村議会臨時会",
      "https://vill.toho-info.com/50000/50400/r7/post-674.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://vill.toho-info.com/2025/01/20/abc456def789.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2025-01-15");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });
});
