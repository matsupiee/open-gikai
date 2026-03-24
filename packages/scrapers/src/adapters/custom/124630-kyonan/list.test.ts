import { describe, expect, it } from "vitest";
import { parseYearPage } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第1回定例会")).toBe(2024);
    expect(parseWarekiYear("令和元年第2回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第3回定例会")).toBe(2018);
    expect(parseWarekiYear("平成25年第1回定例会")).toBe(2013);
    expect(parseWarekiYear("平成元年第1回定例会")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年第1回定例会会議録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和7年第2回臨時会会議録")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("令和6年総務委員会会議録")).toBe("committee");
  });
});

describe("parseYearPage", () => {
  it("年度別ページからPDFリンクを抽出する", () => {
    const html = `
      <div class="content">
        <ul>
          <li>
            <a href="/uploaded/attachment/12345.pdf">令和７年第１回定例会会議録（PDF：1.2MB）</a>
          </li>
          <li>
            <a href="/uploaded/attachment/12346.pdf">令和７年第２回臨時会会議録（PDF：800KB）</a>
          </li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, "https://www.town.kyonan.chiba.jp/site/machigikai/0012731.html");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和７年第１回定例会会議録",
      pdfUrl: "https://www.town.kyonan.chiba.jp/uploaded/attachment/12345.pdf",
      meetingType: "plenary",
      yearPageUrl: "https://www.town.kyonan.chiba.jp/site/machigikai/0012731.html",
    });
    expect(result[1]).toEqual({
      title: "令和７年第２回臨時会会議録",
      pdfUrl: "https://www.town.kyonan.chiba.jp/uploaded/attachment/12346.pdf",
      meetingType: "extraordinary",
      yearPageUrl: "https://www.town.kyonan.chiba.jp/site/machigikai/0012731.html",
    });
  });

  it("絶対URLのPDFリンクをそのまま使う", () => {
    const html = `
      <a href="https://www.town.kyonan.chiba.jp/uploaded/attachment/99999.pdf">
        令和６年第３回定例会会議録
      </a>
    `;

    const result = parseYearPage(html, "https://www.town.kyonan.chiba.jp/site/machigikai/0011781.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kyonan.chiba.jp/uploaded/attachment/99999.pdf",
    );
  });

  it("プロトコル相対URLを絶対URLに変換する", () => {
    const html = `
      <a href="//www.town.kyonan.chiba.jp/uploaded/attachment/99999.pdf">
        令和６年第３回定例会会議録
      </a>
    `;

    const result = parseYearPage(html, "https://www.town.kyonan.chiba.jp/site/machigikai/0011781.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kyonan.chiba.jp/uploaded/attachment/99999.pdf",
    );
  });

  it("重複PDFリンクを除外する", () => {
    const html = `
      <a href="/uploaded/attachment/12345.pdf">令和７年第１回定例会会議録</a>
      <a href="/uploaded/attachment/12345.pdf">令和７年第１回定例会会議録（再掲）</a>
    `;

    const result = parseYearPage(html, "https://www.town.kyonan.chiba.jp/site/machigikai/0012731.html");
    expect(result).toHaveLength(1);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません。</p>";
    expect(parseYearPage(html, "https://www.town.kyonan.chiba.jp/site/machigikai/0012731.html")).toEqual([]);
  });

  it("PDFサイズ情報をタイトルから除去する", () => {
    const html = `
      <a href="/uploaded/attachment/12345.pdf">令和７年第１回定例会会議録（PDF：1.2MB）</a>
    `;

    const result = parseYearPage(html, "https://www.town.kyonan.chiba.jp/site/machigikai/0012731.html");
    expect(result[0]!.title).toBe("令和７年第１回定例会会議録");
  });

  it("/uploaded/attachment/ パターン以外のPDFリンクを除外する", () => {
    const html = `
      <a href="/other/path/document.pdf">別の書類</a>
      <a href="/uploaded/attachment/12345.pdf">令和７年第１回定例会会議録</a>
    `;

    const result = parseYearPage(html, "https://www.town.kyonan.chiba.jp/site/machigikai/0012731.html");
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和７年第１回定例会会議録");
  });
});
