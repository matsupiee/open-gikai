import { describe, it, expect } from "vitest";
import {
  parsePdfLinks,
  parseMeetingTitle,
  parseHeldOn,
  parseSpeaker,
  classifyKind,
  parseStatements,
} from "./detail";

describe("parseMeetingTitle", () => {
  it("h2 タグから会議名を取得する", () => {
    const html = `<h2>第490回9月定例会</h2>`;

    expect(parseMeetingTitle(html)).toBe("第490回9月定例会");
  });

  it("h2 タグ内の HTML タグを除去する", () => {
    const html = `<h2><span>第490回9月定例会</span></h2>`;

    expect(parseMeetingTitle(html)).toBe("第490回9月定例会");
  });

  it("h2 タグがない場合は null を返す", () => {
    const html = `<div>テキストのみ</div>`;

    expect(parseMeetingTitle(html)).toBeNull();
  });
});

describe("parseHeldOn", () => {
  it("パンくずから開催日を抽出する", () => {
    const html = `
      <div>本会議会議録&nbsp;令和７年 &raquo; 第490回9月定例会(開催日:2025/09/03) &raquo;</div>
    `;

    expect(parseHeldOn(html)).toBe("2025-09-03");
  });

  it("開催日フォーマット YYYY-MM-DD で返す", () => {
    const html = `第491回11月臨時会(開催日:2025/12/03)`;

    expect(parseHeldOn(html)).toBe("2025-12-03");
  });

  it("開催日がない場合は null を返す", () => {
    const html = `<div>テキストのみ</div>`;

    expect(parseHeldOn(html)).toBeNull();
  });
});

describe("parsePdfLinks", () => {
  it("本会議の PDF リンクを抽出する", () => {
    const html = `
      <a href="../data/fd_02nocgn5otdos5/downfile1972353348.pdf" class="class1" target="_blank">
        第491回11月臨時会・第492回11月臨時会・第
      </a>
    `;
    const baseUrl = "https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=3000&hdnID=489";

    const links = parsePdfLinks(html, baseUrl);

    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe(
      "https://www.city.susaki.lg.jp/data/fd_02nocgn5otdos5/downfile1972353348.pdf"
    );
    expect(links[0]!.label).toBe("第491回11月臨時会・第492回11月臨時会・第");
  });

  it("委員会の複数 PDF リンクを抽出する", () => {
    const html = `
      <a href="../data/fd_022267u3bjr0n1/downfile2020198437.pdf" class="class1" target="_blank">
        第486回12月定例会（総務文教委員会）
      </a>
      <a href="../data/fd_022267u3bjr0n1/downfile9857076691.pdf" class="class1" target="_blank">
        第486回12月定例会（産業厚生委員会）
      </a>
    `;
    const baseUrl = "https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=4000&hdnID=461";

    const links = parsePdfLinks(html, baseUrl);

    expect(links).toHaveLength(2);
    expect(links[0]!.url).toBe(
      "https://www.city.susaki.lg.jp/data/fd_022267u3bjr0n1/downfile2020198437.pdf"
    );
    expect(links[0]!.label).toBe("第486回12月定例会（総務文教委員会）");
    expect(links[1]!.label).toBe("第486回12月定例会（産業厚生委員会）");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <a href="../data/fd_xxx/downfile111.pdf">会議録 1</a>
      <a href="../data/fd_xxx/downfile111.pdf">会議録 1（再掲）</a>
    `;
    const baseUrl = "https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=3000&hdnID=489";

    const links = parsePdfLinks(html, baseUrl);

    expect(links).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません。</p></div>`;
    const baseUrl = "https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=3000&hdnID=489";

    const links = parsePdfLinks(html, baseUrl);

    expect(links).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクをそのまま返す", () => {
    const html = `
      <a href="https://www.city.susaki.lg.jp/data/fd_xxx/downfile111.pdf">会議録</a>
    `;
    const baseUrl = "https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=3000&hdnID=489";

    const links = parsePdfLinks(html, baseUrl);

    expect(links[0]!.url).toBe(
      "https://www.city.susaki.lg.jp/data/fd_xxx/downfile111.pdf"
    );
  });
});

describe("parseSpeaker", () => {
  it("○議長（氏名君）を解析する（須崎市標準形式）", () => {
    const result = parseSpeaker("○議長（土居信一君） ただいまから会議を開きます。");

    expect(result.speakerName).toBe("土居信一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toContain("ただいまから");
  });

  it("○番号議員（氏名君）を解析する", () => {
    const result = parseSpeaker("○2番（鈴木一郎君） 一般質問をさせていただきます。");

    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議員");
  });

  it("○市長（氏名君）を解析する", () => {
    const result = parseSpeaker("○市長（田中花子君） お答えいたします。");

    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("市長");
  });

  it("○副市長を解析する", () => {
    const result = parseSpeaker("○副市長（佐藤次郎君） ご説明します。");

    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副市長");
  });

  it("○教育長を解析する", () => {
    const result = parseSpeaker("○教育長（高橋三郎君） 答弁いたします。");

    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("教育長");
  });

  it("○総務課長（役職名 + 課長）を解析する", () => {
    const result = parseSpeaker("○総務課長（山田四郎君） ご説明いたします。");

    expect(result.speakerName).toBe("山田四郎");
    expect(result.speakerRole).toBe("課長");
  });

  it("○委員長を解析する", () => {
    const result = parseSpeaker("○委員長（木村五郎君） 会議を開きます。");

    expect(result.speakerName).toBe("木村五郎");
    expect(result.speakerRole).toBe("委員長");
  });

  it("○事務局長を解析する", () => {
    const result = parseSpeaker("○事務局長（久万敏幸君） おはようございます。");

    expect(result.speakerName).toBe("久万敏幸");
    expect(result.speakerRole).toBe("事務局長");
  });

  it("全角番号議員を解析する（○付き）", () => {
    const result = parseSpeaker("○1番（中村六郎君） 質問があります。");

    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("中村六郎");
  });

  it("1文字スペース区切り形式にも対応する（フォールバック）", () => {
    const result = parseSpeaker("議 長（ 山 田 太 郎 君 ） た だ い ま か ら 会 議 を 開 き ま す 。");

    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
  });

  it("発言者が解析できない行", () => {
    const result = parseSpeaker("令和7年12月定例会 会議録");

    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("総務課長（課長で終わる）は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○プレフィックス形式の発言を分割する（須崎市標準）", () => {
    const text = "○議長（山田太郎君） ただいまから会議を開きます。 ○5番（鈴木一郎君） 一般質問をさせていただきます。 ○市長（田中花子君） お答えいたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("複数の発言が含まれるテキストを分割する", () => {
    const text = [
      "○議長（土居信一君） ただいまから第490回須崎市議会9月定例会を開会いたします。",
      "○事務局長（久万敏幸君） おはようございます。",
      "○1番（山田次郎君） 質問します。",
    ].join(" ");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("事務局長");
    expect(statements[2]!.speakerRole).toBe("議員");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "○議長（山田太郎君） ただいまから会議を開きます。";

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("1文字スペース区切り形式にも対応する（フォールバック）", () => {
    const text = [
      "議 長（ 山 田 太 郎 君 ） た だ い ま か ら 会 議 を 開 き ま す 。",
      "出 席 者 を 確 認 し ま す 。",
      "５ 番（ 鈴 木 一 郎 君 ） 質 問 し ま す 。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
  });

  it("発言者のいないテキストのみの場合は空配列を返す", () => {
    const text = "令和7年12月定例会 会議録";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("offset が正しく計算される", () => {
    const text = "○議長（山田太郎君） ただいま。 ○1番（鈴木一郎君） 質問です。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });
});
