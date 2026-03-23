import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parsePublishedDate, detectMeetingType } from "./shared";

describe("parsePublishedDate", () => {
  it("YYYY年M月D日 を YYYY-MM-DD に変換する", () => {
    expect(parsePublishedDate("2025年11月26日")).toBe("2025-11-26");
    expect(parsePublishedDate("2024年12月10日")).toBe("2024-12-10");
    expect(parsePublishedDate("2023年8月8日")).toBe("2023-08-08");
  });

  it("YYYY/MM/DD を YYYY-MM-DD に変換する", () => {
    expect(parsePublishedDate("2025/11/26")).toBe("2025-11-26");
    expect(parsePublishedDate("2023/08/08")).toBe("2023-08-08");
  });

  it("マッチしない場合は null を返す", () => {
    expect(parsePublishedDate("2025-11-26")).toBeNull();
    expect(parsePublishedDate("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和7年第3回(9月)定例会議録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和8年第1回(1月)臨時会議録")).toBe("extraordinary");
  });
});

describe("parseListPage", () => {
  it("/q/aview/282/ へのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
      <h3><span class="listDate">[2026年1月30日]&nbsp;</span><span class="listTitle"><a href="/q/aview/282/5578.html" title="令和8年第1回(1月)臨時会会議録">令和8年第1回(1月)臨時会会議録</a></span></h3>
      <h3><span class="listDate">[2025年4月21日]&nbsp;</span><span class="listTitle"><a href="/q/aview/282/5113.html" title="令和7年第1回(3月)定例会会議録">令和7年第1回(3月)定例会会議録</a></span></h3>
      <h3><span class="listDate">[2023年8月8日]&nbsp;</span><span class="listTitle"><a href="/q/aview/282/3966.html" title="令和5年第2回(6月)定例会会議録">令和5年第2回(6月)定例会会議録</a></span></h3>
      </body>
      </html>
    `;

    const records = parseListPage(html);

    expect(records).toHaveLength(3);

    expect(records[0]!.articleId).toBe("5578");
    expect(records[0]!.title).toBe("令和8年第1回(1月)臨時会会議録");
    expect(records[0]!.publishedDate).toBe("2026-01-30");
    expect(records[0]!.meetingType).toBe("extraordinary");
    expect(records[0]!.detailUrl).toBe(
      "https://www.town.kumamoto-kashima.lg.jp/q/aview/282/5578.html",
    );

    expect(records[1]!.articleId).toBe("5113");
    expect(records[1]!.title).toBe("令和7年第1回(3月)定例会会議録");
    expect(records[1]!.publishedDate).toBe("2025-04-21");
    expect(records[1]!.meetingType).toBe("plenary");

    expect(records[2]!.articleId).toBe("3966");
    expect(records[2]!.publishedDate).toBe("2023-08-08");
  });

  it("公開日がないリンクはスキップする", () => {
    const html = `
      <h3>
        <a href="/q/aview/282/9999.html">公開日なしの議録</a>
      </h3>
    `;

    const records = parseListPage(html);
    expect(records).toHaveLength(0);
  });

  it("同じ articleId の重複を除外する", () => {
    const html = `
      <h3><span class="listDate">[2025年1月15日]</span><span class="listTitle"><a href="/q/aview/282/1234.html">会議録</a></span></h3>
      <h3><span class="listDate">[2025年1月15日]</span><span class="listTitle"><a href="/q/aview/282/1234.html">会議録（重複）</a></span></h3>
    `;

    const records = parseListPage(html);
    expect(records).toHaveLength(1);
  });

  it("/q/aview/282/ 以外のリンクは無視する", () => {
    const html = `
      <h3><span class="listDate">[2025年3月1日]</span><a href="/q/list/282.html">一覧に戻る</a></h3>
      <h3><span class="listDate">[2025年3月1日]</span><a href="/other/page.html">別のページ</a></h3>
      <h3><span class="listDate">[2025年3月1日]</span><span class="listTitle"><a href="/q/aview/282/5100.html">会議録</a></span></h3>
    `;

    const records = parseListPage(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.articleId).toBe("5100");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<html><body><p>コンテンツなし</p></body></html>";
    expect(parseListPage(html)).toEqual([]);
  });
});
