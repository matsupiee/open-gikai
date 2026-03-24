import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("令和6年（2024年）の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
        <h3 class="heading-lv3">令和6年（2024年）</h3>
        <ul>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/2024_1st_meeting.pdf">第1回（2月）</a></li>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_2nd_meeting_in_2024.pdf">第2回（6月）</a></li>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_3rd_meeting_in_2024_2.pdf">第3回（9月）</a></li>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_4th_meeting_in_2024.pdf">第4回（12月）</a></li>
        </ul>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(4);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hiranai.aomori.jp/material/files/group/14/2024_1st_meeting.pdf",
    );
    expect(meetings[0]!.title).toBe("令和6年第1回定例会");
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.month).toBe(2);

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_2nd_meeting_in_2024.pdf",
    );
    expect(meetings[1]!.title).toBe("令和6年第2回定例会");
    expect(meetings[1]!.month).toBe(6);

    expect(meetings[2]!.month).toBe(9);
    expect(meetings[3]!.month).toBe(12);
  });

  it("令和7年（2025年）の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
        <h3>令和7年（2025年）</h3>
        <ul>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_1st_meeting_in_2025.pdf">第1回（3月）</a></li>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_2nd_meeting_in_2025.pdf">第2回（6月）</a></li>
        </ul>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.title).toBe("令和7年第1回定例会");
    expect(meetings[0]!.month).toBe(3);
  });

  it("複数年度が混在する場合、それぞれ正しい年度を割り当てる", () => {
    const html = `
      <html><body>
        <h3>令和7年（2025年）</h3>
        <ul>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/file2025.pdf">第1回（3月）</a></li>
        </ul>
        <h3>令和6年（2024年）</h3>
        <ul>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/file2024.pdf">第1回（2月）</a></li>
        </ul>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.month).toBe(3);
    expect(meetings[1]!.year).toBe(2024);
    expect(meetings[1]!.month).toBe(2);
  });

  it("月なしパターン（第1回のみ）でも回次を抽出する", () => {
    const html = `
      <html><body>
        <h3>令和5年</h3>
        <ul>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/reiwa5nendai1kaiteireikai.pdf">第1回</a></li>
          <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/reiwa5nendai2kaiteireikai2.pdf">第2回</a></li>
        </ul>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和5年第1回定例会");
    expect(meetings[0]!.month).toBeNull();
    expect(meetings[1]!.title).toBe("令和5年第2回定例会");
  });

  it("プロトコル相対 URL に https: を付与する", () => {
    const html = `
      <html><body>
        <h3>令和6年</h3>
        <li><a href="//www.town.hiranai.aomori.jp/material/files/group/14/test.pdf">第1回（2月）</a></li>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hiranai.aomori.jp/material/files/group/14/test.pdf",
    );
  });

  it("PDF 以外のリンクはスキップする", () => {
    const html = `
      <html><body>
        <h3>令和6年</h3>
        <a href="/some-page.html">関連ページ</a>
        <a href="//www.town.hiranai.aomori.jp/material/files/group/14/2024_1st_meeting.pdf">第1回（2月）</a>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain(".pdf");
  });

  it("年度見出しがない場合は PDF をスキップする", () => {
    const html = `
      <html><body>
        <a href="//www.town.hiranai.aomori.jp/material/files/group/14/test.pdf">第1回（2月）</a>
      </body></html>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});
