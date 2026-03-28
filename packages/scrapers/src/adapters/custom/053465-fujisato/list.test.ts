import { describe, expect, it } from "vitest";
import { parseArchivePage, parseRecentArticlePage, parseTopPage } from "./list";

describe("parseTopPage", () => {
  it("会議結果記事だけを抽出する", () => {
    const html = `
      <ul class="pages">
        <li><a href="/town/c613/teireirinji/3299">令和８年第１回定例会会議結果について</a></li>
        <li><a href="/town/c613/teireirinji/3282">令和８年第１回定例会の開催について</a></li>
        <li><a href="/town/c613/teireirinji/3258">令和８年第１回臨時会の開催について</a></li>
        <li><a href="/town/c613/teireirinji/3210">令和７年第４回定例会会議結果について</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.articleUrl).toBe(
      "https://www.town.fujisato.akita.jp/town/c613/teireirinji/3299",
    );
    expect(pages[0]!.year).toBe(2026);
    expect(pages[1]!.title).toBe("令和７年第４回定例会会議結果について");
  });
});

describe("parseRecentArticlePage", () => {
  it("個別記事から PDF URL と開催日を抽出する", () => {
    const html = `
      <article>
        <h1>令和７年第３回定例会会議結果について</h1>
        <!-- free_content -->
        令和７年第３回定例会が９月１０日(水)から9月１９日(金)までの１０日間の会期で開催されました。<br>
        <a href="/up/files/town/c613/teireirinji/R7第3回定例会会議結果.pdf">●令和７年第３回定例会会議結果</a>
        <!-- /free_content -->
      </article>
    `;

    const result = parseRecentArticlePage(
      html,
      "https://www.town.fujisato.akita.jp/town/c613/teireirinji/3121",
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和７年第３回定例会会議結果");
    expect(result!.pdfUrl).toBe(
      "https://www.town.fujisato.akita.jp/up/files/town/c613/teireirinji/R7第3回定例会会議結果.pdf",
    );
    expect(result!.heldOn).toBe("2025-09-10");
    expect(result!.meetingType).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    const html = `
      <h1>令和７年第２回臨時会会議結果について</h1>
      <!-- free_content -->
      令和７年第２回臨時会が８月１９日(火)に開催されました。
      <a href="/up/files/town/c613/teireirinji/R7第2回臨時会会議結果.pdf">PDF</a>
      <!-- /free_content -->
    `;

    const result = parseRecentArticlePage(
      html,
      "https://www.town.fujisato.akita.jp/town/c613/teireirinji/3102",
    );

    expect(result!.heldOn).toBe("2025-08-19");
    expect(result!.meetingType).toBe("extraordinary");
  });
});

describe("parseArchivePage", () => {
  it("旧まとめページから年度ごとの PDF を抽出する", () => {
    const html = `
      <!-- free_content -->
      ◆令和4年<br>
      　・<a href="/up/files/town/c613/teireirinji/R4-1rinjikekka.pdf"><u>第1回臨時会</u></a><br>
      　　　会期：2月8日(火)<br>
      　・<a href="/up/files/town/c613/teireirinji/R4-1teireikekka.pdf"><u>第1回定例会</u></a><br>
      　　　会期：3月9日(水)～3月18日(金)<br>
      ◆令和3年<br>
      　・<a href="/up/files/town/c613/teireirinji/R3-4teireikekka.pdf"><u>第4回定例会</u></a><br>
      　　　会期：12月14日(火)～12月17日(金)<br>
      <!-- /free_content -->
    `;

    const meetings = parseArchivePage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("令和4年第1回臨時会会議結果");
    expect(meetings[0]!.heldOn).toBe("2022-02-08");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[1]!.heldOn).toBe("2022-03-09");
    expect(meetings[2]!.heldOn).toBe("2021-12-14");
  });
});
