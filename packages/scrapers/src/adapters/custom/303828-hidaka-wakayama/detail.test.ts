import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractMeetingInfo,
  extractQuestionerSurnames,
  parseStatements,
} from "./detail";

describe("classifyKind", () => {
  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("産業建設課長は answer", () => {
    expect(classifyKind("産業建設課長")).toBe("answer");
  });
});

describe("extractQuestionerSurnames", () => {
  it("pdftotext 出力の見出しから議員姓を抽出する", () => {
    const rawText = [
      "【一般質問】",
      "い が き",
      "井垣",
      "わたる",
      "弥",
      "5",
      "議員",
      "",
      "し み ず",
      "清水",
      "かずひと",
      "和人",
      "議員",
    ].join("\n");

    expect(extractQuestionerSurnames(rawText)).toEqual(["井垣", "清水"]);
  });
});

describe("extractMeetingInfo", () => {
  it("会期から会議タイトルと開催日を抽出する", () => {
    const text = `
      第184号 令和8年1月23日
      令和7年第4回定例会は12月10日から18日までの9日間の会期で開催した。
    `;

    const info = extractMeetingInfo(text, {
      title: "日高町議会だより 第184号",
      publishYear: 2026,
      publishMonth: 1,
    });

    expect(info.title).toBe("令和7年第4回定例会");
    expect(info.heldOn).toBe("2025-12-10");
  });

  it("会期が取れない場合は発行日を使う", () => {
    const text = "第181号 令和7年4月25日";

    const info = extractMeetingInfo(text, {
      title: "日高町議会だより 第181号",
      publishYear: 2025,
      publishMonth: 4,
    });

    expect(info.title).toBe("日高町議会だより 第181号");
    expect(info.heldOn).toBe("2025-04-25");
  });
});

describe("parseStatements", () => {
  it("一般質問本文から発言を抽出し、短い見出しは除外する", () => {
    const text = `
      【一般質問】 井垣 弥 議員 町長選挙への出馬の意思は
      町長 出馬をする
      井垣 松本町政の3期目も、残すところ5カ月足らずとなってきた。
      そこで、町長選への出馬の意思、決意をお伺いしたい。
      町長 3期目就任から、今日まで職員と共に誠実に精一杯、町政に取り組んできた。
      次期町長選に立候補することについては、前向きに考えているところである。
      4期目への出馬を表明した松本町長
    `;

    const statements = parseStatements(text, ["井垣"]);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("井垣");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.content).toContain("町長選への出馬の意思");

    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.content).not.toContain("4期目への出馬を表明");
  });

  it("複数の一般質問と欄外ノイズを処理する", () => {
    const text = `
      【一般質問】 山中 雅嗣 議員 日高町の地域振興は 町長 しっかり取り組んでいきたい
      山中 観光・交流資源の充実と活用は日高町の交流人口と関係人口を増やすためにも、重要であると考える。
      海と山に囲まれた日高町ならではの観光・交流資源の充実が、所得向上のためにも必要であると思うが、受け入れ体制の現状を町長はどう評価しているのか。
      町長 日帰り観光客は増えているが、宿泊者数では、若干減少している。
      当町で滞在時間を伸ばすこと、受入れ態勢を充実することで宿泊者数の増に繋げる必要があると分析している。
      山中 地域の魅力を効率よく発信し楽しんでもらうこと、観光客数を増やすことで、交流人口を増やし、さらに関係人口を増やすことが、生産事業者の所得向上に繋がり地域全体の活力になると感じる。
      地域振興は日高町の活力のもとである。日高町の発展のためにも、しっかりと取り組んでもらいたい。
      町長 海岸線のすばらしい景色や熊野古道。そういった所もPRしていき、日高町へ来てもらいたいと思っている。日高町に来て良かったと感じて貰えるように、しっかりと取り組んでいきたい。 地域振興とは 昨年のうぶゆいちば
      総務福祉常任委員会
    `;

    const statements = parseStatements(text, ["山中"]);

    expect(statements).toHaveLength(4);
    expect(statements[0]!.speakerName).toBe("山中");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[3]!.content).not.toContain("地域振興とは");
    expect(statements[3]!.content).not.toContain("昨年のうぶゆいちば");
  });
});
