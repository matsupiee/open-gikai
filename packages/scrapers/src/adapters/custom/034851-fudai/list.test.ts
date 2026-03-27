import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseDateText } from "./shared";

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("第1回臨時会　(令和6年1月29日).pdf")).toBe("2024-01-29");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年3月8日")).toBe("1989-03-08");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年6月3日")).toBe("2019-06-03");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("議事録一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <article class="body">
        <p>令和6年</p>
        <p>・<a class="icon-pdf" href="/fs/5/6/3/4/_/_4_______6_6_14__.pdf">第4回定例会　(令和6年6月14日).pdf (PDF 766KB)</a></p>
        <p>・<a class="icon-pdf" href="/fs/5/6/3/5/_/_5_______6_8_6__.pdf">第5回臨時会　(令和6年8月6日).pdf (PDF 399KB)</a></p>
      </article>
    `;

    const meetings = parseListPage(html, "https://www.vill.fudai.iwate.jp/docs/300.html");

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.fudai.iwate.jp/fs/5/6/3/4/_/_4_______6_6_14__.pdf",
    );
    expect(meetings[0]!.title).toBe("第4回定例会 (令和6年6月14日)");
    expect(meetings[0]!.heldOn).toBe("2024-06-14");
    expect(meetings[1]!.heldOn).toBe("2024-08-06");
  });

  it("日付を含まない PDF リンクはスキップする", () => {
    const html = `
      <p><a href="/files/agenda.pdf">議事日程.pdf (PDF 10KB)</a></p>
      <p><a href="/files/minutes.pdf">第1回臨時会（令和5年1月26日）.pdf</a></p>
    `;

    const meetings = parseListPage(html, "https://www.vill.fudai.iwate.jp/docs/300.html");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-01-26");
  });

  it("重複した PDF URL は 1 件にまとめる", () => {
    const html = `
      <p><a href="/files/a.pdf">第1回臨時会（令和5年1月26日）.pdf</a></p>
      <p><a href="/files/a.pdf">第1回臨時会（令和5年1月26日）.pdf</a></p>
    `;

    const meetings = parseListPage(html, "https://www.vill.fudai.iwate.jp/docs/300.html");
    expect(meetings).toHaveLength(1);
  });
});
