import { describe, expect, it } from "vitest";
import {
  parseDateFromLinkText,
  parseMeetingPage,
  parseSectionPage,
  parseTopPage,
  parseYearPage,
} from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <div class="list_box noimage">
        <a href="/list/gikai/y446/p160/" class="index">
          <div class="main_area"><p class="title">令和7年</p></div>
        </a>
      </div>
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/" class="index">
          <div class="main_area"><p class="title">令和6年</p></div>
        </a>
      </div>
      <div class="list_box noimage">
        <a href="/list/gikai/y446/31/" class="index">
          <div class="main_area"><p class="title">平成31年・令和元年</p></div>
        </a>
      </div>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年");
    expect(pages[0]!.path).toBe("/list/gikai/y446/p160/");
    expect(pages[1]!.label).toBe("令和6年");
    expect(pages[1]!.path).toBe("/list/gikai/y446/q571/");
    expect(pages[2]!.label).toBe("平成31年・令和元年");
    expect(pages[2]!.path).toBe("/list/gikai/y446/31/");
  });

  it("令和・平成を含まないリンクはスキップする", () => {
    const html = `
      <a href="/list/gikai/y446/p160/" class="index">
        <div class="main_area"><p class="title">令和7年</p></div>
      </a>
      <a class="active" href="/list/gikai/y446/">会議録</a>
      <a href="/list/gikai/">議会トップ</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年");
  });

  it("シンプルなアンカータグからもテキストを抽出する", () => {
    const html = `
      <a href="/list/gikai/y446/r161/">平成28年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("平成28年");
  });
});

describe("parseYearPage", () => {
  it("会議一覧のリンクを抽出する", () => {
    const html = `
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/m193/" class="index">
          <div class="main_area"><p class="title">令和6年第４回定例会（令和６年１２月）</p></div>
        </a>
      </div>
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/z581/" class="index">
          <div class="main_area"><p class="title">令和６年第３回定例会（令和６年９月）</p></div>
        </a>
      </div>
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/z428/" class="index">
          <div class="main_area"><p class="title">令和６年第１回臨時会（令和６年２月）</p></div>
        </a>
      </div>
    `;

    const meetings = parseYearPage(html, "/list/gikai/y446/q571/");

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.label).toBe("令和6年第４回定例会（令和６年１２月）");
    expect(meetings[0]!.path).toBe("/list/gikai/y446/q571/m193/");
    expect(meetings[2]!.label).toBe("令和６年第１回臨時会（令和６年２月）");
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <a href="/list/gikai/y446/q571/m193/" class="index">
        <div class="main_area"><p class="title">令和6年第４回定例会（令和６年１２月）</p></div>
      </a>
      <a href="/list/gikai/">議会事務局トップへ</a>
    `;

    const meetings = parseYearPage(html, "/list/gikai/y446/q571/");
    expect(meetings).toHaveLength(1);
  });
});

describe("parseMeetingPage", () => {
  it("議事区分のリンクを抽出する", () => {
    const html = `
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/m193/m539/" class="index">
          <div class="main_area"><p class="title">提案説明</p></div>
        </a>
      </div>
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/m193/s588/" class="index">
          <div class="main_area"><p class="title">一般質問</p></div>
        </a>
      </div>
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/m193/p403/" class="index">
          <div class="main_area"><p class="title">議案質疑</p></div>
        </a>
      </div>
      <div class="list_box noimage">
        <a href="/list/gikai/y446/q571/m193/p124/" class="index">
          <div class="main_area"><p class="title">討論・採決</p></div>
        </a>
      </div>
    `;

    const sections = parseMeetingPage(html, "/list/gikai/y446/q571/m193/");

    expect(sections).toHaveLength(4);
    expect(sections[0]!.label).toBe("提案説明");
    expect(sections[0]!.path).toBe("/list/gikai/y446/q571/m193/m539/");
    expect(sections[1]!.label).toBe("一般質問");
    expect(sections[2]!.label).toBe("議案質疑");
    expect(sections[3]!.label).toBe("討論・採決");
  });

  it("パンくずなどのリンクはスキップする", () => {
    const html = `
      <a href="/list/gikai/y446/q571/">令和6年</a>
      <a href="/list/gikai/y446/q571/m193/">令和6年第４回定例会</a>
      <a href="/list/gikai/y446/q571/m193/m539/" class="index">
        <div class="main_area"><p class="title">提案説明</p></div>
      </a>
    `;

    const sections = parseMeetingPage(html, "/list/gikai/y446/q571/m193/");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.label).toBe("提案説明");
  });
});

describe("parseSectionPage", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <a href="/user/filer_public/f3/2a/f32aa4ca-e325-4c82-a627-5932f6193661/ling-he-6nian-12yue-3ri-chu-ri.pdf">
        <img src="/static/filer/icons/file_32x32.png" alt="Icon">
        令和６年１２月３日初日 (843.7 KB)
      </a>
    `;

    const pdfs = parseSectionPage(html);

    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.hiezu.jp/user/filer_public/f3/2a/f32aa4ca-e325-4c82-a627-5932f6193661/ling-he-6nian-12yue-3ri-chu-ri.pdf"
    );
    expect(pdfs[0]!.linkText).toBe("令和６年１２月３日初日 (843.7 KB)");
  });

  it("複数の PDF リンクを抽出する", () => {
    const html = `
      <a href="/user/filer_public/aa/bb/aabb1234-0000-0000-0000-000000000000/file1.pdf">令和６年３月５日 (500 KB)</a>
      <a href="/user/filer_public/cc/dd/ccdd5678-0000-0000-0000-000000000000/file2.pdf">令和６年３月６日 (600 KB)</a>
    `;

    const pdfs = parseSectionPage(html);
    expect(pdfs).toHaveLength(2);
  });

  it("絶対 URL のリンクもそのまま使う", () => {
    const html = `
      <a href="https://www.hiezu.jp/user/filer_public/aa/bb/file.pdf">令和６年３月５日 (500 KB)</a>
    `;

    const pdfs = parseSectionPage(html);
    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.hiezu.jp/user/filer_public/aa/bb/file.pdf"
    );
  });
});

describe("parseDateFromLinkText", () => {
  it("全角数字を含む令和の日付をパースする", () => {
    expect(parseDateFromLinkText("令和６年１２月３日初日 (843.7 KB)")).toBe("2024-12-03");
  });

  it("半角数字の令和の日付をパースする", () => {
    expect(parseDateFromLinkText("令和6年12月4日一般質問 (642.6 KB)")).toBe("2024-12-04");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateFromLinkText("平成30年3月5日 (400 KB)")).toBe("2018-03-05");
  });

  it("令和元年をパースする", () => {
    expect(parseDateFromLinkText("令和元年6月10日 (300 KB)")).toBe("2019-06-10");
  });

  it("平成元年をパースする", () => {
    expect(parseDateFromLinkText("平成元年4月1日 (200 KB)")).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromLinkText("資料一覧")).toBeNull();
  });
});
