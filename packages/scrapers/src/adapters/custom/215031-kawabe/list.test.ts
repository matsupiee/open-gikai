import { describe, expect, it } from "vitest";
import { parseListPage, resolveYear } from "./list";

describe("parseListPage", () => {
  it("wp-content/uploads/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <ul>
          <li><a href="https://www.kawabe-gifu.jp/wp-content/uploads/2026/01/%E4%BB%A4%E5%92%8C%EF%BC%97%E5%B9%B4%E7%AC%AC%EF%BC%94%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和７年第４回定例会</a></li>
          <li><a href="https://www.kawabe-gifu.jp/wp-content/uploads/2025/11/%E7%AC%AC%EF%BC%93%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A%EF%BC%889.9-19%EF%BC%89HP%E7%94%A8.pdf">第３回定例会（9.9-19）HP用</a></li>
          <li><a href="https://www.kawabe-gifu.jp/wp-content/uploads/2024/10/%E7%AC%AC%EF%BC%93%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A%EF%BC%889.10-20%EF%BC%89.pdf">第３回定例会（9.10-20）</a></li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.linkText).toBe("令和７年第４回定例会");
    expect(meetings[0]!.uploadYear).toBe(2026);
    expect(meetings[0]!.uploadMonth).toBe(1);
    expect(meetings[0]!.pdfUrl).toContain("wp-content/uploads/2026/01/");

    expect(meetings[1]!.linkText).toBe("第３回定例会（9.9-19）HP用");
    expect(meetings[1]!.uploadYear).toBe(2025);
    expect(meetings[1]!.uploadMonth).toBe(11);

    expect(meetings[2]!.linkText).toBe("第３回定例会（9.10-20）");
    expect(meetings[2]!.uploadYear).toBe(2024);
    expect(meetings[2]!.uploadMonth).toBe(10);
  });

  it("相対 URL を絶対 URL に変換する", () => {
    const html = `
      <a href="/wp-content/uploads/2024/04/%E7%AC%AC%EF%BC%91%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">第１回定例会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toMatch(/^https:\/\/www\.kawabe-gifu\.jp/);
  });

  it("wp-content/uploads/ を含まないリンクは無視する", () => {
    const html = `
      <a href="https://www.kawabe-gifu.jp/other/document.pdf">その他資料</a>
      <a href="https://www.kawabe-gifu.jp/wp-content/uploads/2024/04/test.pdf">第１回定例会</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("PDF 以外のリンクは無視する", () => {
    const html = `
      <a href="https://www.kawabe-gifu.jp/wp-content/uploads/2024/04/image.jpg">画像</a>
      <a href="https://www.kawabe-gifu.jp/wp-content/uploads/2024/04/meeting.pdf">定例会</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("リンクテキストが空の場合はスキップする", () => {
    const html = `
      <a href="https://www.kawabe-gifu.jp/wp-content/uploads/2024/04/test.pdf">  </a>
      <a href="https://www.kawabe-gifu.jp/wp-content/uploads/2024/04/meeting.pdf">第１回定例会</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.linkText).toBe("第１回定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});

describe("resolveYear", () => {
  it("リンクテキストに令和X年が含まれる場合は西暦に変換する", () => {
    const year = resolveYear({
      pdfUrl: "https://example.com/test.pdf",
      linkText: "令和６年第４回定例会",
      uploadYear: 2025,
      uploadMonth: 1,
    });

    expect(year).toBe(2024);
  });

  it("リンクテキストに令和全角X年が含まれる場合も変換できる", () => {
    const year = resolveYear({
      pdfUrl: "https://example.com/test.pdf",
      linkText: "令和７年第４回定例会",
      uploadYear: 2026,
      uploadMonth: 1,
    });

    expect(year).toBe(2025);
  });

  it("リンクテキストに年号がない場合は null を返す", () => {
    const year = resolveYear({
      pdfUrl: "https://example.com/test.pdf",
      linkText: "第３回定例会（9.9-19）HP用",
      uploadYear: 2025,
      uploadMonth: 11,
    });

    expect(year).toBeNull();
  });

  it("平成の年号を変換する", () => {
    const year = resolveYear({
      pdfUrl: "https://example.com/test.pdf",
      linkText: "平成31年第１回定例会",
      uploadYear: 2019,
      uploadMonth: 5,
    });

    expect(year).toBe(2019);
  });
});
