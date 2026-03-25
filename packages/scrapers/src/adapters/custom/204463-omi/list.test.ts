import { describe, expect, it } from "vitest";
import { parseListPage, parseSessionName, parseYearFromHeading } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和元年")).toBe(2019);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年")).toBe(2019);
    expect(parseWarekiYear("平成元年")).toBe(1989);
    expect(parseWarekiYear("平成25年")).toBe(2013);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("定例会")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("3月定例会")).toBe("plenary");
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
    expect(detectMeetingType("1月臨時会")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearFromHeading", () => {
  it("令和年を抽出する", () => {
    expect(parseYearFromHeading("令和7年議事録")).toBe("令和7年");
    expect(parseYearFromHeading("令和6年議事録")).toBe("令和6年");
  });

  it("平成年を抽出する", () => {
    expect(parseYearFromHeading("平成31年議事録")).toBe("平成31年");
    expect(parseYearFromHeading("平成25年議事録")).toBe("平成25年");
  });

  it("全角数字の年度に対応する", () => {
    expect(parseYearFromHeading("令和７年議事録")).toBe("令和7年");
    expect(parseYearFromHeading("令和６年議事録")).toBe("令和6年");
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseYearFromHeading("その他情報")).toBeNull();
  });
});

describe("parseSessionName", () => {
  it("月定例会を抽出する", () => {
    expect(parseSessionName("3月定例会　議事録 (1.5MB)")).toBe("3月定例会");
    expect(parseSessionName("12月定例会　議事録 (1.2MB)")).toBe("12月定例会");
  });

  it("第N回定例会を抽出する", () => {
    expect(parseSessionName("第1回定例会　議事録 (1.5MB)")).toBe("第1回定例会");
    expect(parseSessionName("第4回定例会　議事録 (1.2MB)")).toBe("第4回定例会");
  });

  it("臨時会を抽出する", () => {
    expect(parseSessionName("第1回臨時会　議事録 (215.9KB)")).toBe("第1回臨時会");
    expect(parseSessionName("1月臨時会　議事録 (200KB)")).toBe("1月臨時会");
  });

  it("全角数字の会議名に対応する", () => {
    expect(parseSessionName("第１回定例会　議事録 (1.5MB)")).toBe("第1回定例会");
  });

  it("会議名が抽出できない場合は null を返す", () => {
    expect(parseSessionName("会議録 (1.5MB)")).toBeNull();
    expect(parseSessionName("")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h2 見出しと ul リスト構造から PDF レコードを抽出する", () => {
    const html = `
      <div class="c-entry-body">
        <h2>令和7年議事録</h2>
        <ul class="c-list-horizontal">
          <li>
            <a href="/files/gikaijimukyoku/令和7年第1回定例会.pdf" target="_blank" rel="noopener">
              3月定例会　議事録 (1.5MB)
            </a>
          </li>
          <li>
            <a href="/files/gikaijimukyoku/令和7年第2回定例会.pdf" target="_blank" rel="noopener">
              6月定例会　議事録 (1.2MB)
            </a>
          </li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年3月定例会");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.omi.nagano.jp/files/gikaijimukyoku/令和7年第1回定例会.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.title).toBe("令和7年6月定例会");
    expect(result[1]!.year).toBe(2025);
  });

  it("全角ファイル名を含む href を正しく扱う", () => {
    const html = `
      <div class="c-entry-body">
        <h2>令和６年議事録</h2>
        <ul class="c-list-horizontal">
          <li>
            <a href="/files/gikaijimukyoku/令和６年第４回定例会.pdf">
              12月定例会　議事録 (1.2MB)
            </a>
          </li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年12月定例会");
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.omi.nagano.jp/files/gikaijimukyoku/令和６年第４回定例会.pdf",
    );
  });

  it("臨時会が正しくパースされる", () => {
    const html = `
      <div class="c-entry-body">
        <h2>令和6年議事録</h2>
        <ul class="c-list-horizontal">
          <li>
            <a href="/files/gikaijimukyoku/令和6年第1回臨時会.pdf">
              第1回臨時会　議事録 (215.9KB)
            </a>
          </li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第1回臨時会");
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("複数の年度セクションをそれぞれ正しくパースする", () => {
    const html = `
      <div class="c-entry-body">
        <h2>令和7年議事録</h2>
        <ul class="c-list-horizontal">
          <li><a href="/files/gikaijimukyoku/R7-1.pdf">3月定例会　議事録 (1.5MB)</a></li>
        </ul>
        <h2>令和6年議事録</h2>
        <ul class="c-list-horizontal">
          <li><a href="/files/gikaijimukyoku/R6-4.pdf">12月定例会　議事録 (1.2MB)</a></li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.year).toBe(2024);
  });

  it("平成年度の PDF も正しくパースする", () => {
    const html = `
      <div class="c-entry-body">
        <h2>平成31年議事録</h2>
        <ul class="c-list-horizontal">
          <li><a href="/files/gikaijimukyoku/20230216/H31.3teirei.pdf">3月定例会　議事録</a></li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("平成31年3月定例会");
    expect(result[0]!.year).toBe(2019);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <div class="c-entry-body">
        <h2>令和7年議事録</h2>
        <p>会議録なし</p>
      </div>
    `;
    expect(parseListPage(html)).toEqual([]);
  });

  it("年度情報がない h2 はスキップする", () => {
    const html = `
      <div class="c-entry-body">
        <h2>その他情報</h2>
        <ul><li><a href="/files/test.pdf">3月定例会　議事録</a></li></ul>
      </div>
    `;
    expect(parseListPage(html)).toEqual([]);
  });

  it("全角数字の年度見出しに対応する", () => {
    const html = `
      <div class="c-entry-body">
        <h2>令和７年議事録</h2>
        <ul class="c-list-horizontal">
          <li><a href="/files/gikaijimukyoku/R7-1.pdf">第１回定例会　議事録 (1.5MB)</a></li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.title).toBe("令和7年第1回定例会");
  });
});
