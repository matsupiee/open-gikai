import { describe, it, expect } from "vitest";
import { parseH3Year, parseLinkText, parseListPage, filterByYear } from "./list";

describe("parseH3Year", () => {
  it("令和の年を抽出する", () => {
    expect(parseH3Year("令和7年")).toBe(2025);
  });

  it("平成の年を抽出する", () => {
    expect(parseH3Year("平成30年")).toBe(2018);
  });

  it("令和元年に対応する", () => {
    expect(parseH3Year("令和元年")).toBe(2019);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(parseH3Year("議会議事録")).toBeNull();
  });
});

describe("parseLinkText", () => {
  it("定例会のリンクテキストをパースする", () => {
    const result = parseLinkText("3月定例会 (PDF形式、○○KB)");

    expect(result).not.toBeNull();
    expect(result!.month).toBe(3);
    expect(result!.section).toBe("定例会");
  });

  it("臨時会のリンクテキストをパースする", () => {
    const result = parseLinkText("10月臨時会 (PDF形式、○○KB)");

    expect(result).not.toBeNull();
    expect(result!.month).toBe(10);
    expect(result!.section).toBe("臨時会");
  });

  it("12月定例会をパースする", () => {
    const result = parseLinkText("12月定例会 (PDF形式、200KB)");

    expect(result).not.toBeNull();
    expect(result!.month).toBe(12);
    expect(result!.section).toBe("定例会");
  });

  it("パースできないテキストは null を返す", () => {
    expect(parseLinkText("議員名簿")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/115/R7.12T.pdf">12月定例会 (PDF形式、500KB)</a></li>
        <li><a href="./cmsfiles/contents/0000000/115/R7.9T.pdf">9月定例会 (PDF形式、400KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.ikedamachi.net/cmsfiles/contents/0000000/115/R7.12T.pdf"
    );
    expect(meetings[0]!.title).toBe("12月定例会");
    expect(meetings[0]!.heldOn).toBe("2025-12-01");
    expect(meetings[0]!.section).toBe("定例会");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.ikedamachi.net/cmsfiles/contents/0000000/115/R7.9T.pdf"
    );
    expect(meetings[1]!.title).toBe("9月定例会");
    expect(meetings[1]!.heldOn).toBe("2025-09-01");
  });

  it("臨時会リンクを正しく抽出する", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/115/R7.10R.pdf">10月臨時会 (PDF形式、100KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("10月臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-10-01");
    expect(meetings[0]!.section).toBe("臨時会");
  });

  it("複数年度のセクションを正しく処理する", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/115/R7.3T.pdf">3月定例会 (PDF形式、400KB)</a></li>
      </ul>
      <h3>令和6年</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/115/R6.12T.pdf">12月定例会 (PDF形式、350KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
    expect(meetings[1]!.heldOn).toBe("2024-12-01");
  });

  it("平成年度のリンクを正しく処理する", () => {
    const html = `
      <h3>平成30年</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/115/H30.12t.pdf">12月定例会 (PDF形式、300KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-01");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.ikedamachi.net/cmsfiles/contents/0000000/115/H30.12t.pdf"
    );
  });

  it("h3 がない PDF リンクは無視する", () => {
    const html = `
      <ul>
        <li><a href="./cmsfiles/contents/0000000/115/R7.3T.pdf">3月定例会 (PDF形式、400KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});

describe("filterByYear", () => {
  it("指定年のミーティングのみ返す", () => {
    const meetings = [
      { pdfUrl: "a.pdf", title: "A", heldOn: "2025-03-01", section: "定例会" },
      { pdfUrl: "b.pdf", title: "B", heldOn: "2024-12-01", section: "定例会" },
      { pdfUrl: "c.pdf", title: "C", heldOn: "2025-09-01", section: "定例会" },
    ];

    const result = filterByYear(meetings, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("A");
    expect(result[1]!.title).toBe("C");
  });

  it("一致する年がない場合は空配列を返す", () => {
    const meetings = [
      { pdfUrl: "a.pdf", title: "A", heldOn: "2025-03-01", section: "定例会" },
    ];

    const result = filterByYear(meetings, 2020);
    expect(result).toHaveLength(0);
  });
});
