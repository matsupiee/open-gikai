import { describe, expect, it } from "vitest";
import { parseListPage, parsePdfLinks } from "./list";
import { parseWarekiYear, detectMeetingType, parseJapaneseDate } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第1回定例会")).toBe(2025);
    expect(parseWarekiYear("令和6年第4回定例会")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回臨時会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成28年第4回定例会(10月)議事録")).toBe(2016);
    expect(parseWarekiYear("平成25年第1回臨時会")).toBe(2013);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("議事録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("平成28年第4回定例会(10月)議事録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("平成28年第3回臨時会(9月)議事録")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("総務委員会議事録")).toBe("committee");
  });
});

describe("parseJapaneseDate", () => {
  it("日本語日付を ISO 形式に変換する", () => {
    expect(parseJapaneseDate("2016年12月8日")).toBe("2016-12-08");
    expect(parseJapaneseDate("2013年6月3日")).toBe("2013-06-03");
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseJapaneseDate("文字列")).toBeNull();
    expect(parseJapaneseDate("")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("一覧ページからエントリを抽出する", () => {
    const html = `
      <html>
      <body>
      <div class="archive">
        <h3><span class="listDate">[2016年12月8日]&nbsp;</span><span class="listTitle"><a href="https://www.city.kamiamakusa.kumamoto.jp/q/aview/389/7679.html" title="平成28年　第4回臨時会(10月)会議録">平成28年　第4回臨時会(10月)会議録</a></span></h3>
      </div>
      <div class="archive">
        <h3><span class="listDate">[2016年12月8日]&nbsp;</span><span class="listTitle"><a href="https://www.city.kamiamakusa.kumamoto.jp/q/aview/389/7677.html" title="平成28年　第3回臨時会(9月)会議録">平成28年　第3回臨時会(9月)会議録</a></span></h3>
      </div>
      <div class="archive">
        <h3><span class="listDate">[2016年9月1日]&nbsp;</span><span class="listTitle"><a href="https://www.city.kamiamakusa.kumamoto.jp/q/aview/389/7331.html" title="平成28年　第2回臨時会(6月)会議録">平成28年　第2回臨時会(6月)会議録</a></span></h3>
      </div>
      </body>
      </html>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe("7679");
    expect(result[0]!.title).toBe("平成28年　第4回臨時会(10月)会議録");
    expect(result[0]!.postedOn).toBe("2016-12-08");
    expect(result[0]!.detailUrl).toBe(
      "https://www.city.kamiamakusa.kumamoto.jp/q/aview/389/7679.html"
    );
    expect(result[1]!.id).toBe("7677");
    expect(result[1]!.postedOn).toBe("2016-12-08");
    expect(result[2]!.id).toBe("7331");
    expect(result[2]!.postedOn).toBe("2016-09-01");
  });

  it("重複する ID を除外する", () => {
    const html = `
      <h3><span class="listDate">[2016年12月8日]</span><span class="listTitle"><a href="https://www.city.kamiamakusa.kumamoto.jp/q/aview/389/7679.html">議事録A</a></span></h3>
      <h3><span class="listDate">[2016年12月8日]</span><span class="listTitle"><a href="https://www.city.kamiamakusa.kumamoto.jp/q/aview/389/7679.html">議事録A（重複）</a></span></h3>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("7679");
  });

  it("エントリがない場合は空配列を返す", () => {
    const html = "<html><body><p>No items</p></body></html>";
    expect(parseListPage(html)).toEqual([]);
  });
});

describe("parsePdfLinks", () => {
  it("詳細ページから PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="/dl?q=15437_filelib_bafa9783a44999599f954d22bc797058.pdf">1巻目（PDF 約186KB）</a>
      </div>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.city.kamiamakusa.kumamoto.jp/dl?q=15437_filelib_bafa9783a44999599f954d22bc797058.pdf"
    );
  });

  it("複数の PDF リンクを抽出する", () => {
    const html = `
      <a href="/dl?q=15397_filelib_09b18540305131b361d193a347b9189f.pdf">1章</a>
      <a href="/dl?q=15398_filelib_9924d2be792df5052108fa611090d986.pdf">7章</a>
      <a href="/dl?q=15399_filelib_ff131e060ccbd026b7f33803788554b2.pdf">8章</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(
      "https://www.city.kamiamakusa.kumamoto.jp/dl?q=15397_filelib_09b18540305131b361d193a347b9189f.pdf"
    );
    expect(result[1]).toBe(
      "https://www.city.kamiamakusa.kumamoto.jp/dl?q=15398_filelib_9924d2be792df5052108fa611090d986.pdf"
    );
    expect(result[2]).toBe(
      "https://www.city.kamiamakusa.kumamoto.jp/dl?q=15399_filelib_ff131e060ccbd026b7f33803788554b2.pdf"
    );
  });

  it("重複する PDF リンクを除外する", () => {
    const html = `
      <a href="/dl?q=15397_filelib_abc.pdf">1章</a>
      <a href="/dl?q=15397_filelib_abc.pdf">1章（重複）</a>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<div><a href='/other/link'>テキスト</a></div>";
    expect(parsePdfLinks(html)).toEqual([]);
  });
});
