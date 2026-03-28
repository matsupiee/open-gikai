import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOn,
  parsePdfLinks,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parsePdfLinks", () => {
  it("会議ページから関連 PDF を抽出する", () => {
    const html = `
      <div class="section file_section">
        <h2>関連ファイル</h2>
        <ul class="file_list">
          <li class="pdf"><a href="./20250303_kaikaibi.pdf">定例会開会日（PDF：677KB）</a></li>
          <li class="pdf"><a href="../../../20230317_heikaibi.pdf">定例会閉会日（PDF：588KB）</a></li>
        </ul>
      </div>
    `;

    const result = parsePdfLinks(
      html,
      "https://www.town.chikuzen.fukuoka.jp/S027/010/020/010/20250501155322.html",
    );

    expect(result).toEqual([
      {
        label: "定例会開会日",
        pdfUrl:
          "https://www.town.chikuzen.fukuoka.jp/S027/010/020/010/20250303_kaikaibi.pdf",
      },
      {
        label: "定例会閉会日",
        pdfUrl:
          "https://www.town.chikuzen.fukuoka.jp/S027/20230317_heikaibi.pdf",
      },
    ]);
  });
});

describe("extractHeldOn", () => {
  it("冒頭にある最も早い和暦日付を返す", () => {
    const text = [
      "令和 ７ 年 第 １ 回 筑前町議会定例会会議録",
      "招集年月日 令和 ７年 ３月 ３日 (月)",
      "開 議 令和 ７年 ３月 ５日 (水) １０時 ００分",
    ].join("\n");

    expect(extractHeldOn(text)).toBe("2025-03-03");
  });
});

describe("parseSpeaker", () => {
  it("議長の行を抽出する", () => {
    const result = parseSpeaker("議 長 おはようございます。");

    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("議員名付きの行を抽出する", () => {
    const result = parseSpeaker(
      "石橋議員 質問に入る前に、一言申し上げさせていただきます。",
    );

    expect(result.speakerName).toBe("石橋");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe(
      "質問に入る前に、一言申し上げさせていただきます。",
    );
  });

  it("部局名付きの課長を抽出する", () => {
    const result = parseSpeaker("福 祉 課 長 お答えいたします。");

    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("福祉課長");
    expect(result.content).toBe("お答えいたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("福祉課長は answer に分類する", () => {
    expect(classifyKind("福祉課長")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("pdftotext 形式の行から発言を抽出する", () => {
    const text = [
      "令和 ７ 年 第 １ 回 筑前町議会定例会会議録",
      "開 議",
      "議 長 おはようございます。",
      "本日の出席議員は１３人につき、定足数に達しております。",
      "日程第１",
      "議 長 日程第１「一般質問」を行います。",
      "６番 石橋里美議員",
      "石橋議員 質問に入る前に、一言申し上げさせていただきます。",
      "議 長 福祉課長",
      "福 祉 課 長 お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      kind: "remark",
      speakerName: null,
      speakerRole: "議長",
      content: "おはようございます。\n本日の出席議員は13人につき、定足数に達しております。",
      contentHash: createHash("sha256")
        .update("おはようございます。\n本日の出席議員は13人につき、定足数に達しております。")
        .digest("hex"),
      startOffset: 0,
      endOffset:
        "おはようございます。\n本日の出席議員は13人につき、定足数に達しております。".length,
    });
    expect(result[1]!.speakerRole).toBe("議長");
    expect(result[1]!.content).toBe("日程第1「一般質問」を行います。\n6番 石橋里美議員");
    expect(result[2]!.speakerName).toBe("石橋");
    expect(result[2]!.kind).toBe("question");
    expect(result[3]!.speakerRole).toBe("議長");
    expect(result[3]!.content).toBe("福祉課長");
    expect(result[4]!.speakerRole).toBe("福祉課長");
    expect(result[4]!.kind).toBe("answer");
    expect(result[4]!.contentHash).toBe(
      createHash("sha256").update("お答えいたします。").digest("hex"),
    );
  });

  it("空文字なら空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
