import { describe, expect, it } from "vitest";
import { parseYearlyPageLinks, parseYearlyPage } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年定例会会議録")).toBe(2025);
    expect(parseWarekiYear("令和6年定例会会議録")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年定例会会議録")).toBe(2019);
  });

  it("全角数字を正しく変換する", () => {
    expect(parseWarekiYear("令和７年")).toBe(2025);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成２５年第１回")).toBe(2013);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和7年第1回定例会会議録")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和7年第1回臨時会会議録")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearlyPageLinks", () => {
  it("ul.level1col2 内の li.page > a リンクを抽出する", () => {
    const html = `
      <ul class="level1col2 clearfix">
        <li class="page">
          <a href="https://www.town.nagawa.nagano.jp/gyoseijoho/gikai/teireikai-rinjikai/1/2426.html">令和7年定例会会議録</a>
        </li>
        <li class="page">
          <a href="https://www.town.nagawa.nagano.jp/gyoseijoho/gikai/teireikai-rinjikai/1/1796.html">令和6年定例会会議録</a>
        </li>
      </ul>
    `;

    const result = parseYearlyPageLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe(
      "https://www.town.nagawa.nagano.jp/gyoseijoho/gikai/teireikai-rinjikai/1/2426.html"
    );
    expect(result[0]!.title).toBe("令和7年定例会会議録");
    expect(result[1]!.url).toBe(
      "https://www.town.nagawa.nagano.jp/gyoseijoho/gikai/teireikai-rinjikai/1/1796.html"
    );
    expect(result[1]!.title).toBe("令和6年定例会会議録");
  });

  it("ul.level1col2 がない場合は空配列を返す", () => {
    const html = "<p>No list here</p>";
    expect(parseYearlyPageLinks(html)).toEqual([]);
  });

  it("li.page がない場合は空配列を返す", () => {
    const html = `
      <ul class="level1col2 clearfix">
        <li class="other"><a href="/test.html">テスト</a></li>
      </ul>
    `;
    expect(parseYearlyPageLinks(html)).toEqual([]);
  });
});

describe("parseYearlyPage", () => {
  it("p.file-link-item > a.pdf リンクを抽出する", () => {
    const html = `
      <div class="content">
        <p class="file-link-item">
          <a class="pdf" href="//www.town.nagawa.nagano.jp/material/files/group/11/reiwa6nennagawamatigikaidai1kaiteireikaikaigiroku.pdf">
            令和6年長和町議会第1回定例会会議録 (PDFファイル: 1.4MB)
          </a>
        </p>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.nagawa.nagano.jp/material/files/group/11/reiwa6nennagawamatigikaidai2kaiteireikaikaigiroku.pdf">
            令和6年長和町議会第2回定例会会議録 (PDFファイル: 2.1MB)
          </a>
        </p>
      </div>
    `;

    const result = parseYearlyPage(html, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年長和町議会第1回定例会会議録");
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.nagawa.nagano.jp/material/files/group/11/reiwa6nennagawamatigikaidai1kaiteireikaikaigiroku.pdf"
    );
    expect(result[0]!.sessionKey).toBe("nagawa_2024-1");

    expect(result[1]!.title).toBe("令和6年長和町議会第2回定例会会議録");
    expect(result[1]!.sessionKey).toBe("nagawa_2024-2");
  });

  it("プロトコル相対パスを絶対URLに変換する", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.nagawa.nagano.jp/material/files/group/11/test.pdf">
          令和7年長和町議会第3回定例会会議録 (PDFファイル: 1.0MB)
        </a>
      </p>
    `;

    const result = parseYearlyPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.nagawa.nagano.jp/material/files/group/11/test.pdf"
    );
  });

  it("ファイルサイズ情報がタイトルから除去される", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.nagawa.nagano.jp/material/files/group/11/test.pdf">
          令和5年長和町議会第4回定例会会議録 (PDFファイル: 3.6MB)
        </a>
      </p>
    `;

    const result = parseYearlyPage(html, 2023);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和5年長和町議会第4回定例会会議録");
  });

  it("p.file-link-item がない場合は空配列を返す", () => {
    const html = "<div><p>会議録はありません</p></div>";
    expect(parseYearlyPage(html, 2025)).toEqual([]);
  });
});
