import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseDateText } from "./shared";

describe("parseDateText", () => {
  it("定例会タイトルから開催日をパースする", () => {
    expect(parseDateText("令和7年第1回定例会 1日目（3月5日）")).toBe(
      "2025-03-05",
    );
  });

  it("平成31年をパースする", () => {
    expect(parseDateText("平成31年第1回臨時会（2月15日）")).toBe(
      "2019-02-15",
    );
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年第4回臨時会（5月8日）")).toBe(
      "2019-05-08",
    );
  });

  it("日付がない文字列は null を返す", () => {
    expect(parseDateText("会議録一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("定例会と臨時会の PDF リンクを抽出する", () => {
    const html = `
      <div id="content">
        <p><a href="/gyousei/">行政情報</a></p>
        <h2>定例会</h2>
        <h3>令和7年</h3>
        <ul class="mokuji">
          <li><a href="files/R7-1-1day.pdf">令和7年第1回定例会 1日目（3月5日）<span>(834KB)</span></a></li>
        </ul>
        <h2>臨時会</h2>
        <h3>令和7年</h3>
        <ul class="mokuji">
          <li><a href="files/R7-2-r.pdf"><span>令和7年第1回臨時会（2月3日）</span><span>(391KB)</span></a></li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(
      html,
      "https://www.townhamanaka.jp/gyousei/kaigi/",
    );

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.townhamanaka.jp/gyousei/kaigi/files/R7-1-1day.pdf",
    );
    expect(meetings[0]!.title).toBe("令和7年第1回定例会 1日目（3月5日）");
    expect(meetings[0]!.heldOn).toBe("2025-03-05");
    expect(meetings[0]!.section).toBe("定例会");
    expect(meetings[1]!.section).toBe("臨時会");
    expect(meetings[1]!.heldOn).toBe("2025-02-03");
  });

  it("日付が取れない PDF リンクはスキップする", () => {
    const html = `
      <h2>定例会</h2>
      <ul class="mokuji">
        <li><a href="files/agenda.pdf">議事日程</a></li>
        <li><a href="files/R6-1-1day.pdf">令和6年第1回定例会 1日目（3月6日）</a></li>
      </ul>
    `;

    const meetings = parseListPage(
      html,
      "https://www.townhamanaka.jp/gyousei/kaigi/",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-06");
  });

  it("重複した PDF URL は 1 件にまとめる", () => {
    const html = `
      <h2>臨時会</h2>
      <ul class="mokuji">
        <li><a href="files/R7-2-r.pdf">令和7年第1回臨時会（2月3日）</a></li>
        <li><a href="files/R7-2-r.pdf">令和7年第1回臨時会（2月3日）</a></li>
      </ul>
    `;

    const meetings = parseListPage(
      html,
      "https://www.townhamanaka.jp/gyousei/kaigi/",
    );

    expect(meetings).toHaveLength(1);
  });
});
