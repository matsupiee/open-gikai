import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parseYearPage, parseLinkTextDate, parseLinkTextTitle } from "./list";

describe("parseYearPageLinks", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/gyosei/docs/2023074.html">令和7年市議会会議録</a></li>
          <li><a href="/gyosei/docs/1407402.html">令和6年市議会会議録</a></li>
          <li><a href="/gyosei/docs/853134.html">令和5年市議会会議録</a></li>
          <li><a href="/about/">関係ないリンク</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseYearPageLinks(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.city.mima.lg.jp/gyosei/docs/2023074.html");
    expect(urls[1]).toBe("https://www.city.mima.lg.jp/gyosei/docs/1407402.html");
    expect(urls[2]).toBe("https://www.city.mima.lg.jp/gyosei/docs/853134.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/gyosei/docs/2023074.html">令和7年市議会会議録</a></li>
        <li><a href="/gyosei/docs/2023074.html">令和7年市議会会議録</a></li>
      </ul>
    `;

    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(1);
  });

  it("会議録リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseLinkTextDate", () => {
  it("定例会の開催日を解析する", () => {
    const text = "令和7年3月美馬市議会定例会(第1号)(開催日2025年2月18日)";
    expect(parseLinkTextDate(text)).toBe("2025-02-18");
  });

  it("臨時会の開催日を解析する", () => {
    const text = "令和7年第1回美馬市議会臨時会(開催日2025年5月16日)";
    expect(parseLinkTextDate(text)).toBe("2025-05-16");
  });

  it("全角カッコの開催日を解析する", () => {
    const text = "令和6年9月美馬市議会定例会(第2号)（開催日2024年9月10日）";
    expect(parseLinkTextDate(text)).toBe("2024-09-10");
  });

  it("開催日がない場合は null を返す", () => {
    const text = "令和6年市議会会議録";
    expect(parseLinkTextDate(text)).toBeNull();
  });

  it("1桁の月日もゼロパディングする", () => {
    const text = "令和6年3月美馬市議会定例会(第1号)(開催日2024年3月5日)";
    expect(parseLinkTextDate(text)).toBe("2024-03-05");
  });
});

describe("parseLinkTextTitle", () => {
  it("定例会のタイトルから開催日部分を除去する", () => {
    const text = "令和7年3月美馬市議会定例会(第1号)(開催日2025年2月18日)";
    expect(parseLinkTextTitle(text)).toBe("令和7年3月美馬市議会定例会(第1号)");
  });

  it("臨時会のタイトルから開催日部分を除去する", () => {
    const text = "令和7年第1回美馬市議会臨時会(開催日2025年5月16日)";
    expect(parseLinkTextTitle(text)).toBe("令和7年第1回美馬市議会臨時会");
  });

  it("空文字列の場合は null を返す", () => {
    expect(parseLinkTextTitle("")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("年度別ページから PDF リンク情報を抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和7年3月定例会</h2>
        <ul>
          <li>
            <a href="/fs/1/2/3/4/5/6/_/___7_3___________1______2025_2_18__.pdf">
              令和7年3月美馬市議会定例会(第1号)(開催日2025年2月18日)
            </a>
          </li>
          <li>
            <a href="/fs/1/2/3/4/5/6/_/___7_3___________2______2025_2_19__.pdf">
              令和7年3月美馬市議会定例会(第2号)(開催日2025年2月19日)
            </a>
          </li>
        </ul>
        <h2>令和7年第1回臨時会</h2>
        <ul>
          <li>
            <a href="/fs/1/2/3/4/5/7/_/20250516_rinji.pdf">
              令和7年第1回美馬市議会臨時会(開催日2025年5月16日)
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.mima.lg.jp/fs/1/2/3/4/5/6/_/___7_3___________1______2025_2_18__.pdf",
    );
    expect(meetings[0]!.title).toBe("令和7年3月美馬市議会定例会(第1号)");
    expect(meetings[0]!.heldOn).toBe("2025-02-18");

    expect(meetings[1]!.title).toBe("令和7年3月美馬市議会定例会(第2号)");
    expect(meetings[1]!.heldOn).toBe("2025-02-19");

    expect(meetings[2]!.title).toBe("令和7年第1回美馬市議会臨時会");
    expect(meetings[2]!.heldOn).toBe("2025-05-16");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("開催日が解析できない場合は heldOn が null になる", () => {
    const html = `
      <ul>
        <li>
          <a href="/fs/1/2/3/4/5/6/_/file.pdf">令和7年市議会定例会</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });
});
