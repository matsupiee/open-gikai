import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

// 実際の HTML 構造を反映したテスト:
// <h2> タグが年度ラベル（「■　令和７年」）
// <h3> タグ内のテーブルに会議行が並ぶ
// 各行: <td>会議名</td><td><a href="...pdf">リンクテキスト</a></td>

const buildHtml = (
  yearLabel: string,
  rows: Array<{ session: string; href: string; linkText: string }>
) => `
  <h2>${yearLabel}</h2>
  <h3>
    <table>
      ${rows
        .map(
          (r) => `
      <tr>
        <td>${r.session}</td>
        <td><a href="${r.href}">${r.linkText}</a></td>
      </tr>`
        )
        .join("")}
    </table>
  </h3>
`;

describe("parseListPage", () => {
  it("会議録リンクを抽出する", () => {
    const html = buildHtml("■　令和7年", [
      {
        session: "令和7年第4回（12月）定例会",
        href: "/div/gikai/pdf/HP/7_12giketu.pdf",
        linkText: "議決結果",
      },
      {
        session: "令和7年第4回（12月）定例会",
        href: "/div/gikai/pdf/HP/7_12kaigiroku1.pdf",
        linkText: "会議録➀",
      },
      {
        session: "令和7年第4回（12月）定例会",
        href: "/div/gikai/pdf/HP/7_12kaigiroku2.pdf",
        linkText: "会議録➁",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.linkText).toBe("会議録➀");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.soni.nara.jp/div/gikai/pdf/HP/7_12kaigiroku1.pdf"
    );
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[1]!.linkText).toBe("会議録➁");
  });

  it("議決結果リンクは除外する", () => {
    const html = buildHtml("■　令和7年", [
      {
        session: "令和7年第3回（9月）定例会",
        href: "/div/gikai/pdf/HP/79teire2.pdf",
        linkText: "議決結果",
      },
      {
        session: "令和7年第3回（9月）定例会",
        href: "/div/gikai/pdf/HP/79teire1.pdf",
        linkText: "会議録",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.linkText).toBe("会議録");
  });

  it("会議録テキストを含まないリンクはスキップする", () => {
    const html = buildHtml("■　令和7年", [
      {
        session: "令和7年第4回（12月）定例会",
        href: "/div/gikai/pdf/HP/somefile.pdf",
        linkText: "お知らせ",
      },
      {
        session: "令和7年第4回（12月）定例会",
        href: "/div/gikai/pdf/HP/7_12kaigiroku1.pdf",
        linkText: "会議録➀",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.linkText).toBe("会議録➀");
  });

  it("相対パス URL を https://www.vill.soni.nara.jp に正規化する", () => {
    const html = buildHtml("■　令和7年", [
      {
        session: "令和7年第1回（3月）定例会",
        href: "/div/gikai/pdf/7_3kaigiroku1.pdf",
        linkText: "会議録①",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.soni.nara.jp/div/gikai/pdf/7_3kaigiroku1.pdf"
    );
  });

  it("HP/ 配下と HP/ なしの両パスに対応する", () => {
    const html = buildHtml("■　令和7年", [
      {
        session: "令和7年第1回（3月）定例会",
        href: "/div/gikai/pdf/7_3kaigiroku1.pdf",
        linkText: "会議録①",
      },
      {
        session: "令和7年第1回（3月）定例会",
        href: "/div/gikai/pdf/HP/7_3kaigiroku2.pdf",
        linkText: "会議録➁",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toContain("/div/gikai/pdf/7_3kaigiroku1.pdf");
    expect(meetings[1]!.pdfUrl).toContain("/div/gikai/pdf/HP/7_3kaigiroku2.pdf");
  });

  it("臨時会の会議録も抽出する", () => {
    const html = buildHtml("■　令和7年", [
      {
        session: "令和7年第1回（5月）臨時会",
        href: "/div/gikai/pdf/HP/R71rinzigiketu.pdf",
        linkText: "議決結果",
      },
      {
        session: "令和7年第1回（5月）臨時会",
        href: "/div/gikai/pdf/HP/71rinzi2.pdf",
        linkText: "会議録",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionName).toContain("臨時会");
  });

  it("複数の年度セクションを正しく処理する", () => {
    const html =
      buildHtml("■　令和7年", [
        {
          session: "令和7年第4回（12月）定例会",
          href: "/div/gikai/pdf/HP/7_12kaigiroku1.pdf",
          linkText: "会議録➀",
        },
      ]) +
      buildHtml("■　令和6年", [
        {
          session: "令和6年第4回（12月）定例会",
          href: "/div/gikai/pdf/HP/teireigiketu.pdf",
          linkText: "議決結果",
        },
        {
          session: "令和6年第4回（12月）定例会",
          href: "/div/gikai/pdf/HP/dayori69.pdf",
          linkText: "会議録①",
        },
      ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[1]!.year).toBe(2024);
  });

  it("全角数字の年度（令和７年）を正しく処理する", () => {
    const html = buildHtml("■　令和７年", [
      {
        session: "令和７年第４回（１２月）定例会",
        href: "/div/gikai/pdf/HP/7_12kaigiroku1.pdf",
        linkText: "会議録➀",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2025);
  });

  it("会議名が sessionName に設定される", () => {
    const html = buildHtml("■　令和6年", [
      {
        session: "令和6年第2回（6月）定例会",
        href: "/div/gikai/pdf/HP/62teirei.pdf",
        linkText: "会議録①",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings[0]!.sessionName).toBe("令和6年第2回（6月）定例会");
  });

  it("HTML が空の場合は空配列を返す", () => {
    const meetings = parseListPage("");
    expect(meetings).toHaveLength(0);
  });

  it("令和5年の会議録を抽出する", () => {
    const html = buildHtml("■　令和5年", [
      {
        session: "令和5年第1回（5月）臨時会",
        href: "/div/gikai/pdf/HP/R51giketu.pdf",
        linkText: "議決結果",
      },
      {
        session: "令和5年第1回（5月）臨時会",
        href: "/div/gikai/pdf/HP/51rinji.pdf",
        linkText: "会議録",
      },
      {
        session: "令和5年第2回（6月）定例会",
        href: "/div/gikai/pdf/HP/R52giketu.pdf",
        linkText: "議決結果",
      },
      {
        session: "令和5年第2回（6月）定例会",
        href: "/div/gikai/pdf/HP/52tierei1.pdf",
        linkText: "会議録①",
      },
      {
        session: "令和5年第2回（6月）定例会",
        href: "/div/gikai/pdf/HP/52teirei2.pdf",
        linkText: "会議録➁",
      },
    ]);

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toContain("51rinji.pdf");
    expect(meetings[1]!.pdfUrl).toContain("52tierei1.pdf");
    expect(meetings[2]!.pdfUrl).toContain("52teirei2.pdf");
  });
});
