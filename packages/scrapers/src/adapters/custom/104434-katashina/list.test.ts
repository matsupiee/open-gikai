import { describe, expect, it } from "vitest";
import { parseHeldOnHint, parseListPage, parseTableRows } from "./list";

describe("parseHeldOnHint", () => {
  it("リンク文言から開催日を抽出する", () => {
    expect(parseHeldOnHint("令和6年12月6日（金）議事日程 第1号")).toBe("2024-12-06");
  });
});

describe("parseTableRows", () => {
  it("rowspan で省略された会議名称を引き継いで PDF 一覧を返す", () => {
    const html = `
      <table>
        <tr>
          <td>会議名称</td>
          <td>開催日・議事日程</td>
          <td>ファイルサイズ</td>
        </tr>
        <tr>
          <td rowspan="2">令和6年 第4回 定例会</td>
          <td><a href="files/r6-4-1.pdf">令和6年12月6日（金）議事日程 第1号</a></td>
          <td>385KB</td>
        </tr>
        <tr>
          <td><a href="files/r6-4-2.pdf">令和6年12月13日（金）議事日程 第2号</a></td>
          <td>265KB</td>
        </tr>
        <tr>
          <td>令和6年 第3回 臨時会</td>
          <td><a href="files/r6-3.pdf">令和6年11月1日（金）議事日程 第1号</a></td>
          <td>240KB</td>
        </tr>
      </table>
    `;

    expect(parseTableRows(html)).toEqual([
      {
        pdfUrl:
          "https://www.vill.katashina.gunma.jp/gaiyou/kakuka/gikai/files/r6-4-1.pdf",
        title: "令和6年 第4回 定例会 令和6年12月6日（金）議事日程 第1号",
        sessionTitle: "令和6年 第4回 定例会",
        meetingType: "plenary",
        heldOnHint: "2024-12-06",
      },
      {
        pdfUrl:
          "https://www.vill.katashina.gunma.jp/gaiyou/kakuka/gikai/files/r6-4-2.pdf",
        title: "令和6年 第4回 定例会 令和6年12月13日（金）議事日程 第2号",
        sessionTitle: "令和6年 第4回 定例会",
        meetingType: "plenary",
        heldOnHint: "2024-12-13",
      },
      {
        pdfUrl:
          "https://www.vill.katashina.gunma.jp/gaiyou/kakuka/gikai/files/r6-3.pdf",
        title: "令和6年 第3回 臨時会 令和6年11月1日（金）議事日程 第1号",
        sessionTitle: "令和6年 第3回 臨時会",
        meetingType: "extraordinary",
        heldOnHint: "2024-11-01",
      },
    ]);
  });
});

describe("parseListPage", () => {
  it("指定年の会議だけを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td rowspan="2">令和7年 第2回 定例会</td>
          <td><a href="files/070306.pdf">令和7年3月6日（木）議事日程 第1号</a></td>
          <td>596KB</td>
        </tr>
        <tr>
          <td><a href="files/070314.pdf">令和7年3月14日（金）議事日程 第2号</a></td>
          <td>374KB</td>
        </tr>
        <tr>
          <td rowspan="2">令和6年 第4回 定例会</td>
          <td><a href="files/r6-4-1.pdf">令和6年12月6日（金）議事日程 第1号</a></td>
          <td>385KB</td>
        </tr>
        <tr>
          <td><a href="files/r6-4-2.pdf">令和6年12月13日（金）議事日程 第2号</a></td>
          <td>265KB</td>
        </tr>
      </table>
    `;

    expect(parseListPage(html, 2025)).toEqual([
      {
        pdfUrl:
          "https://www.vill.katashina.gunma.jp/gaiyou/kakuka/gikai/files/070306.pdf",
        title: "令和7年 第2回 定例会 令和7年3月6日（木）議事日程 第1号",
        sessionTitle: "令和7年 第2回 定例会",
        meetingType: "plenary",
        heldOnHint: "2025-03-06",
      },
      {
        pdfUrl:
          "https://www.vill.katashina.gunma.jp/gaiyou/kakuka/gikai/files/070314.pdf",
        title: "令和7年 第2回 定例会 令和7年3月14日（金）議事日程 第2号",
        sessionTitle: "令和7年 第2回 定例会",
        meetingType: "plenary",
        heldOnHint: "2025-03-14",
      },
    ]);
  });
});
