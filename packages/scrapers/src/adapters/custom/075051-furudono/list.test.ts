import { describe, expect, it } from "vitest";
import { parseHeldOn, parseListPage } from "./list";

describe("parseHeldOn", () => {
  it("定例会見出しとリンク名から開催日を組み立てる", () => {
    expect(parseHeldOn("令和7年3月定例会", "2号（3月11日一般質問）")).toBe(
      "2025-03-11",
    );
  });

  it("令和元年に対応する", () => {
    expect(parseHeldOn("令和元年9月定例会", "1号（9月4日議案上程）")).toBe(
      "2019-09-04",
    );
  });

  it("見出しにフル日付がある臨時会に対応する", () => {
    expect(parseHeldOn("臨時会（令和6年8月7日）", "1号（8月7日議案審議）")).toBe(
      "2024-08-07",
    );
  });
});

describe("parseListPage", () => {
  const baseUrl = "https://www.town.furudono.fukushima.jp/gikai/kaigiroku/3318";

  it("段落見出しと PDF リンクを対応づけて抽出する", () => {
    const html = `
      <div class="paragraph clearfix" id="paragraph<!--$id-->">
        <div class="colm-12">令和７年３月定例会</div>
      </div>
      <div class="paragraph clearfix">
        <div class="colm-12">
          <ul>
            <li class="pdf"><a href="/file/24746/R070306.pdf" title="１号（３月６日議案上程）">１号（３月６日議案上程）</a></li>
            <li class="pdf"><a href="/file/24746/R070311.pdf" title="２号（３月１１日一般質問）">２号（３月１１日一般質問）</a></li>
          </ul>
        </div>
      </div>
      <div class="paragraph clearfix">
        <div class="colm-12">臨時会（令和６年８月７日）</div>
      </div>
      <div class="paragraph clearfix">
        <div class="colm-12">
          <ul>
            <li class="pdf"><a href="/file/23457/R60807R.pdf" title="１号（８月７日議案審議）">１号（８月７日議案審議）</a></li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseListPage(html, baseUrl);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2025-03-06");
    expect(meetings[0]!.title).toBe("令和7年3月定例会 1号（3月6日議案上程）");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.furudono.fukushima.jp/file/24746/R070306.pdf",
    );

    expect(meetings[1]!.heldOn).toBe("2025-03-11");
    expect(meetings[1]!.sessionName).toBe("令和7年3月定例会");

    expect(meetings[2]!.heldOn).toBe("2024-08-07");
    expect(meetings[2]!.sessionName).toBe("臨時会（令和6年8月7日）");
  });

  it("targetYear で対象年のみ返す", () => {
    const html = `
      <div class="paragraph clearfix">
        <div class="colm-12">令和７年６月定例会</div>
      </div>
      <div class="paragraph clearfix">
        <div class="colm-12">
          <ul>
            <li class="pdf"><a href="/file/25178/20251016164444.pdf" title="１号（６月１３日議案上程）">１号（６月１３日議案上程）</a></li>
          </ul>
        </div>
      </div>
      <div class="paragraph clearfix">
        <div class="colm-12">令和６年１２月定例会</div>
      </div>
      <div class="paragraph clearfix">
        <div class="colm-12">
          <ul>
            <li class="pdf"><a href="/file/24399/R6.12.13.pdf" title="１号（１２月１３日議案上程）">１号（１２月１３日議案上程）</a></li>
          </ul>
        </div>
      </div>
    `;

    expect(parseListPage(html, baseUrl, 2025)).toHaveLength(1);
    expect(parseListPage(html, baseUrl, 2024)).toHaveLength(1);
  });
});
