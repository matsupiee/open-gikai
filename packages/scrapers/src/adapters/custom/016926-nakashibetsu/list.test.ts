import { describe, it, expect } from "vitest";
import { parseSessionLinks, parsePdfLinks } from "./list";
import { yearToEraCode, parseSessionCode } from "./shared";

describe("yearToEraCode", () => {
  it("令和6年（2024）は reiwa6 を返す", () => {
    expect(yearToEraCode(2024)).toBe("reiwa6");
  });

  it("令和7年（2025）は reiwa07 を返す（ゼロ埋め）", () => {
    expect(yearToEraCode(2025)).toBe("reiwa07");
  });

  it("令和元年（2019）は reiwa1 を返す", () => {
    expect(yearToEraCode(2019)).toBe("reiwa1");
  });

  it("令和2年（2020）は reiwa2 を返す", () => {
    expect(yearToEraCode(2020)).toBe("reiwa2");
  });

  it("2018年（令和前）は null を返す", () => {
    expect(yearToEraCode(2018)).toBeNull();
  });
});

describe("parseSessionCode", () => {
  it("R0603teireikai → eraYear=6, month=3 を返す", () => {
    const result = parseSessionCode("R0603teireikai");
    expect(result).toEqual({ eraYear: 6, month: 3 });
  });

  it("R0609teireikai → eraYear=6, month=9 を返す", () => {
    const result = parseSessionCode("R0609teireikai");
    expect(result).toEqual({ eraYear: 6, month: 9 });
  });

  it("R0303teirei → eraYear=3, month=3 を返す（旧形式）", () => {
    const result = parseSessionCode("R0303teirei");
    expect(result).toEqual({ eraYear: 3, month: 3 });
  });

  it("R0712teireikai → eraYear=7, month=12 を返す", () => {
    const result = parseSessionCode("R0712teireikai");
    expect(result).toEqual({ eraYear: 7, month: 12 });
  });

  it("無効な文字列は null を返す", () => {
    expect(parseSessionCode("invalid")).toBeNull();
  });
});

describe("parseSessionLinks", () => {
  it("一覧ページ HTML から定例会ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0603teireikai/">令和6年3月定例会</a></li>
        <li><a href="/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0606teireikai/">令和6年6月定例会</a></li>
        <li><a href="/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa5/R0503teireikai/">令和5年3月定例会</a></li>
        <li><a href="/other/page/">その他</a></li>
      </ul>
    `;
    const links = parseSessionLinks(html);

    expect(links.length).toBe(3);
    expect(links[0]).toBe(
      "https://www.nakashibetsu.jp/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0603teireikai/",
    );
    expect(links[1]).toBe(
      "https://www.nakashibetsu.jp/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0606teireikai/",
    );
    expect(links[2]).toBe(
      "https://www.nakashibetsu.jp/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa5/R0503teireikai/",
    );
  });

  it("重複リンクは除外する", () => {
    const html = `
      <a href="/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0603teireikai/">令和6年3月定例会</a>
      <a href="/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0603teireikai/">令和6年3月定例会（再掲）</a>
    `;
    const links = parseSessionLinks(html);
    expect(links.length).toBe(1);
  });

  it("該当リンクがない場合は空配列を返す", () => {
    const html = `<a href="/gikai/other/">その他ページ</a>`;
    const links = parseSessionLinks(html);
    expect(links.length).toBe(0);
  });
});

describe("parsePdfLinks", () => {
  it("定例会ページから PDF リンクを抽出する", () => {
    const html = `
      <div>
        <p><a href="/file/contents/5857/48136/R0603ippanshitumon.pdf">一般質問全文（PDF）</a></p>
        <p><a href="/file/contents/5857/48137/R0603ippan01.pdf">通告1 阿部隆弘議員</a></p>
        <p><a href="/file/contents/5857/48138/R0603ippan02.pdf">通告2 ○○議員</a></p>
        <p><a href="/other/page/">その他</a></p>
      </div>
    `;
    const links = parsePdfLinks(html);

    expect(links.length).toBe(3);
    expect(links[0]).toBe(
      "https://www.nakashibetsu.jp/file/contents/5857/48136/R0603ippanshitumon.pdf",
    );
    expect(links[1]).toBe(
      "https://www.nakashibetsu.jp/file/contents/5857/48137/R0603ippan01.pdf",
    );
  });

  it("重複 PDF リンクは除外する", () => {
    const html = `
      <a href="/file/contents/100/200/test.pdf">PDF1</a>
      <a href="/file/contents/100/200/test.pdf">PDF1（再掲）</a>
    `;
    const links = parsePdfLinks(html);
    expect(links.length).toBe(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<a href="/gikai/page/">ページ</a>`;
    const links = parsePdfLinks(html);
    expect(links.length).toBe(0);
  });
});
