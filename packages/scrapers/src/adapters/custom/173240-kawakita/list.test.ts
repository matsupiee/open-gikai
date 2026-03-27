import { describe, expect, it } from "vitest";
import { parseListPage, parseYearSection, parseYearSections } from "./list";

describe("parseYearSections", () => {
  it("和暦の年セクションを抽出する", () => {
    const html = `
      <h4 class="h4">令和7年 会議録</h4>
      <div>...</div>
      <h4 class="h4">令和6年 会議録</h4>
      <div>...</div>
    `;

    expect(parseYearSections(html).map((section) => section.year)).toEqual([2025, 2024]);
  });
});

describe("parseYearSection", () => {
  it("本文PDFだけを抽出する", () => {
    const html = `
      <table class="table table-xs-list"><tr><td>令和７年３月定例会</td></tr></table>
      <a href="https://example.com/cover.pdf">
        <p class="caption file-name">令和７年３月４日（表紙・議事日程）</p>
      </a>
      <a href="https://example.com/body.pdf">
        <p class="caption file-name">令和７年３月４日（本文）</p>
      </a>
    `;

    expect(parseYearSection(html)).toEqual([
      {
        pdfUrl: "https://example.com/body.pdf",
        title: "令和7年3月定例会 令和7年3月4日（本文）",
        sessionTitle: "令和7年3月定例会",
        meetingType: "plenary",
        heldOnHint: "2025-03-04",
      },
    ]);
  });
});

describe("parseListPage", () => {
  it("対象年の会議だけを返す", () => {
    const html = `
      <h4 class="h4">令和7年 会議録</h4>
      <table class="table table-xs-list"><tr><td>令和７年１月臨時会</td></tr></table>
      <a href="https://example.com/r7-1-cover.pdf">
        <p class="caption file-name">令和７年１月２０日（表紙・議事日程）</p>
      </a>
      <a href="https://example.com/r7-1-body.pdf">
        <p class="caption file-name">令和７年１月２０日（本文）</p>
      </a>
      <h4 class="h4">令和6年 会議録</h4>
      <table class="table table-xs-list"><tr><td>令和６年１２月定例会</td></tr></table>
      <a href="https://example.com/r6-12-body.pdf">
        <p class="caption file-name">令和６年１２月１０日（本文）</p>
      </a>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]?.heldOnHint).toBe("2025-01-20");
    expect(meetings[0]?.meetingType).toBe("extraordinary");
  });
});
