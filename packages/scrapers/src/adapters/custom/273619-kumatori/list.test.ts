import { describe, expect, it } from "vitest";
import { parseDateFromLinkText, parseYearPage } from "./list";

describe("parseDateFromLinkText", () => {
  it("単一日付を正しくパースする", () => {
    expect(parseDateFromLinkText("議会運営委員会（12月3日）", 2024)).toBe(
      "2024-12-03"
    );
  });

  it("複数日のうち最初の日付を使用する", () => {
    expect(
      parseDateFromLinkText("本会議（12月4日、5日、6日、17日）", 2024)
    ).toBe("2024-12-04");
  });

  it("月のみ1桁でも正しくパースする", () => {
    expect(parseDateFromLinkText("本会議（6月5日）", 2024)).toBe("2024-06-05");
  });

  it("日が1桁でもゼロパディングされる", () => {
    expect(parseDateFromLinkText("（3月7日）", 2024)).toBe("2024-03-07");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromLinkText("会議録", 2024)).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("h3 見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>3月定例会</h3>
      <ul>
        <li><a href="/material/files/group/30/R0603T-honkaigi.pdf">本会議（3月6日、7日、8日、22日）</a></li>
        <li><a href="/material/files/group/30/R0603T-iinkai.pdf">議会運営委員会（3月5日）</a></li>
      </ul>
      <h3>臨時会</h3>
      <ul>
        <li><a href="/material/files/group/30/R0605rinjikai.pdf">本会議（5月27日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.section).toBe("3月定例会");
    expect(meetings[0]!.title).toBe("3月定例会 本会議（3月6日、7日、8日、22日）");
    expect(meetings[0]!.heldOn).toBe("2024-03-06");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kumatori.lg.jp/material/files/group/30/R0603T-honkaigi.pdf"
    );

    expect(meetings[1]!.section).toBe("3月定例会");
    expect(meetings[1]!.title).toBe("3月定例会 議会運営委員会（3月5日）");
    expect(meetings[1]!.heldOn).toBe("2024-03-05");

    expect(meetings[2]!.section).toBe("臨時会");
    expect(meetings[2]!.title).toBe("臨時会 本会議（5月27日）");
    expect(meetings[2]!.heldOn).toBe("2024-05-27");
  });

  it("/material/files/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <h3>3月定例会</h3>
      <ul>
        <li><a href="/other/path/document.pdf">別の文書</a></li>
        <li><a href="/material/files/group/30/R0603T-honkaigi.pdf">本会議（3月6日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kumatori.lg.jp/material/files/group/30/R0603T-honkaigi.pdf"
    );
  });

  it("プロトコル相対 URL（//www.town.kumatori.lg.jp/...）を正しく変換する", () => {
    const html = `
      <h3>12月定例会</h3>
      <ul>
        <li><a href="//www.town.kumatori.lg.jp/material/files/group/30/R0612T-honkaigi.pdf">本会議（12月4日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kumatori.lg.jp/material/files/group/30/R0612T-honkaigi.pdf"
    );
  });

  it("委員会・全員協議会のリンクも抽出する", () => {
    const html = `
      <h3>議員全員協議会</h3>
      <ul>
        <li><a href="/material/files/group/30/R061212-zenkyou.pdf">（12月12日）</a></li>
      </ul>
      <h3>常任委員会</h3>
      <ul>
        <li><a href="/material/files/group/30/R06-sangyou.pdf">産業建設常任委員会（12月10日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.section).toBe("議員全員協議会");
    expect(meetings[0]!.heldOn).toBe("2024-12-12");
    expect(meetings[1]!.section).toBe("常任委員会");
    expect(meetings[1]!.heldOn).toBe("2024-12-10");
  });

  it("日付が取得できない PDF は heldOn が null になる", () => {
    const html = `
      <h3>決算審査特別委員会</h3>
      <ul>
        <li><a href="/material/files/group/30/R06-kessanshinsa.pdf">会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("対象年度がない場合は空配列を返す", () => {
    const meetings = parseYearPage("", 1999);
    expect(meetings).toHaveLength(0);
  });
});
