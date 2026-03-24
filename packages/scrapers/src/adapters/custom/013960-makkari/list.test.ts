import { describe, expect, it } from "vitest";
import { parseLinkText, parseListPage } from "./list";

describe("parseLinkText", () => {
  it("臨時会のリンクテキストをパースする", () => {
    const result = parseLinkText("令和7年第1回臨時会(1月28日）");
    expect(result.title).toBe("令和7年第1回臨時会");
    expect(result.heldOn).toBe("2025-01-28");
  });

  it("定例会のリンクテキストをパースする", () => {
    const result = parseLinkText("令和6年第3回定例会（9月5日）");
    expect(result.title).toBe("令和6年第3回定例会");
    expect(result.heldOn).toBe("2024-09-05");
  });

  it("定例会 複数日目のリンクテキストをパースする", () => {
    const result = parseLinkText("令和7年第1回定例会　1日目(3月10日）");
    expect(result.title).toBe("令和7年第1回定例会　1日目");
    expect(result.heldOn).toBe("2025-03-10");
  });

  it("3日目のリンクテキストをパースする", () => {
    const result = parseLinkText("令和6年第3回定例会　3日目（9月11日）");
    expect(result.title).toBe("令和6年第3回定例会　3日目");
    expect(result.heldOn).toBe("2024-09-11");
  });

  it("令和6年（2024年）のリンクをパースする", () => {
    const result = parseLinkText("令和6年第1回定例会　2日目(3月9日）");
    expect(result.title).toBe("令和6年第1回定例会　2日目");
    expect(result.heldOn).toBe("2024-03-09");
  });

  it("日付が解析できないテキストは heldOn を null にする", () => {
    const result = parseLinkText("令和7年第2回定例会");
    expect(result.title).toBe("令和7年第2回定例会");
    expect(result.heldOn).toBeNull();
  });

  it("和暦年がないテキストは heldOn を null にする", () => {
    const result = parseLinkText("議会会議録（1月28日）");
    expect(result.heldOn).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <html>
      <body>
        <h2 class="mk-title large">2025年（令和7年）会議録</h2>
        <ul>
          <li>
            <a href="/resources/output/contents/file/release/1506/11537/R7-1-28-1rin.pdf"
               title="令和7年第1回臨時会(1月28日）" target="_blank">
              令和7年第1回臨時会(1月28日）
            </a>
            <!--(PDF形式:184KB)-->
          </li>
          <li>
            <a href="/resources/output/contents/file/release/1506/11538/R7-3-10-1tei.pdf"
               title="令和7年第1回定例会　1日目(3月10日）" target="_blank">
              令和7年第1回定例会　1日目(3月10日）
            </a>
          </li>
        </ul>
        <h2 class="mk-title large">2024年（令和6年）会議録</h2>
        <ul>
          <li>
            <a href="/resources/output/contents/file/release/1506/11200/6-3-8-1tei.pdf"
               title="令和6年第1回定例会（3月8日）" target="_blank">
              令和6年第1回定例会（3月8日）
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.makkari.lg.jp/resources/output/contents/file/release/1506/11537/R7-1-28-1rin.pdf",
    );
    expect(meetings[0]!.title).toBe("令和7年第1回臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-01-28");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.vill.makkari.lg.jp/resources/output/contents/file/release/1506/11538/R7-3-10-1tei.pdf",
    );
    expect(meetings[1]!.title).toBe("令和7年第1回定例会　1日目");
    expect(meetings[1]!.heldOn).toBe("2025-03-10");

    expect(meetings[2]!.pdfUrl).toBe(
      "https://www.vill.makkari.lg.jp/resources/output/contents/file/release/1506/11200/6-3-8-1tei.pdf",
    );
    expect(meetings[2]!.title).toBe("令和6年第1回定例会");
    expect(meetings[2]!.heldOn).toBe("2024-03-08");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});
