import { describe, expect, it } from "vitest";
import { parseCouncilResponse } from "./list";

describe("parseCouncilResponse", () => {
  it("council と schedule から正しくドキュメントを抽出する", () => {
    const documents = parseCouncilResponse([
      {
        council_id: "72",
        year: "2024-01-16",
        label: "令和６年１月臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月16日　開会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "　本会議　午前１０時開議\n１　開会\n２　議案上程",
              },
            ],
          },
        ],
      },
    ]);

    expect(documents).toHaveLength(1);
    expect(documents[0]!.councilId).toBe("72");
    expect(documents[0]!.councilLabel).toBe("令和6年1月臨時会");
    expect(documents[0]!.councilYear).toBe("2024-01-16");
    expect(documents[0]!.scheduleId).toBe("1");
    expect(documents[0]!.scheduleLabel).toBe("01月16日\u3000開会");
    expect(documents[0]!.playlist).toHaveLength(1);
  });

  it("複数の schedule を持つ council を正しく展開する", () => {
    const documents = parseCouncilResponse([
      {
        council_id: "73",
        year: "2024-03-25",
        label: "令和６年３月定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "02月28日　開会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "　本会議　午前１０時開議",
              },
            ],
          },
          {
            schedule_id: "2",
            label: "03月01日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "三澤隆一議員",
                speaker_id: "2",
                content: "１　フードドライブについて",
              },
              {
                playlist_id: "2",
                speaker: "日高久江議員",
                speaker_id: "40",
                content: "１　心のサポーターについて",
              },
            ],
          },
        ],
      },
    ]);

    expect(documents).toHaveLength(2);
    expect(documents[0]!.scheduleLabel).toBe("02月28日\u3000開会");
    expect(documents[0]!.playlist).toHaveLength(1);
    expect(documents[1]!.scheduleLabel).toBe("03月01日\u3000一般質問");
    expect(documents[1]!.playlist).toHaveLength(2);
  });

  it("playlist が空の schedule はスキップする", () => {
    const documents = parseCouncilResponse([
      {
        council_id: "72",
        year: "2024-01-16",
        label: "令和６年１月臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月16日　開会",
            playlist: [],
          },
        ],
      },
    ]);

    expect(documents).toHaveLength(0);
  });

  it("全角数字を半角に正規化する", () => {
    const documents = parseCouncilResponse([
      {
        council_id: "72",
        year: "2024-01-16",
        label: "令和６年１月臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "０１月１６日　開会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "開会",
              },
            ],
          },
        ],
      },
    ]);

    expect(documents[0]!.councilLabel).toBe("令和6年1月臨時会");
    expect(documents[0]!.scheduleLabel).toBe("01月16日\u3000開会");
  });

  it("空の council 配列は空配列を返す", () => {
    const documents = parseCouncilResponse([]);
    expect(documents).toHaveLength(0);
  });
});
