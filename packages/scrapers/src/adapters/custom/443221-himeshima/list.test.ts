import { describe, expect, it } from "vitest";
import { parsePageLinks } from "./list";

describe("parsePageLinks", () => {
  it("会議関連の PDF だけを抽出する", () => {
    const html = `
      <p><a href="/wp-content/uploads/2025/03/r7-1-teireikai-kaigiroku.pdf">令和7年第1回定例会 会議録（令和7年3月4日）</a></p>
      <p><a href="https://www.himeshima.jp/wp-content/uploads/2025/03/r7-1-ippan.pdf">令和7年第1回定例会 一般質問通告</a></p>
      <p><a href="/wp-content/uploads/20230629_R5giinmeibo_6.27.pdf">議員名簿</a></p>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0]!.pdfUrl).toBe(
      "https://www.himeshima.jp/wp-content/uploads/2025/03/r7-1-teireikai-kaigiroku.pdf"
    );
    expect(links[0]!.kind).toBe("minutes");
    expect(links[0]!.year).toBe(2025);
    expect(links[0]!.heldOn).toBe("2025-03-04");
    expect(links[0]!.meetingType).toBe("plenary");
    expect(links[1]!.kind).toBe("question-notice");
  });

  it("実ページにある案内資料の PDF は除外する", () => {
    const html = `
      <p><a href="https://www.himeshima.jp/wp-content/uploads/20230629_R5giinmeibo_6.27.pdf">議員名簿</a></p>
      <p><a href="https://www.himeshima.jp/wp-content/uploads/20230510_gityohukugityo.pdf">議長・副議長</a></p>
      <p><a href="https://www.himeshima.jp/wp-content/uploads/20230629_R5giinkousei_6.27.pdf">議会構成一覧表</a></p>
    `;

    expect(parsePageLinks(html)).toEqual([]);
  });

  it("URL 内の西暦日付から年と開催日を補完できる", () => {
    const html = `
      <p><a href="/wp-content/uploads/2025/04/20250415_soumu_iinkai_gijiroku.pdf">総務委員会 議事録</a></p>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.kind).toBe("minutes");
    expect(links[0]!.year).toBe(2025);
    expect(links[0]!.heldOn).toBe("2025-04-15");
    expect(links[0]!.meetingType).toBe("committee");
  });

  it("臨時会の会議種別を判定できる", () => {
    const html = `
      <p><a href="/wp-content/uploads/2025/02/r7-rinjikai-gian.pdf">令和7年臨時会 議案一覧</a></p>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.kind).toBe("agenda");
    expect(links[0]!.meetingType).toBe("extraordinary");
    expect(links[0]!.year).toBe(2025);
  });

  it("重複した PDF リンクは 1 件にまとめる", () => {
    const html = `
      <p><a href="/wp-content/uploads/2025/03/r7-1-teireikai-kaigiroku.pdf">令和7年第1回定例会 会議録</a></p>
      <p><a href="/wp-content/uploads/2025/03/r7-1-teireikai-kaigiroku.pdf">令和7年第1回定例会 会議録</a></p>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(1);
  });
});
