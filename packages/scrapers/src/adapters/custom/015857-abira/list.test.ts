import { describe, expect, it } from "vitest";
import { parseListPage, parsePdfLinks, extractHeldOnFromPdfLinkText } from "./list";
import { detectMeetingType, extractHeldOnFromTitle } from "./shared";

describe("detectMeetingType", () => {
  it("議会定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和７年第8回安平町議会定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和７年第1回安平町議会臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務常任委員会")).toBe("committee");
    expect(detectMeetingType("予算審査特別委員会")).toBe("committee");
  });

  it("協議会を committee と判定する", () => {
    expect(detectMeetingType("介護保険運営協議会")).toBe("committee");
  });

  it("審議会を committee と判定する", () => {
    expect(detectMeetingType("環境審議会")).toBe("committee");
  });

  it("審査会を committee と判定する", () => {
    expect(detectMeetingType("固定資産評価審査会")).toBe("committee");
  });

  it("子ども・子育て会議を committee と判定する", () => {
    expect(detectMeetingType("子ども・子育て会議")).toBe("committee");
  });
});

describe("extractHeldOnFromTitle", () => {
  it("全角数字の和暦日付を抽出する", () => {
    expect(
      extractHeldOnFromTitle("令和７年１２月１７～１８日開催")
    ).toBe("2025-12-17");
  });

  it("半角数字の和暦日付を抽出する", () => {
    expect(
      extractHeldOnFromTitle("令和7年12月17日開催")
    ).toBe("2025-12-17");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromTitle("会議録一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("一覧ページから会議録リンクを抽出する", () => {
    const html = `
      <div id="kaigiroku_P2page-1">
        <dl class="dl-news-list">
          <dt>2026年03月04日</dt>
          <dd>
            <a href="/gyosei/kaigiroku/1925">
              【開催結果】令和７年第8回安平町議会定例会（令和７年１２月１７～１８日開催）
            </a>
          </dd>
          <dt>2026年02月05日</dt>
          <dd>
            <a href="/gyosei/kaigiroku/1920">
              【開催結果】令和7年度第1回総合教育会議（令和８年１月28日開催）
            </a>
          </dd>
        </dl>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pageId: "1925",
      title: "【開催結果】令和７年第8回安平町議会定例会（令和７年１２月１７～１８日開催）",
      publishedDate: "2026-03-04",
    });
    expect(result[1]).toEqual({
      pageId: "1920",
      title: "【開催結果】令和7年度第1回総合教育会議（令和８年１月28日開催）",
      publishedDate: "2026-02-05",
    });
  });

  it("複数ページ区画から全件取得する", () => {
    const html = `
      <div id="kaigiroku_P2page-1">
        <dl class="dl-news-list">
          <dt>2026年03月04日</dt>
          <dd>
            <a href="/gyosei/kaigiroku/1925">会議A</a>
          </dd>
        </dl>
      </div>
      <div id="kaigiroku_P2page-2">
        <dl class="dl-news-list">
          <dt>2025年11月01日</dt>
          <dd>
            <a href="/gyosei/kaigiroku/1900">会議B</a>
          </dd>
        </dl>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.pageId).toBe("1925");
    expect(result[1]!.pageId).toBe("1900");
  });

  it("重複するIDを除外する", () => {
    const html = `
      <div id="kaigiroku_P2page-1">
        <dl class="dl-news-list">
          <dt>2026年03月04日</dt>
          <dd><a href="/gyosei/kaigiroku/1925">会議A</a></dd>
          <dt>2026年03月04日</dt>
          <dd><a href="/gyosei/kaigiroku/1925">会議A（重複）</a></dd>
        </dl>
      </div>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("会議録リンクがない場合は空配列を返す", () => {
    const html = "<p>No meetings</p>";
    expect(parseListPage(html)).toEqual([]);
  });
});

describe("parsePdfLinks", () => {
  it("protocol-relative な PDF リンクを抽出する", () => {
    const html = `
      <article class="entry entry-single">
        <div class="entry-content">
          <ul>
            <li>
              <a href="//www.town.abira.lg.jp/webopen/content/123/R0712-01.pdf">
                令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）
              </a>
            </li>
          </ul>
        </div>
      </article>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      linkText: "令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）",
      pdfUrl: "https://www.town.abira.lg.jp/webopen/content/123/R0712-01.pdf",
    });
  });

  it("二重拡張子の PDF リンクを抽出する", () => {
    const html = `
      <a href="//www.town.abira.lg.jp/webopen/content/456/R0712-01.pdf.pdf">
        会議録（令和７年１２月１７日）
      </a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.abira.lg.jp/webopen/content/456/R0712-01.pdf.pdf"
    );
  });

  it("複数の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="//www.town.abira.lg.jp/webopen/content/100/R0712-01.pdf">
            会議録（令和７年１２月１７日）
          </a>
        </li>
        <li>
          <a href="//www.town.abira.lg.jp/webopen/content/100/R0712-02.pdf">
            会議録（令和７年１２月１８日）
          </a>
        </li>
      </ul>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(2);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>No PDFs here</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });
});

describe("extractHeldOnFromPdfLinkText", () => {
  it("全角数字の日付を抽出する", () => {
    expect(
      extractHeldOnFromPdfLinkText(
        "令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）"
      )
    ).toBe("2025-12-17");
  });

  it("半角数字の日付を抽出する", () => {
    expect(
      extractHeldOnFromPdfLinkText("令和7年第1回会議録（令和7年6月5日）")
    ).toBe("2025-06-05");
  });

  it("日付が含まれない場合はnullを返す", () => {
    expect(extractHeldOnFromPdfLinkText("会議録PDF")).toBeNull();
  });
});
