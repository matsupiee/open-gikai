import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseDateFromLinkText,
  parseSessionFromLinkText,
} from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikaijimukyoku/2/7462.html">令和7年宝達志水町議会会議録</a></li>
        <li><a href="/soshiki/gikaijimukyoku/2/6614.html">令和6年宝達志水町議会会議録</a></li>
        <li><a href="/soshiki/gikaijimukyoku/2/5550.html">令和5年宝達志水町議会会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年宝達志水町議会会議録");
    expect(pages[0]!.url).toBe(
      "https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/7462.html"
    );
    expect(pages[1]!.label).toBe("令和6年宝達志水町議会会議録");
    expect(pages[2]!.label).toBe("令和5年宝達志水町議会会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/soshiki/gikaijimukyoku/2/1234.html">お知らせ</a>
      <a href="/soshiki/gikaijimukyoku/2/7462.html">令和7年宝達志水町議会会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年宝達志水町議会会議録");
  });
});

describe("parseDateFromLinkText", () => {
  it("標準形式の日付をパースする（令和）", () => {
    expect(
      parseDateFromLinkText(
        "令和5年第1回定例会会議録（3月2日〜3月10日）(PDFファイル: 722.6KB)"
      )
    ).toBe("2023-03-02");
  });

  it("臨時会の日付をパースする", () => {
    expect(
      parseDateFromLinkText("令和5年第1回臨時会会議録（1月6日）")
    ).toBe("2023-01-06");
  });

  it("平成の日付をパースする", () => {
    expect(
      parseDateFromLinkText("平成30年第1回定例会会議録（3月5日）")
    ).toBe("2018-03-05");
  });

  it("令和元年をパースする", () => {
    expect(
      parseDateFromLinkText("令和元年第1回臨時会会議録（5月14日）")
    ).toBe("2019-05-14");
  });

  it("旧形式 RX年M月 をパースする", () => {
    expect(parseDateFromLinkText("宝達志水町R6年3月定例会")).toBe(
      "2024-03-01"
    );
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromLinkText("資料一覧")).toBeNull();
  });
});

describe("parseSessionFromLinkText", () => {
  it("第N回定例会を抽出する", () => {
    expect(
      parseSessionFromLinkText("令和5年第1回定例会会議録（3月2日）")
    ).toBe("第1回定例会");
  });

  it("第N回臨時会を抽出する", () => {
    expect(
      parseSessionFromLinkText("令和5年第1回臨時会会議録（1月6日）")
    ).toBe("第1回臨時会");
  });

  it("旧形式を抽出する", () => {
    expect(parseSessionFromLinkText("宝達志水町R6年3月定例会")).toBe(
      "3月定例会"
    );
  });

  it("種別が不明な場合は空文字を返す", () => {
    expect(parseSessionFromLinkText("資料一覧")).toBe("");
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/5550.html";

  it("PDF リンクを正しく抽出する（標準形式）", () => {
    const html = `
      <h2>関連書類</h2>
      <p>
        <a href="//www.hodatsushimizu.jp/material/files/group/13/05010601.pdf">
          令和5年第1回臨時会会議録（1月6日）(PDFファイル: 209.8KB)
        </a>
      </p>
      <p>
        <a href="//www.hodatsushimizu.jp/material/files/group/13/05030201.pdf">
          令和5年第1回定例会会議録（3月2日〜3月10日）(PDFファイル: 722.6KB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2023);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("令和5年第1回臨時会会議録（1月6日）");
    expect(meetings[0]!.heldOn).toBe("2023-01-06");
    expect(meetings[0]!.session).toBe("第1回臨時会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.hodatsushimizu.jp/material/files/group/13/05010601.pdf"
    );

    expect(meetings[1]!.title).toBe(
      "令和5年第1回定例会会議録（3月2日〜3月10日）"
    );
    expect(meetings[1]!.heldOn).toBe("2023-03-02");
    expect(meetings[1]!.session).toBe("第1回定例会");
  });

  it("旧形式のリンクテキストも抽出する", () => {
    const html = `
      <p>
        <a href="//www.hodatsushimizu.jp/material/files/group/13/R60301.pdf">
          宝達志水町R6年3月定例会(PDFファイル: 500KB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("宝達志水町R6年3月定例会");
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[0]!.session).toBe("3月定例会");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <p>
        <a href="//www.hodatsushimizu.jp/material/files/group/13/05010601.pdf">
          令和5年第1回臨時会会議録（1月6日）(PDFファイル: 209.8KB)
        </a>
      </p>
      <p>
        <a href="//www.hodatsushimizu.jp/material/files/group/13/meibo.pdf">
          議員名簿
        </a>
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2023);
    expect(meetings).toHaveLength(1);
  });
});
