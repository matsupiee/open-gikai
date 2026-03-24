import { describe, expect, it } from "vitest";
import { parseYearPageUrls, parseYearPage } from "./list";

describe("parseYearPageUrls", () => {
  it("年度別ページの URL を抽出する", () => {
    const html = `
      <a href="/government/chousei/council/chougikai_kaigiroku/1655">令和７年　会議録</a>
      <a href="/government/chousei/council/chougikai_kaigiroku/1373">令和６年　会議録</a>
      <a href="/government/chousei/council/chougikai_kaigiroku/1038">令和5年　会議録</a>
    `;

    const urls = parseYearPageUrls(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(
      "https://www.town.oe.yamagata.jp/government/chousei/council/chougikai_kaigiroku/1655",
    );
    expect(urls[1]).toBe(
      "https://www.town.oe.yamagata.jp/government/chousei/council/chougikai_kaigiroku/1373",
    );
    expect(urls[2]).toBe(
      "https://www.town.oe.yamagata.jp/government/chousei/council/chougikai_kaigiroku/1038",
    );
  });

  it("重複する URL は1件のみ返す", () => {
    const html = `
      <a href="/government/chousei/council/chougikai_kaigiroku/1373">令和６年　会議録</a>
      <a href="/government/chousei/council/chougikai_kaigiroku/1373">令和６年　会議録（再掲）</a>
    `;

    const urls = parseYearPageUrls(html);
    expect(urls).toHaveLength(1);
  });

  it("対象外の href は無視する", () => {
    const html = `
      <a href="/government/chousei/council/chougikai_kaigiroku/">一覧</a>
      <a href="/files/original/abc.pdf">PDF</a>
      <a href="/government/chousei/council/chougikai_kaigiroku/1373">令和６年　会議録</a>
    `;

    const urls = parseYearPageUrls(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("1373");
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseYearPageUrls("<html></html>")).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  const SAMPLE_HTML = `
    <div class="content">
      <p>
        <a href="/files/original/202407111601181520315f11f.pdf">
          <img alt="pdfファイル" src="/cms/img/icon_pdf.png">
          第1回定例会（令和6年3月11日～22日）PDF：1.8MB
        </a>
      </p>
      <p>
        <a href="/files/original/20240711161646203a30ec6ef.pdf">
          <img alt="pdfファイル" src="/cms/img/icon_pdf.png">
          予算特別委員会（令和6年3月19日～22日）PDF：996kB
        </a>
      </p>
      <p>
        <a href="/files/original/202407111607564394533d138.pdf">
          <img alt="pdfファイル" src="/cms/img/icon_pdf.png">
          第1回臨時会（令和6年4月23日～24日）PDF：695kB
        </a>
      </p>
      <p>
        <a href="/files/original/2024071116083268576faf348.pdf">
          <img alt="pdfファイル" src="/cms/img/icon_pdf.png">
          第2回臨時会（令和6年5月8日）PDF：292kB
        </a>
      </p>
      <p>
        <a href="/files/original/20241224160540551d0d6fa28.pdf">
          <img alt="pdfファイル" src="/cms/img/icon_pdf.png">
          第2回定例会（令和6年6月6日～11日）PDF：1.3MB
        </a>
      </p>
    </div>
  `;

  it("PDF リンクを正しく抽出する", () => {
    const meetings = parseYearPage(SAMPLE_HTML);

    expect(meetings).toHaveLength(5);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.oe.yamagata.jp/files/original/202407111601181520315f11f.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-03-11");
    expect(meetings[0]!.sessionName).toBe("第1回定例会");
  });

  it("委員会を正しく識別する", () => {
    const meetings = parseYearPage(SAMPLE_HTML);

    const committee = meetings.find((m) => m.sessionName.includes("委員会"));
    expect(committee).toBeDefined();
    expect(committee!.heldOn).toBe("2024-03-19");
  });

  it("臨時会を正しく識別する", () => {
    const meetings = parseYearPage(SAMPLE_HTML);

    const rinji = meetings.filter((m) => m.sessionName.includes("臨時"));
    expect(rinji).toHaveLength(2);
    expect(rinji[0]!.heldOn).toBe("2024-04-23");
    expect(rinji[1]!.heldOn).toBe("2024-05-08");
  });

  it("year フィルタで対象年のみ返す", () => {
    const html = `
      <p>
        <a href="/files/original/abc1.pdf">第1回定例会（令和6年3月11日）PDF：1MB</a>
      </p>
      <p>
        <a href="/files/original/abc2.pdf">第1回定例会（令和5年3月10日）PDF：1MB</a>
      </p>
    `;

    const meetings2024 = parseYearPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-03-11");

    const meetings2023 = parseYearPage(html, 2023);
    expect(meetings2023).toHaveLength(1);
    expect(meetings2023[0]!.heldOn).toBe("2023-03-10");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <p><a href="/files/original/abc.pdf">会議録一覧</a></p>
      <p><a href="/files/original/def.pdf">第1回定例会（令和6年3月11日）PDF：1MB</a></p>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("/files/original/ 以外の PDF はスキップする", () => {
    const html = `
      <p><a href="/other/abc.pdf">第1回定例会（令和6年3月11日）PDF：1MB</a></p>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("タイトルからファイルサイズ表記を除去する", () => {
    const meetings = parseYearPage(SAMPLE_HTML);

    for (const m of meetings) {
      expect(m.title).not.toMatch(/PDF[:：]/);
      expect(m.title).not.toMatch(/\d+MB/);
      expect(m.title).not.toMatch(/\d+kB/);
    }
  });

  it("全角数字の令和年も正しくパースする", () => {
    const html = `
      <p>
        <a href="/files/original/abc.pdf">第４回定例会（令和６年12月3日～6日）PDF：1.1MB</a>
      </p>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-03");
    expect(meetings[0]!.sessionName).toBe("第４回定例会");
  });
});
