import { describe, expect, it } from "vitest";
import { expandCouncils } from "./list";
import type { CouncilItem } from "./list";

describe("expandCouncils", () => {
  it("council → schedule → playlist を展開して schedule 単位のレコードを返す", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "86",
        year: "2024-02-22",
        label: "令和6年香美市議会定例会3月定例会議",
        schedules: [
          {
            schedule_id: "2",
            label: "3月5日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "山﨑眞幹",
                speaker_id: "6",
                content: "１　「あんぱん」と予算案をめぐって\n２　市長提案説明をめぐって",
                movie_name1: "kami/2024/2024030501.mp4",
                movie_released: "2",
              },
              {
                playlist_id: "2",
                speaker: "田中一郎",
                speaker_id: "7",
                content: "農業振興策について",
                movie_name1: "kami/2024/2024030502.mp4",
                movie_released: "2",
              },
            ],
          },
          {
            schedule_id: "3",
            label: "3月6日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "佐藤花子",
                speaker_id: "8",
                content: "子育て支援の充実について",
                movie_name1: "kami/2024/2024030601.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("86");
    expect(records[0]!.councilLabel).toBe("令和6年香美市議会定例会3月定例会議");
    expect(records[0]!.councilYear).toBe("2024-02-22");
    expect(records[0]!.scheduleId).toBe("2");
    expect(records[0]!.scheduleLabel).toBe("3月5日　一般質問");
    expect(records[0]!.playlist).toHaveLength(2);
    expect(records[1]!.scheduleId).toBe("3");
    expect(records[1]!.playlist).toHaveLength(1);
  });

  it("playlist が空の schedule はスキップする", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "86",
        year: "2024-02-22",
        label: "令和6年香美市議会定例会3月定例会議",
        schedules: [
          {
            schedule_id: "1",
            label: "3月4日　開会",
            playlist: [],
          },
          {
            schedule_id: "2",
            label: "3月5日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "山﨑眞幹",
                speaker_id: "6",
                content: "市政について",
                movie_name1: "kami/2024/2024030501.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(1);
    expect(records[0]!.scheduleId).toBe("2");
  });

  it("councils が空配列なら空配列を返す", () => {
    expect(expandCouncils([])).toHaveLength(0);
  });

  it("複数 council を正しく展開する", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "85",
        year: "2024-01-19",
        label: "令和6年香美市議会定例会2月臨時会議",
        schedules: [
          {
            schedule_id: "1",
            label: "1月19日　臨時会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "議事進行",
                movie_name1: "kami/2024/2024011901.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
      {
        council_id: "86",
        year: "2024-02-22",
        label: "令和6年香美市議会定例会3月定例会議",
        schedules: [
          {
            schedule_id: "2",
            label: "3月5日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "山﨑眞幹",
                speaker_id: "6",
                content: "市政について",
                movie_name1: "kami/2024/2024030501.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("85");
    expect(records[1]!.councilId).toBe("86");
  });
});
