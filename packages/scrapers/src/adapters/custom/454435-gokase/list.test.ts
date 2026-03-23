import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseMetaFromLinkText } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul class="level1col2 clearfix">
        <li class="page">
          <a href="/kakuka/gikai/honkaigi/kaigiroku/2052.html">令和7年会議録</a>
        </li>
        <li class="page">
          <a href="/kakuka/gikai/honkaigi/kaigiroku/1849.html">令和6年会議録</a>
        </li>
        <li class="page">
          <a href="/kakuka/gikai/honkaigi/kaigiroku/H29kaigiroku.html">平成29年会議録</a>
        </li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.gokase.miyazaki.jp/kakuka/gikai/honkaigi/kaigiroku/2052.html"
    );
    expect(pages[1]!.label).toBe("令和6年会議録");
    expect(pages[1]!.url).toBe(
      "https://www.town.gokase.miyazaki.jp/kakuka/gikai/honkaigi/kaigiroku/1849.html"
    );
    expect(pages[2]!.label).toBe("平成29年会議録");
    expect(pages[2]!.url).toBe(
      "https://www.town.gokase.miyazaki.jp/kakuka/gikai/honkaigi/kaigiroku/H29kaigiroku.html"
    );
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/kakuka/gikai/honkaigi/kaigiroku/other.html">お知らせ</a>
      <a href="/kakuka/gikai/honkaigi/kaigiroku/2052.html">令和7年会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年会議録");
  });
});

describe("parseMetaFromLinkText", () => {
  it("定例会のリンクテキストをパースする", () => {
    const result = parseMetaFromLinkText(
      "令和6年第1回(3月)定例会会議録 (PDFファイル: 1.7MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-03-01");
    expect(result!.section).toBe("第1回定例会");
    expect(result!.title).toBe("令和6年第1回定例会");
  });

  it("臨時会のリンクテキストをパースする", () => {
    const result = parseMetaFromLinkText(
      "令和6年第1回(5月)臨時会会議録(PDFファイル:0.5MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-05-01");
    expect(result!.section).toBe("第1回臨時会");
    expect(result!.title).toBe("令和6年第1回臨時会");
  });

  it("平成の日付をパースする", () => {
    const result = parseMetaFromLinkText(
      "平成29年第1回(3月)定例会会議録(PDFファイル:1.6MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2017-03-01");
    expect(result!.section).toBe("第1回定例会");
    expect(result!.title).toBe("平成29年第1回定例会");
  });

  it("令和元年をパースする", () => {
    const result = parseMetaFromLinkText(
      "令和元年第1回(6月)定例会会議録 (PDFファイル: 1.0MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2019-06-01");
    expect(result!.title).toBe("令和元年第1回定例会");
  });

  it("不正なテキストは null を返す", () => {
    expect(parseMetaFromLinkText("資料一覧")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("新形式（p.file-link-item a.pdf）から PDF リンクを抽出する", () => {
    const html = `
      <p class="file-link-item"><a class="pdf" href="//www.town.gokase.miyazaki.jp/material/files/group/9/teireikai0601.pdf">
        令和6年第1回(3月)定例会会議録 (PDFファイル: 1.7MB)
      </a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.gokase.miyazaki.jp/material/files/group/9/rinnjikai0601.pdf">
        令和6年第1回(5月)臨時会会議録 (PDFファイル: 0.5MB)
      </a></p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("令和6年第1回定例会");
    expect(meetings[0]!.section).toBe("第1回定例会");
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.gokase.miyazaki.jp/material/files/group/9/teireikai0601.pdf"
    );

    expect(meetings[1]!.title).toBe("令和6年第1回臨時会");
    expect(meetings[1]!.section).toBe("第1回臨時会");
    expect(meetings[1]!.heldOn).toBe("2024-05-01");
  });

  it("旧形式（a.icon2）から PDF リンクを抽出する", () => {
    const html = `
      <div class="wysiwyg">
        <p><a target="_blank" class="icon2" href="//www.town.gokase.miyazaki.jp/material/files/group/9/R2_1_kaigiroku.pdf">
          令和2年第1回(3月)定例会会議録(PDFファイル:2.1MB)
        </a></p>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和2年第1回定例会");
    expect(meetings[0]!.heldOn).toBe("2020-03-01");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.gokase.miyazaki.jp/material/files/group/9/R2_1_kaigiroku.pdf"
    );
  });

  it("メタ情報を抽出できないリンクはスキップする", () => {
    const html = `
      <p class="file-link-item"><a class="pdf" href="//www.town.gokase.miyazaki.jp/material/files/group/9/teireikai0601.pdf">
        令和6年第1回(3月)定例会会議録 (PDFファイル: 1.7MB)
      </a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.gokase.miyazaki.jp/material/files/group/9/other.pdf">
        議事日程一覧 (PDFファイル: 0.2MB)
      </a></p>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });
});
