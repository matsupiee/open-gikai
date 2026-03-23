import { describe, expect, it } from "vitest";
import {
  extractYearFromLabel,
  isFullRecord,
  parseTopPage,
  parseYearPage,
} from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <div>
        <a href="https://www.town.happo.lg.jp/archive/p20250124101624">八峰町議会議事録2025年（令和7年）</a>
        <a href="https://www.town.happo.lg.jp/archive/p20240515151649">八峰町議会議事録2024年（令和６年）</a>
        <a href="https://www.town.happo.lg.jp/archive/contents-820">八峰町議会議事録2022年（令和４年）</a>
      </div>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("八峰町議会議事録2025年（令和7年）");
    expect(pages[0]!.url).toBe(
      "https://www.town.happo.lg.jp/archive/p20250124101624",
    );
    expect(pages[1]!.label).toBe("八峰町議会議事録2024年（令和６年）");
    expect(pages[2]!.url).toBe(
      "https://www.town.happo.lg.jp/archive/contents-820",
    );
  });

  it("議事録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/archive/contents-100">お知らせ</a>
      <a href="/archive/p20250124101624">八峰町議会議事録2025年（令和7年）</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("八峰町議会議事録2025年（令和7年）");
  });

  it("相対パスを絶対 URL に変換する", () => {
    const html = `
      <a href="/archive/contents-844">八峰町議会議事録2006年（平成18年）</a>
    `;

    const pages = parseTopPage(html);
    expect(pages[0]!.url).toBe(
      "https://www.town.happo.lg.jp/archive/contents-844",
    );
  });
});

describe("extractYearFromLabel", () => {
  it("ラベルから西暦年を抽出する", () => {
    expect(extractYearFromLabel("八峰町議会議事録2025年（令和7年）")).toBe(2025);
  });

  it("西暦年がない場合は null を返す", () => {
    expect(extractYearFromLabel("お知らせ")).toBeNull();
  });
});

describe("isFullRecord", () => {
  it("全ページ版を true と判定する", () => {
    expect(
      isFullRecord(
        "令和７年９月八峰町議会定例会会議録（全ページ）",
        "令和７年９月八峰町議会定例会会議録.pdf",
      ),
    ).toBe(true);
  });

  it("日程別を false と判定する", () => {
    expect(
      isFullRecord(
        "令和７年９月八峰町議会定例会会議録　１日目（９月２日）",
        "１日目（９月２日）.pdf",
      ),
    ).toBe(false);
  });

  it("一般質問抜粋を false と判定する", () => {
    expect(
      isFullRecord(
        "１．笠原吉範議員一般質問部分",
        "１．笠原吉範議員一般質問部分.pdf",
      ),
    ).toBe(false);
  });

  it("旧形式のファイル名を true と判定する", () => {
    expect(
      isFullRecord(
        "001_kaigiroku2006-12.pdf",
        "001_kaigiroku2006-12.pdf",
      ),
    ).toBe(true);
  });
});

describe("parseYearPage", () => {
  const PAGE_URL = "https://www.town.happo.lg.jp/archive/p20250124101624";

  it("h3 見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和７年９月議会定例会</h3>
      <a href="/uploads/public/archive_0000002543_00/R7.9定例会/令和７年９月八峰町議会定例会会議録.pdf">令和７年９月八峰町議会定例会会議録（全ページ）</a>
      <a href="/uploads/public/archive_0000002543_00/R7.9定例会/１日目（９月２日）.pdf">１日目（９月２日）[694KB]</a>
      <h3>令和７年第５回臨時議会</h3>
      <a href="/uploads/public/archive_0000002543_00/令和７年第５回八峰町議会臨時会会議録.pdf">令和７年第５回八峰町議会臨時会会議録</a>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.section).toBe("令和７年９月議会定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.happo.lg.jp/uploads/public/archive_0000002543_00/R7.9定例会/令和７年９月八峰町議会定例会会議録.pdf",
    );

    expect(meetings[1]!.section).toBe("令和７年第５回臨時議会");
    expect(meetings[1]!.title).toBe("令和７年第５回臨時議会");
  });

  it("一般質問抜粋をスキップする", () => {
    const html = `
      <h3>令和７年９月議会定例会</h3>
      <a href="/uploads/public/archive_0000002543_00/令和７年９月八峰町議会定例会会議録.pdf">令和７年９月八峰町議会定例会会議録（全ページ）</a>
      <a href="/uploads/public/archive_0000002543_00/１．笠原吉範議員一般質問部分.pdf">１．笠原吉範議員一般質問部分</a>
      <a href="/uploads/public/archive_0000002543_00/２．山本優人議員一般質問部分.pdf">２．山本優人議員一般質問部分</a>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });

  it("旧形式の PDF リンクも抽出する", () => {
    const html = `
      <a href="/uploads/public/archive_0000000851_00/001_kaigiroku2006-12.pdf">001_kaigiroku2006-12.pdf（1MB）</a>
      <a href="/uploads/public/archive_0000000851_00/002_kaigirokurinji2006-10.pdf">002_kaigirokurinji2006-10.pdf（340KB）</a>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.happo.lg.jp/archive/contents-844",
    );

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.happo.lg.jp/uploads/public/archive_0000000851_00/001_kaigiroku2006-12.pdf",
    );
  });

  it("セクション見出しがない場合はリンクテキストをタイトルにする", () => {
    const html = `
      <a href="/uploads/public/archive_0000000851_00/001_kaigiroku2006-12.pdf">001_kaigiroku2006-12.pdf（1MB）</a>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.happo.lg.jp/archive/contents-844",
    );

    expect(meetings[0]!.title).toBe("001_kaigiroku2006-12.pdf（1MB）");
    expect(meetings[0]!.section).toBe("");
  });
});
