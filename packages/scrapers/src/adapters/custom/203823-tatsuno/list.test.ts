import { describe, expect, it } from "vitest";
import { parseIndexPage, parseYearPage, cleanLinkText } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成17年")).toBe(2005);
    expect(parseWarekiYear("平成30年")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6年12月定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和7年第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("cleanLinkText", () => {
  it("ファイルサイズ情報を除去する", () => {
    expect(
      cleanLinkText(
        "令和6年 第7回（12月）辰野町議会定例会会議録（最終日） (PDFファイル: 626.2KB)"
      )
    ).toBe("令和6年 第7回（12月）辰野町議会定例会会議録（最終日）");
  });

  it("MB 単位のファイルサイズ情報も除去する", () => {
    expect(
      cleanLinkText("令和6年 第5回（9月）定例会一般質問議事録 (PDFファイル: 2.2MB)")
    ).toBe("令和6年 第5回（9月）定例会一般質問議事録");
  });

  it("ファイルサイズ情報がない場合はそのまま返す", () => {
    expect(cleanLinkText("令和7年第1回（1月）臨時会会議録")).toBe(
      "令和7年第1回（1月）臨時会会議録"
    );
  });

  it("前後の空白を除去する", () => {
    expect(cleanLinkText("  令和6年 会議録  ")).toBe("令和6年 会議録");
  });
});

describe("parseIndexPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/3198.html">令和6年</a></li>
        <li><a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/2747.html">令和5年</a></li>
        <li><a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/2165.html">平成17年</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.url).toBe(
      "https://www.town.tatsuno.lg.jp/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/3198.html"
    );
    expect(result[1]!.year).toBe(2023);
    expect(result[2]!.year).toBe(2005);
  });

  it("重複リンクをスキップする", () => {
    const html = `
      <a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/3198.html">令和6年</a>
      <a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/3198.html">令和6年（再掲）</a>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
  });

  it("gikaigijiroku パターン以外のリンクは無視する", () => {
    const html = `
      <a href="/other/page.html">他のページ</a>
      <a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/3198.html">令和6年</a>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
  });

  it("年を特定できないリンクはスキップする", () => {
    const html = `
      <a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/9999.html">会議録一覧</a>
      <a href="/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/3198.html">令和6年</a>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2024);
  });
});

describe("parseYearPage", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <h2>定例会</h2>
      <h3>令和6年12月定例会</h3>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf">
          令和6年 第7回（12月）辰野町議会定例会会議録（最終日） (PDFファイル: 626.2KB)
        </a>
      </p>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12syonichi.pdf">
          令和6年 第7回（12月）辰野町議会定例会会議録（初日） (PDFファイル: 321.0KB)
        </a>
      </p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe(
      "令和6年 第7回（12月）辰野町議会定例会会議録（最終日）"
    );
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf"
    );
  });

  it("プロトコル省略形式（//）を https: に補完する", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf">
          令和6年 第7回（12月）辰野町議会定例会会議録（最終日） (PDFファイル: 626.2KB)
        </a>
      </p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf"
    );
  });

  it("会期日程 PDF を除外する", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12kaikinittei.pdf">
          令和6年12月定例会 会期日程 (PDFファイル: 100KB)
        </a>
      </p>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf">
          令和6年 第7回（12月）辰野町議会定例会会議録（最終日） (PDFファイル: 626.2KB)
        </a>
      </p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe(
      "令和6年 第7回（12月）辰野町議会定例会会議録（最終日）"
    );
  });

  it("臨時会を correctly に分類する", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2025-1rinjikai.pdf">
          令和7年第1回（1月）臨時会会議録 (PDFファイル: 471.3KB)
        </a>
      </p>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("file-link-item 以外の PDF リンクは無視する", () => {
    const html = `
      <p>
        <a class="pdf" href="//www.town.tatsuno.lg.jp/other.pdf">他のPDF</a>
      </p>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf">
          令和6年 第7回（12月）辰野町議会定例会会議録（最終日） (PDFファイル: 626.2KB)
        </a>
      </p>
    `;

    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p class='file-link-item'>準備中</p>";
    expect(parseYearPage(html, 2024)).toEqual([]);
  });

  it("sessionKey が一意に採番される", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf">
          令和6年 定例会会議録（最終日） (PDFファイル: 626.2KB)
        </a>
      </p>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12syonichi.pdf">
          令和6年 定例会会議録（初日） (PDFファイル: 321.0KB)
        </a>
      </p>
    `;

    const result = parseYearPage(html, 2024);
    expect(result[0]!.sessionKey).toBe("tatsuno_2024_0");
    expect(result[1]!.sessionKey).toBe("tatsuno_2024_1");
  });
});
