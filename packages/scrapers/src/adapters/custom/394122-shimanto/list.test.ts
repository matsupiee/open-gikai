import { describe, expect, it } from "vitest";
import { parseListPage, parseYearTabs } from "./list";

describe("parseListPage", () => {
  it("会議録リンクから hdnId とタイトルを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="giji_dtl.php?hdnKatugi=130&hdnID=64692">
            令和８年第１回臨時会(開催日:2026/01/29)
          </a>
        </li>
        <li>
          <a href="giji_dtl.php?hdnKatugi=130&hdnID=63500">
            令和７年第４回定例会(開催日:2025/12/09)
          </a>
        </li>
      </ul>
    `;

    const records = parseListPage(html);

    expect(records).toHaveLength(2);

    expect(records[0]!.hdnId).toBe("64692");
    expect(records[0]!.title).toBe("令和８年第１回臨時会(開催日:2026/01/29)");
    expect(records[0]!.heldOn).toBe("2026-01-29");
    expect(records[0]!.meetingType).toBe("extraordinary");
    expect(records[0]!.detailUrl).toBe(
      "https://www.town.shimanto.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=130&hdnID=64692",
    );

    expect(records[1]!.hdnId).toBe("63500");
    expect(records[1]!.title).toBe("令和７年第４回定例会(開催日:2025/12/09)");
    expect(records[1]!.heldOn).toBe("2025-12-09");
    expect(records[1]!.meetingType).toBe("plenary");
  });

  it("amp;エスケープ付きリンクも解析できる", () => {
    const html = `
      <ul>
        <li>
          <a href="giji_dtl.php?hdnKatugi=130&amp;hdnID=64692">
            令和８年第１回臨時会(開催日:2026/01/29)
          </a>
        </li>
      </ul>
    `;

    const records = parseListPage(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.hdnId).toBe("64692");
    expect(records[0]!.heldOn).toBe("2026-01-29");
  });

  it("開催日がないリンクは heldOn が null になる", () => {
    const html = `
      <ul>
        <li>
          <a href="giji_dtl.php?hdnKatugi=130&hdnID=12345">
            令和６年第３回定例会
          </a>
        </li>
      </ul>
    `;

    const records = parseListPage(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.heldOn).toBeNull();
  });

  it("委員会会議は meetingType が committee になる", () => {
    const html = `
      <ul>
        <li>
          <a href="giji_dtl.php?hdnKatugi=130&hdnID=55000">
            令和７年総務委員会(開催日:2025/06/15)
          </a>
        </li>
      </ul>
    `;

    const records = parseListPage(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("committee");
  });

  it("会議録カテゴリ以外のリンクは無視される", () => {
    const html = `
      <ul>
        <li>
          <a href="giji_dtl.php?hdnKatugi=10&hdnID=99999">
            議案書
          </a>
        </li>
        <li>
          <a href="giji_dtl.php?hdnKatugi=130&hdnID=64692">
            令和８年第１回臨時会(開催日:2026/01/29)
          </a>
        </li>
      </ul>
    `;

    const records = parseListPage(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.hdnId).toBe("64692");
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const records = parseListPage("<div></div>");
    expect(records).toHaveLength(0);
  });
});

describe("parseYearTabs", () => {
  it("fncYearSet の呼び出しから年度タブを抽出する", () => {
    const html = `
      <ul>
        <li><a href="#" onClick="fncYearSet('令和', '8')">令和８年表示</a></li>
        <li><a href="#" onClick="fncYearSet('令和', '7')">令和７年表示</a></li>
        <li><a href="#" onClick="fncYearSet('令和', '6')">令和６年表示</a></li>
        <li><a href="#" onClick="fncYearSet('平成', '18')">平成１８年表示</a></li>
      </ul>
    `;

    const tabs = parseYearTabs(html);

    expect(tabs).toHaveLength(4);
    expect(tabs[0]!.hdngo).toBe("令和");
    expect(tabs[0]!.hdnYear).toBe("8");
    expect(tabs[0]!.westernYear).toBe(2026);
    expect(tabs[1]!.westernYear).toBe(2025);
    expect(tabs[2]!.westernYear).toBe(2024);
    expect(tabs[3]!.westernYear).toBe(2006);
  });

  it("年度タブがない場合は空配列を返す", () => {
    const tabs = parseYearTabs("<div></div>");
    expect(tabs).toHaveLength(0);
  });

  it("スペースが含まれる fncYearSet も解析できる", () => {
    const html = `<a href="#" onClick="fncYearSet( '令和' , '5' )">令和5年表示</a>`;

    const tabs = parseYearTabs(html);

    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.hdngo).toBe("令和");
    expect(tabs[0]!.hdnYear).toBe("5");
    expect(tabs[0]!.westernYear).toBe(2023);
  });

  it("平成年号を正しく西暦に変換する", () => {
    const html = `<a href="#" onClick="fncYearSet('平成', '31')">平成３１年(令和元年)表示</a>`;

    const tabs = parseYearTabs(html);

    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.westernYear).toBe(2019);
  });
});
