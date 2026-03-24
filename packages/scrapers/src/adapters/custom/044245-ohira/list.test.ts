import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearPage } from "./list";

describe("parseIndexPage", () => {
  it("指定年に対応する年度別ページURLを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/6/4/3/1/1462.html">令和7年本会議</a></li>
        <li><a href="/6/4/3/1/1058.html">令和6年本会議</a></li>
        <li><a href="/6/4/3/1/1057.html">令和5年本会議</a></li>
        <li><a href="/6/4/3/1/1053.html">令和元年（平成31年）本会議</a></li>
        <li><a href="/6/4/3/1/1052.html">平成30年本会議</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2024);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.village.ohira.miyagi.jp/6/4/3/1/1058.html");
  });

  it("令和元年は 2019 年として抽出する", () => {
    const html = `
      <ul>
        <li><a href="/6/4/3/1/1053.html">令和元年（平成31年）本会議</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2019);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.village.ohira.miyagi.jp/6/4/3/1/1053.html");
  });

  it("平成年号も対応する", () => {
    const html = `
      <ul>
        <li><a href="/6/4/3/1/1052.html">平成30年本会議</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2018);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.village.ohira.miyagi.jp/6/4/3/1/1052.html");
  });

  it("対象年が存在しない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/6/4/3/1/1058.html">令和6年本会議</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html, 2025);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会の複数日の PDF リンクを抽出する", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">第4回定例会</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4855.pdf">本会議1日目(令和6年12月3日) (PDFファイル: 810.6KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4862.pdf">本会議2日目（令和6年12月5日） (PDFファイル: 593.3KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.heldOn).toBe("2024-12-03");
    expect(meetings[0]!.title).toBe("第4回定例会 本会議 1日目(2024-12-03)");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.village.ohira.miyagi.jp/material/files/group/16/4855.pdf"
    );

    expect(meetings[1]!.heldOn).toBe("2024-12-05");
    expect(meetings[1]!.title).toBe("第4回定例会 本会議 2日目(2024-12-05)");
  });

  it("臨時会（日次なし）の PDF リンクを抽出する", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">第3回臨時会</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4882.pdf">本会議(令和6年12月23日) (PDFファイル: 413.7KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-23");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.title).toBe("第3回臨時会 本会議(2024-12-23)");
  });

  it("対象年以外の PDF はスキップする", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">第4回定例会</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4855.pdf">本会議1日目(令和6年12月3日) (PDFファイル: 810.6KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });

  it("h3 が定例会・臨時会でない場合はスキップする", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">その他</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4855.pdf">本会議1日目(令和6年12月3日) (PDFファイル: 810.6KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("複数セクションからリンクを収集する", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">第3回臨時会</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4882.pdf">本会議(令和6年12月23日) (PDFファイル: 413.7KB)</a></p>

      <h3><span class="bg"><span class="bg2"><span class="bg3">第4回定例会</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4855.pdf">本会議1日目(令和6年12月3日) (PDFファイル: 810.6KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/4862.pdf">本会議2日目（令和6年12月5日） (PDFファイル: 593.3KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[1]!.meetingType).toBe("plenary");
    expect(meetings[2]!.meetingType).toBe("plenary");
  });

  it("// 始まりのURLを https: に変換する", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">第1回定例会</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.village.ohira.miyagi.jp/material/files/group/16/1234.pdf">本会議(令和6年3月5日) (PDFファイル: 500.0KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.village.ohira.miyagi.jp/material/files/group/16/1234.pdf"
    );
  });
});
