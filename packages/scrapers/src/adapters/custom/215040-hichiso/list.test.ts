import { describe, expect, it } from "vitest";
import { eraToWesternYear, parseListPage, parsePdfFilename } from "./list";

describe("parsePdfFilename", () => {
  it("令和の定例会ファイル名をパースする", () => {
    const result = parsePdfFilename("令和7年12月定例会.pdf");

    expect(result).not.toBeNull();
    expect(result!.eraText).toBe("令和7年");
    expect(result!.month).toBe(12);
    expect(result!.sessionType).toBe("定例会");
  });

  it("令和の臨時会ファイル名をパースする", () => {
    const result = parsePdfFilename("令和7年7月臨時会.pdf");

    expect(result).not.toBeNull();
    expect(result!.eraText).toBe("令和7年");
    expect(result!.month).toBe(7);
    expect(result!.sessionType).toBe("臨時会");
  });

  it("令和元年に対応する", () => {
    const result = parsePdfFilename("令和元年6月定例会.pdf");

    expect(result).not.toBeNull();
    expect(result!.eraText).toBe("令和元年");
    expect(result!.month).toBe(6);
  });

  it("平成のファイル名をパースする", () => {
    const result = parsePdfFilename("平成30年9月定例会.pdf");

    expect(result).not.toBeNull();
    expect(result!.eraText).toBe("平成30年");
    expect(result!.month).toBe(9);
    expect(result!.sessionType).toBe("定例会");
  });

  it("不正なファイル名は null を返す", () => {
    expect(parsePdfFilename("資料.pdf")).toBeNull();
    expect(parsePdfFilename("令和7年定例会.pdf")).toBeNull();
  });
});

describe("eraToWesternYear", () => {
  it("令和7年を2025に変換する", () => {
    expect(eraToWesternYear("令和7年")).toBe(2025);
  });

  it("令和元年を2019に変換する", () => {
    expect(eraToWesternYear("令和元年")).toBe(2019);
  });

  it("平成30年を2018に変換する", () => {
    expect(eraToWesternYear("平成30年")).toBe(2018);
  });

  it("不正な入力は null を返す", () => {
    expect(eraToWesternYear("昭和50年")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <ul>
          <li><a href="/wp-content/uploads/giziroku/%E4%BB%A4%E5%92%8C7%E5%B9%B412%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和7年12月定例会</a></li>
          <li><a href="/wp-content/uploads/giziroku/%E4%BB%A4%E5%92%8C7%E5%B9%B49%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和7年9月定例会</a></li>
          <li><a href="/wp-content/uploads/giziroku/%E4%BB%A4%E5%92%8C7%E5%B9%B47%E6%9C%88%E8%87%A8%E6%99%82%E4%BC%9A.pdf">令和7年7月臨時会</a></li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.title).toBe("令和7年12月定例会");
    expect(meetings[0]!.heldOn).toBe("2025-12-01");
    expect(meetings[0]!.sessionType).toBe("定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.hichiso.jp/wp-content/uploads/giziroku/%E4%BB%A4%E5%92%8C7%E5%B9%B412%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf"
    );

    expect(meetings[1]!.title).toBe("令和7年9月定例会");
    expect(meetings[1]!.heldOn).toBe("2025-09-01");

    expect(meetings[2]!.title).toBe("令和7年7月臨時会");
    expect(meetings[2]!.sessionType).toBe("臨時会");
  });

  it("giziroku パス以外の PDF リンクは無視する", () => {
    const html = `
      <a href="/wp-content/uploads/other/document.pdf">その他資料</a>
      <a href="/wp-content/uploads/giziroku/%E4%BB%A4%E5%92%8C7%E5%B9%B412%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和7年12月定例会</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("パースできないファイル名はスキップする", () => {
    const html = `
      <a href="/wp-content/uploads/giziroku/unknown.pdf">不明なファイル</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});
