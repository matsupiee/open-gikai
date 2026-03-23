import { describe, it, expect } from "vitest";
import { parseListPage, parseDateFromLinkText } from "./list";

describe("parseDateFromLinkText", () => {
  it("単日の開催日をパースする", () => {
    expect(
      parseDateFromLinkText(
        "令和8年第1回臨時会本会議（令和8年2月12日）（PDF：417KB）",
      ),
    ).toBe("2026-02-12");
  });

  it("複数日にまたがる場合は初日を返す", () => {
    expect(
      parseDateFromLinkText(
        "令和7年第4回定例会本会議（令和7年12月9日から12月12日）（PDF：1,249KB）",
      ),
    ).toBe("2025-12-09");
  });

  it("「まで」付きの複数日でも初日を返す", () => {
    expect(
      parseDateFromLinkText(
        "令和7年第1回定例会本会議（令和7年2月28日から3月10日まで）（PDF：1,624KB）",
      ),
    ).toBe("2025-02-28");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromLinkText("資料一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("対象年度の PDF リンクのみ抽出する", () => {
    const html = `
      <div class="h2bg"><div><h2>令和8年分会議録</h2></div></div>
      <p class="filelink">
        <a class="pdf" href="gikai-kaigiroku.files/0801-ri.pdf" target="_blank">
          令和8年第1回臨時会本会議（令和8年2月12日）（PDF：417KB）
        </a>
      </p>
      <div class="h2bg"><div><h2>令和7年分会議録</h2></div></div>
      <p class="filelink">
        <a class="pdf" href="gikai-kaigiroku.files/0704-teirei.pdf" target="_blank">
          令和7年第4回定例会本会議（令和7年12月9日から12月12日）（PDF：1,249KB）
        </a>
      </p>
      <p class="filelink">
        <a class="pdf" href="gikai-kaigiroku.files/0703-kessann.pdf" target="_blank">
          令和7年第3回定例会決算特別委員会（令和7年9月8日）（PDF：500KB）
        </a>
      </p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe(
      "令和7年第4回定例会本会議（令和7年12月9日から12月12日）",
    );
    expect(meetings[0]!.heldOn).toBe("2025-12-09");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ajigasawa.lg.jp/about_town/gikai/gikai-kaigiroku.files/0704-teirei.pdf",
    );
    expect(meetings[0]!.fileKey).toBe("0704-teirei");

    expect(meetings[1]!.title).toBe(
      "令和7年第3回定例会決算特別委員会（令和7年9月8日）",
    );
    expect(meetings[1]!.heldOn).toBe("2025-09-08");
    expect(meetings[1]!.fileKey).toBe("0703-kessann");
  });

  it("令和8年を指定すると令和8年セクションのみ返す", () => {
    const html = `
      <div class="h2bg"><div><h2>令和8年分会議録</h2></div></div>
      <p class="filelink">
        <a class="pdf" href="gikai-kaigiroku.files/0801-ri.pdf" target="_blank">
          令和8年第1回臨時会本会議（令和8年2月12日）（PDF：417KB）
        </a>
      </p>
      <div class="h2bg"><div><h2>令和7年分会議録</h2></div></div>
      <p class="filelink">
        <a class="pdf" href="gikai-kaigiroku.files/0704-teirei.pdf" target="_blank">
          令和7年第4回定例会本会議（令和7年12月9日から12月12日）（PDF：1,249KB）
        </a>
      </p>
    `;

    const meetings = parseListPage(html, 2026);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe(
      "令和8年第1回臨時会本会議（令和8年2月12日）",
    );
    expect(meetings[0]!.heldOn).toBe("2026-02-12");
  });

  it("該当年度がない場合は空配列を返す", () => {
    const html = `
      <div class="h2bg"><div><h2>令和7年分会議録</h2></div></div>
      <p class="filelink">
        <a class="pdf" href="gikai-kaigiroku.files/0704-teirei.pdf" target="_blank">
          令和7年第4回定例会本会議（令和7年12月9日から12月12日）（PDF：1,249KB）
        </a>
      </p>
    `;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("PDF サイズ情報がタイトルから除去される", () => {
    const html = `
      <div class="h2bg"><div><h2>令和7年分会議録</h2></div></div>
      <p class="filelink">
        <a class="pdf" href="gikai-kaigiroku.files/0701-teirei.pdf" target="_blank">
          令和7年第1回定例会本会議（令和7年2月28日から3月10日まで）（PDF：1,624KB）
        </a>
      </p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe(
      "令和7年第1回定例会本会議（令和7年2月28日から3月10日まで）",
    );
  });
});
