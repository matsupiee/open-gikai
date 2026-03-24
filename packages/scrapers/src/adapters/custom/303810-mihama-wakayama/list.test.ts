import { describe, expect, it } from "vitest";
import { extractYearPageUrls, parsePdfLinks, parsePdfLinkText } from "./list";

describe("extractYearPageUrls", () => {
  it("/docs/{ID}/ 形式のリンクを抽出する", () => {
    const html = `
      <div class="units">
        <ul>
          <li><a href="/docs/2024061700011/">令和6年度 会議録</a></li>
          <li><a href="/docs/2023060600018/">令和5年度 会議録</a></li>
          <li><a href="/bunya/gikai_kaigiroku/gikai/">一覧へ</a></li>
        </ul>
      </div>
    `;

    const urls = extractYearPageUrls(html);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("http://www.town.mihama.wakayama.jp/docs/2024061700011/");
    expect(urls[1]).toBe("http://www.town.mihama.wakayama.jp/docs/2023060600018/");
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/docs/2024061700011/">令和6年度</a>
      <a href="/docs/2024061700011/">令和6年度（再掲）</a>
    `;

    const urls = extractYearPageUrls(html);
    expect(urls).toHaveLength(1);
  });

  it("PDF リンクをスキップする", () => {
    const html = `
      <a href="/docs/2024061700011/">年度ページ</a>
      <a href="/docs/2024061700011/files/0712teirei1.pdf">PDF</a>
    `;

    // /docs/{ID}/ 形式のみ取得（後続スラッシュあり）
    const urls = extractYearPageUrls(html);
    // PDF URL は /docs/{ID}/files/... なので /docs/{ID}/ だけ抽出される
    expect(urls.every((u) => u.endsWith("/"))).toBe(true);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(extractYearPageUrls(html)).toEqual([]);
  });
});

describe("parsePdfLinkText", () => {
  it("目次 PDF は null を返す", () => {
    const result = parsePdfLinkText("第４回定例会目次(86KB)", "令和７年 第４回（１２月）定例会");
    expect(result).toBeNull();
  });

  it("定例会 PDF のタイトルと会議種別を返す", () => {
    const result = parsePdfLinkText(
      "第４回定例会（第１日）(266KB)",
      "令和７年 第４回（１２月）定例会",
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和７年 第４回（１２月）定例会 第４回定例会（第１日）");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBeNull();
  });

  it("臨時会 PDF の会議種別を返す", () => {
    const result = parsePdfLinkText(
      "第１回臨時会（第１日）(150KB)",
      "令和７年 第１回臨時会",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });
});

describe("parsePdfLinks", () => {
  it("年度別記事ページ HTML から PDF セッション情報を抽出する", () => {
    const html = `
      <html><body>
      <div class="body">
        <h2>令和７年 第４回（１２月）定例会</h2>
        <p><a class="iconFile iconPdf" href="./files/0712mokuzi.pdf">第４回定例会目次(86KB)</a></p>
        <p><a class="iconFile iconPdf" href="./files/0712teirei1.pdf">第４回定例会（第１日）(266KB)</a></p>
        <p><a class="iconFile iconPdf" href="./files/0712teirei2.pdf">第４回定例会（第２日）(300KB)</a></p>
        <h2>令和７年 第１回臨時会</h2>
        <p><a class="iconFile iconPdf" href="./files/0710mokuzi.pdf">第１回臨時会目次(50KB)</a></p>
        <p><a class="iconFile iconPdf" href="./files/0710rinzi.pdf">第１回臨時会（第１日）(150KB)</a></p>
      </div>
      </body></html>
    `;

    const yearPageUrl = "http://www.town.mihama.wakayama.jp/docs/2025032100014/";
    const results = parsePdfLinks(html, yearPageUrl);

    expect(results).toHaveLength(3);

    expect(results[0]!.title).toBe("令和７年 第４回（１２月）定例会 第４回定例会（第１日）");
    expect(results[0]!.pdfUrl).toBe(
      "http://www.town.mihama.wakayama.jp/docs/2025032100014/files/0712teirei1.pdf",
    );
    expect(results[0]!.meetingType).toBe("plenary");
    expect(results[0]!.heldOn).toBeNull();
    expect(results[0]!.yearPageUrl).toBe(yearPageUrl);

    expect(results[1]!.title).toBe("令和７年 第４回（１２月）定例会 第４回定例会（第２日）");
    expect(results[1]!.meetingType).toBe("plenary");

    expect(results[2]!.title).toBe("令和７年 第１回臨時会 第１回臨時会（第１日）");
    expect(results[2]!.meetingType).toBe("extraordinary");
  });

  it("div.body が存在しない場合は空配列を返す", () => {
    const html = "<html><body><p>コンテンツなし</p></body></html>";
    const results = parsePdfLinks(html, "http://example.com/docs/123/");
    expect(results).toEqual([]);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <div class="body">
        <h2>令和７年 第４回（１２月）定例会</h2>
        <p>準備中です。</p>
      </div>
    `;
    const results = parsePdfLinks(html, "http://example.com/docs/123/");
    expect(results).toEqual([]);
  });

  it("目次 PDF のみの場合は空配列を返す", () => {
    const html = `
      <div class="body">
        <h2>令和７年 第４回（１２月）定例会</h2>
        <p><a href="./files/0712mokuzi.pdf">第４回定例会目次(86KB)</a></p>
      </div>
    `;
    const results = parsePdfLinks(html, "http://example.com/docs/123/");
    expect(results).toEqual([]);
  });
});
