import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和6年（2024年）</h3>
      ◆第2回 定例会
      <strong>●令和6年6月12日</strong>
      <a href="https://mitake-gikai.com/download_file/view/445/296">→ダウンロード</a>
      <strong>●令和6年6月19日</strong>
      <a href="https://mitake-gikai.com/download_file/view/446/296">→ダウンロード</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://mitake-gikai.com/download_file/view/445/296"
    );
    expect(meetings[0]!.heldOn).toBe("2024-06-12");
    expect(meetings[0]!.sessionType).toBe("定例会");
    expect(meetings[0]!.fileId).toBe("445");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://mitake-gikai.com/download_file/view/446/296"
    );
    expect(meetings[1]!.heldOn).toBe("2024-06-19");
  });

  it("臨時会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和5年（2023年）</h3>
      ◆第1回臨時会
      <strong>●令和5年2月9日</strong>
      <a href="https://mitake-gikai.com/download_file/view/381/296">→ダウンロード</a>
    `;

    const meetings = parseListPage(html, 2023);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionType).toBe("臨時会");
    expect(meetings[0]!.heldOn).toBe("2023-02-09");
    expect(meetings[0]!.fileId).toBe("381");
  });

  it("委員会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和6年（2024年）</h3>
      ◆民生文教常任委員会
      <strong>●令和6年3月12日</strong>
      <a href="https://mitake-gikai.com/download_file/view/443/296">→ダウンロード</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionType).toBe("委員会");
    expect(meetings[0]!.heldOn).toBe("2024-03-12");
  });

  it("対象年でフィルタリングする", () => {
    const html = `
      <h3>令和6年（2024年）</h3>
      ◆第2回 定例会
      <strong>●令和6年6月12日</strong>
      <a href="https://mitake-gikai.com/download_file/view/445/296">→ダウンロード</a>
      <h3>令和5年（2023年）</h3>
      ◆第4回 定例会
      <strong>●令和5年12月5日</strong>
      <a href="https://mitake-gikai.com/download_file/view/399/296">→ダウンロード</a>
    `;

    const meetings2024 = parseListPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-06-12");

    const meetings2023 = parseListPage(html, 2023);
    expect(meetings2023).toHaveLength(1);
    expect(meetings2023[0]!.heldOn).toBe("2023-12-05");
  });

  it("download_file/view/ 以外のリンクは無視する", () => {
    const html = `
      <h3>令和6年（2024年）</h3>
      ◆第2回 定例会
      <strong>●令和6年6月12日</strong>
      <a href="https://mitake-gikai.com/other/page">その他リンク</a>
      <strong>●令和6年6月19日</strong>
      <a href="https://mitake-gikai.com/download_file/view/446/296">→ダウンロード</a>
    `;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-06-19");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("", 2024)).toEqual([]);
  });

  it("複数の会議種別が混在する場合に正しく分類する", () => {
    const html = `
      <h3>令和6年（2024年）</h3>
      ◆第1回 定例会
      <strong>●令和6年2月28日</strong>
      <a href="https://mitake-gikai.com/download_file/view/450/296">→ダウンロード</a>
      ◆民生文教常任委員会
      <strong>●令和6年3月12日</strong>
      <a href="https://mitake-gikai.com/download_file/view/443/296">→ダウンロード</a>
    `;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.sessionType).toBe("定例会");
    expect(meetings[1]!.sessionType).toBe("委員会");
  });
});
