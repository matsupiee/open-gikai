import { describe, expect, it } from "vitest";
import {
  parseHeldOnHint,
  parseListPage,
  parseSectionLinks,
  parseSections,
} from "./list";

describe("parseSections", () => {
  it("h3 と list-base の組を抽出する", () => {
    const html = `
      <h3>令和７年第４回定例会</h3>
      <ul class="list-base">
        <li><a href="/a.pdf">第１号（９月２日）</a></li>
      </ul>
      <h3>令和７年第３回定例会</h3>
      <ul class="list-base">
        <li><a href="/b.pdf">第１号（６月６日）</a></li>
      </ul>
    `;

    expect(parseSections(html)).toHaveLength(2);
    expect(parseSections(html)[0]?.sessionTitle).toBe("令和7年第4回定例会");
  });
});

describe("parseHeldOnHint", () => {
  it("会期見出しとリンク文字列から日付ヒントを作る", () => {
    expect(parseHeldOnHint("令和７年第１回定例会", "第１号（３月５日）")).toBe(
      "2025-03-05",
    );
  });
});

describe("parseSectionLinks", () => {
  it("目次PDFを除いて本文PDFだけを返す", () => {
    const listHtml = `
      <li><a href="/mokuji.pdf">会議録目次(PDF:63.3 KB)</a></li>
      <li><a href="/day1.pdf">第１号（３月５日）(PDF:456.7 KB)</a></li>
      <li><a href="/day2.pdf">第２号（３月１３日）(PDF:245.8 KB)</a></li>
    `;

    expect(parseSectionLinks("令和７年第１回定例会", listHtml)).toEqual([
      {
        pdfUrl: "https://www.vill.kawaba.gunma.jp/day1.pdf",
        title: "令和7年第1回定例会 第1号（3月5日）(PDF:456.7 KB)",
        sessionTitle: "令和7年第1回定例会",
        meetingType: "plenary",
        heldOnHint: "2025-03-05",
      },
      {
        pdfUrl: "https://www.vill.kawaba.gunma.jp/day2.pdf",
        title: "令和7年第1回定例会 第2号（3月13日）(PDF:245.8 KB)",
        sessionTitle: "令和7年第1回定例会",
        meetingType: "plenary",
        heldOnHint: "2025-03-13",
      },
    ]);
  });
});

describe("parseListPage", () => {
  it("指定年の会期だけを抽出する", () => {
    const html = `
      <h3>令和７年第１回定例会</h3>
      <ul class="list-base">
        <li><a href="/day1.pdf">第１号（３月５日）</a></li>
      </ul>
      <h3>令和6年第4回定例会</h3>
      <ul class="list-base">
        <li><a href="/prev.pdf">第１号（１２月４日）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]?.heldOnHint).toBe("2025-03-05");
  });
});
