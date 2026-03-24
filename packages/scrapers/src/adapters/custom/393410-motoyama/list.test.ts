import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("ul.level1col2 内の年度ページリンクを抽出する", () => {
    const html = `
      <ul class="level1col2">
        <li class="page">
          <a href="/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/3349.html">令和7年定例会・臨時会会議録</a>
        </li>
        <li class="page">
          <a href="/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/1133.html">令和6年定例会・臨時会会議録</a>
        </li>
      </ul>
    `;

    const links = parseTopPage(html);

    expect(links).toHaveLength(2);
    expect(links[0]!.url).toBe(
      "https://www.town.motoyama.kochi.jp/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/3349.html"
    );
    expect(links[0]!.title).toBe("令和7年定例会・臨時会会議録");
    expect(links[1]!.url).toBe(
      "https://www.town.motoyama.kochi.jp/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/1133.html"
    );
    expect(links[1]!.title).toBe("令和6年定例会・臨時会会議録");
  });

  it("プロトコル省略 URL (//www...) を https: に変換する", () => {
    const html = `
      <ul class="level1col2">
        <li class="page">
          <a href="//www.town.motoyama.kochi.jp/some/page.html">令和6年定例会・臨時会会議録</a>
        </li>
      </ul>
    `;

    const links = parseTopPage(html);
    expect(links[0]!.url).toBe("https://www.town.motoyama.kochi.jp/some/page.html");
  });

  it("ul class に追加クラスがある場合も抽出する（例: level1col2 clearfix）", () => {
    const html = `
      <ul class="level1col2 clearfix">
        <li class="page">
          <a href="/some/page.html">令和6年定例会・臨時会会議録</a>
        </li>
      </ul>
    `;

    const links = parseTopPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe("令和6年定例会・臨時会会議録");
  });

  it("リンクが存在しない場合は空配列を返す", () => {
    const html = `<ul class="level1col2"></ul>`;
    expect(parseTopPage(html)).toHaveLength(0);
  });

  it("ul.level1col2 がない場合は空配列を返す", () => {
    const html = `<div><a href="/other.html">その他リンク</a></div>`;
    expect(parseTopPage(html)).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  const yearPageUrl = "https://www.town.motoyama.kochi.jp/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/1133.html";

  it("h3 → wysiwyg → file-link-item の構造から PDF エントリを抽出する", () => {
    const html = `
      <div class="free-layout-area">
        <h3>第9回本山町議会定例会会議録</h3>
        <div class="wysiwyg">
          <p>会期：令和6年12月3日～12月12日</p>
        </div>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.motoyama.kochi.jp/material/files/group/12/061203.pdf">
            12月3日 開会日 (PDFファイル: 348.1KB)
          </a>
        </p>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.motoyama.kochi.jp/material/files/group/12/061210.pdf">
            12月10日 一般質問 (PDFファイル: 1.1MB)
          </a>
        </p>
      </div>
    `;

    const entries = parseYearPage(html, yearPageUrl, 2024);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.meetingTitle).toBe("第9回本山町議会定例会会議録");
    expect(entries[0]!.heldOn).toBe("2024-12-03");
    expect(entries[0]!.label).toBe("12月3日 開会日");
    expect(entries[0]!.pdfUrl).toBe(
      "https://www.town.motoyama.kochi.jp/material/files/group/12/061203.pdf"
    );
    expect(entries[0]!.year).toBe(2024);
    expect(entries[1]!.label).toBe("12月10日 一般質問");
    expect(entries[1]!.pdfUrl).toBe(
      "https://www.town.motoyama.kochi.jp/material/files/group/12/061210.pdf"
    );
  });

  it("複数の会議セクションを処理する", () => {
    const html = `
      <div class="free-layout-area">
        <h3>第9回本山町議会定例会会議録</h3>
        <div class="wysiwyg">
          <p>会期：令和6年12月3日～12月12日</p>
        </div>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.motoyama.kochi.jp/material/files/group/12/061203.pdf">
            12月3日 開会日
          </a>
        </p>
        <h3>第1回本山町議会臨時会会議録</h3>
        <div class="wysiwyg">
          <p>会期：令和6年2月15日</p>
        </div>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.motoyama.kochi.jp/material/files/group/12/060215.pdf">
            2月15日 臨時会
          </a>
        </p>
      </div>
    `;

    const entries = parseYearPage(html, yearPageUrl, 2024);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.meetingTitle).toBe("第9回本山町議会定例会会議録");
    expect(entries[0]!.heldOn).toBe("2024-12-03");
    expect(entries[1]!.meetingTitle).toBe("第1回本山町議会臨時会会議録");
    expect(entries[1]!.heldOn).toBe("2024-02-15");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <div class="free-layout-area">
        <h3>第9回本山町議会定例会会議録</h3>
        <div class="wysiwyg"><p>会期：令和6年12月3日</p></div>
      </div>
    `;
    expect(parseYearPage(html, yearPageUrl, 2024)).toHaveLength(0);
  });

  it("yearPageUrl を各エントリに設定する", () => {
    const html = `
      <div class="free-layout-area">
        <h3>第9回本山町議会定例会会議録</h3>
        <div class="wysiwyg"><p>会期：令和6年12月3日</p></div>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.motoyama.kochi.jp/material/files/group/12/061203.pdf">
            12月3日 開会日
          </a>
        </p>
      </div>
    `;

    const entries = parseYearPage(html, yearPageUrl, 2024);
    expect(entries[0]!.yearPageUrl).toBe(yearPageUrl);
  });
});
