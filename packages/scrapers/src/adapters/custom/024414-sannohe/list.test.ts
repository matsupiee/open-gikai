import { describe, expect, it } from "vitest";
import { parseIndexPage, parseDateFromText, parseLinkMeta, parseYearPage } from "./list";

describe("parseIndexPage", () => {
  it("絶対URLの年度別ページリンクを抽出する", () => {
    const html = `
      <div class="free-layout-area">
        <a href="https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/5145.html">令和7年会議録</a>
        <a href="https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4758.html">令和6年会議録</a>
        <a href="https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4246.html">令和5年会議録</a>
      </div>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/5145.html",
    );
    expect(pages[1]!.label).toBe("令和6年会議録");
    expect(pages[1]!.url).toBe(
      "https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4758.html",
    );
    expect(pages[2]!.label).toBe("令和5年会議録");
    expect(pages[2]!.url).toBe(
      "https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4246.html",
    );
  });

  it("同一URLの重複リンクを除外する", () => {
    const html = `
      <a class="icon" href="https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4758.html">令和6年会議録</a>
      <a href="https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4758.html">令和6年会議録</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
  });

  it("パターンに合致しないリンクは無視する", () => {
    const html = `
      <a href="https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4758.html">令和6年会議録</a>
      <a href="/other/page.html">他のページ</a>
      <a href="https://example.com/">外部リンク</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和6年会議録");
  });
});

describe("parseDateFromText", () => {
  it("令和の月議会から月の1日を返す", () => {
    expect(parseDateFromText("第521回三戸町議会定例会（令和6年12月議会）会議録")).toBe("2024-12-01");
  });

  it("令和の具体的な日付を返す", () => {
    expect(parseDateFromText("第515回三戸町議会臨時会（令和6年1月29日議会）会議録")).toBe("2024-01-29");
  });

  it("令和元年をパースする", () => {
    expect(parseDateFromText("第490回三戸町議会定例会（令和元年6月議会）会議録")).toBe("2019-06-01");
  });

  it("平成の月議会から月の1日を返す", () => {
    expect(parseDateFromText("第470回三戸町議会定例会（平成31年3月議会）会議録")).toBe("2019-03-01");
  });

  it("日付を含まない場合は null を返す", () => {
    expect(parseDateFromText("議事日程")).toBeNull();
  });
});

describe("parseLinkMeta", () => {
  it("定例会のメタデータを抽出する", () => {
    const result = parseLinkMeta("第521回三戸町議会定例会（令和6年12月議会）会議録 (PDFファイル: 665.5KB)");

    expect(result).not.toBeNull();
    expect(result!.session).toBe("第521回");
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.heldOn).toBe("2024-12-01");
  });

  it("臨時会のメタデータを抽出する", () => {
    const result = parseLinkMeta("第515回三戸町議会臨時会（令和6年1月29日議会）会議録 (PDFファイル: 123.4KB)");

    expect(result).not.toBeNull();
    expect(result!.session).toBe("第515回");
    expect(result!.meetingKind).toBe("臨時会");
    expect(result!.heldOn).toBe("2024-01-29");
  });

  it("決算特別委員会のメタデータを抽出する", () => {
    const result = parseLinkMeta("第519回三戸町議会定例会（決算特別委員会）会議録 (PDFファイル: 234.5KB)");

    expect(result).not.toBeNull();
    expect(result!.session).toBe("第519回");
    expect(result!.meetingKind).toBe("決算特別委員会");
    expect(result!.heldOn).toBeNull();
  });

  it("予算特別委員会のメタデータを抽出する", () => {
    const result = parseLinkMeta("第516回三戸町議会定例会（予算特別委員会）会議録 (PDFファイル: 345.6KB)");

    expect(result).not.toBeNull();
    expect(result!.meetingKind).toBe("予算特別委員会");
  });

  it("回次がない場合は null を返す", () => {
    expect(parseLinkMeta("三戸町議会定例会会議録")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("PDF リンクとメタデータを抽出する", () => {
    const html = `
      <div class="article">
        <p class="file-link-item">
          <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/521kaigiroku.pdf">
            第521回三戸町議会定例会（令和6年12月議会）会議録 (PDFファイル: 665.5KB)
          </a>
        </p>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/520rinjikai.pdf">
            第520回三戸町議会臨時会（令和6年10月11日議会）会議録 (PDFファイル: 123.4KB)
          </a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.sannohe.aomori.jp/material/files/group/13/521kaigiroku.pdf",
    );
    expect(meetings[0]!.title).toBe("定例会 第521回");
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
    expect(meetings[0]!.section).toBe("定例会");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.sannohe.aomori.jp/material/files/group/13/520rinjikai.pdf",
    );
    expect(meetings[1]!.title).toBe("臨時会 第520回");
    expect(meetings[1]!.heldOn).toBe("2024-10-11");
    expect(meetings[1]!.section).toBe("臨時会");
  });

  it("決算特別委員会も抽出する", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/519kessantokubetu.pdf">
          第519回三戸町議会定例会（決算特別委員会）会議録 (PDFファイル: 234.5KB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("決算特別委員会 第519回");
    expect(meetings[0]!.section).toBe("決算特別委員会");
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("file-link-item クラスがないリンクは無視する", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/521kaigiroku.pdf">
          第521回三戸町議会定例会（令和6年12月議会）会議録 (PDFファイル: 665.5KB)
        </a>
      </p>
      <p>
        <a href="//www.town.sannohe.aomori.jp/material/files/group/13/other.pdf">
          その他のドキュメント
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("回次のないリンクはスキップする", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/521kaigiroku.pdf">
          第521回三戸町議会定例会（令和6年12月議会）会議録 (PDFファイル: 665.5KB)
        </a>
      </p>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/doc.pdf">
          参考資料
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });
});
