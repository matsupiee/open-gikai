import { describe, expect, it } from "vitest";
import { parseListPage, isTocFileName, buildTitleFromLink } from "./list";

describe("isTocFileName", () => {
  it("mokuzi を含むファイル名を目次と判定する", () => {
    expect(isTocFileName("mokuzi04.pdf")).toBe(true);
  });

  it("mokugi を含むファイル名を目次と判定する", () => {
    expect(isTocFileName("mokugiR7.pdf")).toBe(true);
  });

  it("mokuji を含むファイル名を目次と判定する", () => {
    expect(isTocFileName("5050401mokuji.pdf")).toBe(true);
  });

  it("大文字混在でも目次と判定する", () => {
    expect(isTocFileName("R7_mokuzi.pdf")).toBe(true);
  });

  it("目次でないファイル名は false を返す", () => {
    expect(isTocFileName("R704.pdf")).toBe(false);
  });

  it("通常の PDF ファイル名は false を返す", () => {
    expect(isTocFileName("R061211.pdf")).toBe(false);
  });

  it("docx ファイル名でも目次判定できる", () => {
    expect(isTocFileName("mokuzi01.docx")).toBe(true);
  });
});

describe("buildTitleFromLink", () => {
  it("リンクテキストがある場合はリンクテキストを返す", () => {
    const title = buildTitleFromLink("令和6年第4回定例会 第1日目", "R061211.pdf");
    expect(title).toBe("令和6年第4回定例会 第1日目");
  });

  it("リンクテキストが空の場合はファイル名を返す", () => {
    const title = buildTitleFromLink("", "R704.pdf");
    expect(title).toBe("R704.pdf");
  });

  it("空白のみのリンクテキストはファイル名を返す", () => {
    const title = buildTitleFromLink("   ", "R7042.pdf");
    expect(title).toBe("R7042.pdf");
  });

  it("複数の空白を正規化する", () => {
    const title = buildTitleFromLink("第1回  定例会", "R7_01.pdf");
    expect(title).toBe("第1回 定例会");
  });
});

describe("parseListPage", () => {
  it("files/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <div class="content">
          <h2>令和6年度 会議録</h2>
          <a href="files/R061211.pdf">令和6年第4回定例会 第1日目</a>
          <a href="files/R061212.pdf">令和6年第4回定例会 第2日目</a>
          <a href="files/060909.pdf">令和6年第3回定例会 第1日目</a>
        </div>
      </body>
      </html>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(3);
    expect(sessions[0]!.pdfUrl).toBe(
      "https://www.town.taiji.wakayama.jp/gikai/files/R061211.pdf",
    );
    expect(sessions[0]!.fileName).toBe("R061211.pdf");
    expect(sessions[0]!.title).toBe("令和6年第4回定例会 第1日目");
    expect(sessions[0]!.heldOn).toBeNull();
    expect(sessions[0]!.meetingType).toBe("plenary");
  });

  it("目次ファイルを除外する", () => {
    const html = `
      <a href="files/mokuzi04.pdf">第4回定例会 目次</a>
      <a href="files/R061211.pdf">第4回定例会 第1日目</a>
      <a href="files/mokugiR7.pdf">令和7年 目次</a>
      <a href="files/R704.pdf">令和7年第4回定例会 第1日目</a>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.fileName).toBe("R061211.pdf");
    expect(sessions[1]!.fileName).toBe("R704.pdf");
  });

  it("重複 URL を除外する", () => {
    const html = `
      <a href="files/R704.pdf">第4回定例会 第1日目</a>
      <a href="files/R704.pdf">第4回定例会 第1日目（再掲）</a>
    `;

    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(1);
  });

  it("PDF リンクが存在しない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(0);
  });

  it("臨時会のリンクを extraordinary として分類する", () => {
    const html = `
      <a href="files/R7rinji01.pdf">令和7年第3回臨時会 第1日目</a>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.meetingType).toBe("extraordinary");
  });

  it("絶対 URL のリンクをそのまま使用する", () => {
    const html = `
      <a href="https://www.town.taiji.wakayama.jp/gikai/files/R704.pdf">第4回定例会</a>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.pdfUrl).toBe(
      "https://www.town.taiji.wakayama.jp/gikai/files/R704.pdf",
    );
  });

  it("docx ファイルも取得対象とする", () => {
    const html = `
      <a href="files/50509121.docx">令和5年9月定例会 議事録</a>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.pdfUrl).toBe(
      "https://www.town.taiji.wakayama.jp/gikai/files/50509121.docx",
    );
    expect(sessions[0]!.fileName).toBe("50509121.docx");
  });

  it("ルート相対 URL を正しく変換する", () => {
    const html = `
      <a href="/gikai/files/R704.pdf">第4回定例会</a>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.pdfUrl).toBe(
      "https://www.town.taiji.wakayama.jp/gikai/files/R704.pdf",
    );
  });
});
