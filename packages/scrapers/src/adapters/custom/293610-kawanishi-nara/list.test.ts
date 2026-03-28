import { describe, expect, it } from "vitest";
import { parseTopPageLinks, parseYearPage } from "./list";

describe("parseTopPageLinks", () => {
  it("会議録トップページから年度ページリンクを抽出する", () => {
    const html = `
      <div class="kakuka_box">
        <h2>会議録</h2>
        <ul>
          <li><a href="../0000008099.html">令和６年（２０２４年）川西町議会会議録</a></li>
          <li><a href="../0000006874.html">平成31年/令和元年（2019年）川西町議会会議録</a></li>
          <li><a href="../0000005566.html">川西町議会会議録（平成30年～平成26年）</a></li>
        </ul>
      </div>
    `;

    const links = parseTopPageLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.url).toBe("https://www.town.nara-kawanishi.lg.jp/0000008099.html");
    expect(links[1]!.title).toBe("平成31年/令和元年（2019年）川西町議会会議録");
  });
});

describe("parseYearPage", () => {
  it("年度ページから session ごとの PDF を抽出する", () => {
    const html = `
      <div class="mol_attachfileblock block_index_4">
        <p class="mol_attachfileblock_title">令和６年第1回定例会（令和６年３月５日～令和６年３月１９日 開催)</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000008/8099/kaigiroku-202403.pdf"><img src="images/pdf.gif"> (第１回定例会会議録PDF形式、629.40KB)</a></li>
        </ul>
      </div>
      <div class="mol_attachfileblock block_index_8">
        <p class="mol_attachfileblock_title">令和６年第１回臨時会（令和６年５月１０日 開催)</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000008/8099/kaigiroku-rinji202405.pdf"><img src="images/pdf.gif"> (第１回臨時会会議録PDF形式、222.26KB)</a></li>
        </ul>
      </div>
    `;

    const sessions = parseYearPage(
      html,
      "https://www.town.nara-kawanishi.lg.jp/0000008099.html",
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.title).toContain("令和6年第1回定例会");
    expect(sessions[0]!.heldOn).toBe("2024-03-05");
    expect(sessions[0]!.meetingType).toBe("plenary");
    expect(sessions[0]!.pdfUrl).toBe(
      "https://www.town.nara-kawanishi.lg.jp/cmsfiles/contents/0000008/8099/kaigiroku-202403.pdf",
    );
    expect(sessions[1]!.meetingType).toBe("extraordinary");
    expect(sessions[1]!.heldOn).toBe("2024-05-10");
  });

  it("平成31年/令和元年ページの元年データを 2019 年として抽出する", () => {
    const html = `
      <div class="mol_attachfileblock block_index_5">
        <p class="mol_attachfileblock_title">令和元年第2回定例会（令和元年6月10日〜令和元年6月２１日 開催）</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000006/6874/teireino2.pdf"><img src="images/pdf.gif"> (ファイル名：令和元年第２回定例会会議録.pdf  サイズ：1.15MB)</a></li>
        </ul>
      </div>
    `;

    const sessions = parseYearPage(
      html,
      "https://www.town.nara-kawanishi.lg.jp/0000006874.html",
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.year).toBe(2019);
    expect(sessions[0]!.heldOn).toBe("2019-06-10");
  });

  it("範囲ページではファイル名から個別セッション名を使う", () => {
    const html = `
      <div class="mol_attachfileblock block_index_2">
        <p class="mol_attachfileblock_title">平成30年(2018年)【臨時会(第1回)】及び【定例会(第1回～第4回)】</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000005/5566/h30rinjino1.pdf"><img src="images/pdf.gif"> (ファイル名：平成30年第1回臨時会（平成30年5月9日）.pdf  サイズ：325.22KB)</a></li>
          <li><a href="./cmsfiles/contents/0000005/5566/h30teireino1.pdf"><img src="images/pdf.gif"> (ファイル名：平成30年第1回定例会（平成30年3月9日～平成30年3月23日）.pdf  サイズ：1.39MB)</a></li>
        </ul>
      </div>
    `;

    const sessions = parseYearPage(
      html,
      "https://www.town.nara-kawanishi.lg.jp/0000005566.html",
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.title).toBe("平成30年第1回臨時会（平成30年5月9日）");
    expect(sessions[0]!.meetingType).toBe("extraordinary");
    expect(sessions[0]!.heldOn).toBe("2018-05-09");
    expect(sessions[1]!.title).toBe("平成30年第1回定例会（平成30年3月9日～平成30年3月23日）");
    expect(sessions[1]!.year).toBe(2018);
  });
});
