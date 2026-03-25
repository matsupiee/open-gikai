import { describe, it, expect } from "vitest";
import { parseListPage, parseDetailPage, isMinutesPdf } from "./list";
import { parseJapaneseDate, extractYearFromTitle } from "./shared";

describe("parseListPage", () => {
  it("定例会・臨時会の会議録リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/0000006954.html">令和7年第3回定例会会議録</a></li>
        <li><a href="/0000006850.html">令和7年第1回定例会会議録</a></li>
        <li><a href="/0000004068.html">平成30年第4回定例会会議録</a></li>
      </ul>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(3);
    expect(results[0]!.pageId).toBe("0000006954");
    expect(results[0]!.title).toBe("令和7年第3回定例会会議録");
    expect(results[1]!.pageId).toBe("0000006850");
    expect(results[1]!.title).toBe("令和7年第1回定例会会議録");
    expect(results[2]!.pageId).toBe("0000004068");
    expect(results[2]!.title).toBe("平成30年第4回定例会会議録");
  });

  it("臨時会も抽出する", () => {
    const html = `
      <a href="/0000005000.html">令和6年第2回臨時会会議録</a>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("0000005000");
    expect(results[0]!.title).toBe("令和6年第2回臨時会会議録");
  });

  it("重複する pageId は除外する", () => {
    const html = `
      <a href="/0000006954.html">令和7年第3回定例会会議録</a>
      <a href="/0000006954.html">令和7年第3回定例会会議録</a>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
  });

  it("会議録リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseListPage(html);
    expect(results).toHaveLength(0);
  });

  it("10桁でないページIDのリンクは除外する", () => {
    const html = `
      <a href="/category/14-3-0-0-0.html">会議録一覧</a>
      <a href="/0000006954.html">令和7年第3回定例会会議録</a>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("0000006954");
  });
});

describe("isMinutesPdf", () => {
  it("【会議録】リンクテキストを含むものは true", () => {
    expect(isMinutesPdf("【会議録】令和7年第3回定例会(9月3日).pdf", "/some/path.pdf")).toBe(true);
  });

  it("minutes を href に含むものは true", () => {
    expect(isMinutesPdf("PDF", "/cmsfiles/contents/0000006/6954/20250903-3_minutes_day1.pdf")).toBe(true);
  });

  it("kaigiroku を href に含むものは true", () => {
    expect(isMinutesPdf("PDF", "/cmsfiles/contents/0000004/4068/301204kaigiroku.pdf")).toBe(true);
  });

  it("一般質問を含むものは true", () => {
    expect(isMinutesPdf("1.【山田太郎】令和7年第3回定例会一般質問.pdf", "/some/path.pdf")).toBe(true);
  });

  it("委員会を含むものは true", () => {
    expect(isMinutesPdf("決算特別委員会", "/some/path.pdf")).toBe(true);
  });

  it("【表紙】を含むものは false", () => {
    expect(isMinutesPdf("【表紙】令和7年第3回定例会(9月3日).pdf", "/some/path.pdf")).toBe(false);
  });

  it("frontcover を href に含むものは false", () => {
    expect(isMinutesPdf("PDF", "/cmsfiles/contents/0000006/6954/20250903-1_frontcover.pdf")).toBe(false);
  });

  it("hyoushi を href に含むものは false", () => {
    expect(isMinutesPdf("PDF", "/cmsfiles/contents/0000004/4068/20181204hyoushi.pdf")).toBe(false);
  });

  it("【議事日程】を含むものは false", () => {
    expect(isMinutesPdf("【議事日程】令和7年第3回定例会(9月3日).pdf", "/some/path.pdf")).toBe(false);
  });

  it("agenda を href に含むものは false", () => {
    expect(isMinutesPdf("PDF", "/cmsfiles/contents/0000006/6954/20250903-2_agenda.pdf")).toBe(false);
  });

  it("番号付きPDFは true (一般質問個別PDF)", () => {
    expect(isMinutesPdf("1.【田中太郎】一般質問.pdf", "/some/path.pdf")).toBe(true);
  });
});

describe("parseDetailPage", () => {
  it("会議録 PDF リンクと開催日を抽出する", () => {
    const html = `
      <html>
      <body>
        <h1>令和7年第3回定例会会議録</h1>
        <h2>本会議</h2>
        <h3>令和7年9月3日</h3>
        <div class="mol_attachfileblock">
          <ul>
            <li><a href="/cmsfiles/contents/0000006/6954/20250903-1_frontcover.pdf">【表紙】令和7年第3回定例会(9月3日).pdf</a></li>
            <li><a href="/cmsfiles/contents/0000006/6954/20250903-2_agenda.pdf">【議事日程】令和7年第3回定例会(9月3日).pdf</a></li>
            <li><a href="/cmsfiles/contents/0000006/6954/20250903-3_minutes_day1.pdf">【会議録】令和7年第3回定例会(9月3日).pdf</a></li>
          </ul>
        </div>
      </body>
      </html>
    `;

    const results = parseDetailPage(html, "0000006954");

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toBe("https://www.town.yamakita.kanagawa.jp/cmsfiles/contents/0000006/6954/20250903-3_minutes_day1.pdf");
    expect(results[0]!.heldOn).toBe("2025-09-03");
  });

  it("複数日程の会議録PDFを抽出する", () => {
    const html = `
      <h2>本会議</h2>
      <h3>令和7年9月3日</h3>
      <div class="mol_attachfileblock">
        <ul>
          <li><a href="/cmsfiles/contents/0000006/6954/20250903-3_minutes_day1.pdf">【会議録】令和7年第3回定例会(9月3日).pdf</a></li>
        </ul>
      </div>
      <h3>令和7年9月4日</h3>
      <div class="mol_attachfileblock">
        <ul>
          <li><a href="/cmsfiles/contents/0000006/6954/20250904-3_minutes_day2.pdf">【会議録】令和7年第3回定例会(9月4日).pdf</a></li>
        </ul>
      </div>
    `;

    const results = parseDetailPage(html, "0000006954");

    expect(results).toHaveLength(2);
    expect(results[0]!.heldOn).toBe("2025-09-03");
    expect(results[1]!.heldOn).toBe("2025-09-04");
  });

  it("一般質問の個別PDFも抽出する", () => {
    const html = `
      <h2>一般質問</h2>
      <h3>令和7年9月3日水曜日 質問者</h3>
      <div class="mol_attachfileblock">
        <ul>
          <li><a href="/cmsfiles/contents/0000006/6954/20250903-1_akinoriwada.pdf">1.【和田明則】令和7年第3回定例会一般質問.pdf</a></li>
        </ul>
      </div>
    `;

    const results = parseDetailPage(html, "0000006954");

    expect(results).toHaveLength(1);
    expect(results[0]!.heldOn).toBe("2025-09-03");
  });

  it("古い命名規則 (kaigiroku) の PDF も抽出する", () => {
    const html = `
      <h3>平成30年12月4日</h3>
      <div class="mol_attachfileblock">
        <ul>
          <li><a href="/cmsfiles/contents/0000004/4068/301204kaigiroku.pdf">会議録</a></li>
        </ul>
      </div>
    `;

    const results = parseDetailPage(html, "0000004068");

    expect(results).toHaveLength(1);
    expect(results[0]!.heldOn).toBe("2018-12-04");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;

    const results = parseDetailPage(html, "0000006954");
    expect(results).toHaveLength(0);
  });
});

describe("parseJapaneseDate", () => {
  it("令和の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和7年9月3日")).toBe("2025-09-03");
  });

  it("平成の日付を正しく変換する", () => {
    expect(parseJapaneseDate("平成30年12月4日")).toBe("2018-12-04");
  });

  it("令和元年（漢字「元」）を正しく変換する", () => {
    expect(parseJapaneseDate("令和元年5月1日")).toBe("2019-05-01");
  });

  it("平成元年（漢字「元」）を正しく変換する", () => {
    expect(parseJapaneseDate("平成元年4月1日")).toBe("1989-04-01");
  });

  it("全角数字の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和７年９月３日（水曜日）")).toBe("2025-09-03");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseJapaneseDate("日付情報なし")).toBeNull();
  });
});

describe("extractYearFromTitle", () => {
  it("令和7年を2025年に変換する", () => {
    expect(extractYearFromTitle("令和7年第3回定例会会議録")).toBe(2025);
  });

  it("平成30年を2018年に変換する", () => {
    expect(extractYearFromTitle("平成30年第4回定例会会議録")).toBe(2018);
  });

  it("令和元年を2019年に変換する", () => {
    expect(extractYearFromTitle("令和元年第1回定例会会議録")).toBe(2019);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});
