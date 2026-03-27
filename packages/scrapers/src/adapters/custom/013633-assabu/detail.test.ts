import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeakerLine, parseStatements } from "./detail";

describe("parseSpeakerLine", () => {
  it("議長の発言行をパースする", () => {
    const result = parseSpeakerLine("議 長 皆 さ ん 、 お は よ う ご ざ い ま す 。");

    expect(result).toEqual({
      speakerName: null,
      speakerRole: "議長",
      content: "皆さん、おはようございます。",
    });
  });

  it("議員名付きの発言行をパースする", () => {
    const result = parseSpeakerLine(
      "浜 塚 議 員 そ れ で は 、 議 長 の お 許 し を 得 ま し た の で 一 般 質 問 さ せ て い た だ き ま す 。",
    );

    expect(result).toEqual({
      speakerName: "浜塚",
      speakerRole: "議員",
      content: "それでは、議長のお許しを得ましたので一般質問させていただきます。",
    });
  });

  it("部署付き課長を話者として扱う", () => {
    const result = parseSpeakerLine(
      "農 林 課 長 ま ず 、 ガ バ メ ン ト ハ ン タ ー の 導 入 で あ り ま す が 、",
    );

    expect(result).toEqual({
      speakerName: null,
      speakerRole: "農林課長",
      content: "まず、ガバメントハンターの導入でありますが、",
    });
  });

  it("議会運営副委員長を長い役職として優先する", () => {
    const result = parseSpeakerLine(
      "議 会 運 営 副 委 員 長 去 る １ ２ 月 ５ 日 午 前 １ ０ 時 、",
    );

    expect(result).toEqual({
      speakerName: null,
      speakerRole: "議会運営副委員長",
      content: "去る12月5日午前10時、",
    });
  });
});

describe("classifyKind", () => {
  it("議長は remark として分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長と課長は answer として分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
    expect(classifyKind("農林課長")).toBe("answer");
  });

  it("議員は question として分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("ページをまたぐ発言を含めて発言列を抽出する", () => {
    const pages = [
      [
        "－１－",
        "発 言 者 議 事",
        "〔 １ ２ 月 １ ０ 日 〕",
        "議 長 皆 さ ん 、 お は よ う ご ざ い ま す 。",
        "議 長 香 川 副 委 員 長",
        "議会運営副委員長 去 る １ ２ 月 ５ 日 午 前 １ ０ 時 、",
        "議 会 運 営 委 員 会 を 開 催 し ま し た 。",
      ].join("\n"),
      [
        "－２－",
        "議 長 町 長",
        "町 長 令 和 ６ 年 第 ４ 回 厚 沢 部 町 議 会 定 例 会 の 開 会 に 当 た り 、",
        "一 言 御 挨 拶 と 提 案 理 由 を 申 し 上 げ ま す 。",
        "議 長 ３ 番 、 浜 塚 議 員",
        "浜 塚 議 員 そ れ で は 、 議 長 の お 許 し を 得 ま し た の で 一 般 質 問 さ せ て い た だ き ま す 。",
        "ま ず 、 １ 件 目 で ご ざ い ま す 。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);

    expect(statements).toHaveLength(7);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("皆さん、おはようございます。");
    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[1]!.content).toBe("香川副委員長");
    expect(statements[2]!.speakerRole).toBe("議会運営副委員長");
    expect(statements[2]!.content).toBe(
      "去る12月5日午前10時、議会運営委員会を開催しました。",
    );
    expect(statements[3]!.speakerRole).toBe("議長");
    expect(statements[3]!.content).toBe("町長");
    expect(statements[4]!.speakerRole).toBe("町長");
    expect(statements[4]!.kind).toBe("answer");
    expect(statements[5]!.speakerRole).toBe("議長");
    expect(statements[5]!.content).toBe("3番、浜塚議員");
    expect(statements[6]!.speakerName).toBe("浜塚");
    expect(statements[6]!.speakerRole).toBe("議員");
    expect(statements[6]!.content).toBe(
      "それでは、議長のお許しを得ましたので一般質問させていただきます。まず、1件目でございます。",
    );
  });
});
