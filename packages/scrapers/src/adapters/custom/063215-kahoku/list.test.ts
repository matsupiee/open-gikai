import { describe, expect, it } from "vitest";
import { expandCouncils } from "./list";
import type { CouncilItem } from "./list";

describe("expandCouncils", () => {
  it("council → schedule → playlist を展開して schedule 単位のレコードを返す", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "98",
        year: "2024-03-15",
        label: "令和6年3月定例会",
        schedules: [
          {
            schedule_id: "2",
            label: "03月08日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "吉田芳美議員",
                speaker_id: "20",
                content: "１　新型コロナウイルス感染症について\n２　町道の整備事業について",
                movie_name1: "kahoku/2024/0308000201.mp4",
                movie_released: "2",
              },
              {
                playlist_id: "2",
                speaker: "佐藤一朗議員",
                speaker_id: "15",
                content: "１　農業振興策について",
                movie_name1: "kahoku/2024/0308000202.mp4",
                movie_released: "2",
              },
            ],
          },
          {
            schedule_id: "3",
            label: "03月11日　予算審査特別委員会",
            playlist: [
              {
                playlist_id: "1",
                speaker: "田中委員長",
                speaker_id: "5",
                content: "令和6年度一般会計予算審査",
                movie_name1: "kahoku/2024/0311000301.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("98");
    expect(records[0]!.councilLabel).toBe("令和6年3月定例会");
    expect(records[0]!.councilYear).toBe("2024-03-15");
    expect(records[0]!.scheduleId).toBe("2");
    expect(records[0]!.scheduleLabel).toBe("03月08日　一般質問");
    expect(records[0]!.playlist).toHaveLength(2);
    expect(records[1]!.scheduleId).toBe("3");
    expect(records[1]!.playlist).toHaveLength(1);
  });

  it("playlist が空の schedule はスキップする", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "97",
        year: "2024-01-10",
        label: "令和6年1月臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月10日　開会",
            playlist: [],
          },
          {
            schedule_id: "2",
            label: "01月10日　臨時会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "議事進行",
                movie_name1: "kahoku/2024/0110000201.mp4",
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
        council_id: "97",
        year: "2024-01-10",
        label: "令和6年1月臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月10日　臨時会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "議事進行",
                movie_name1: "kahoku/2024/0110000101.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
      {
        council_id: "98",
        year: "2024-03-15",
        label: "令和6年3月定例会",
        schedules: [
          {
            schedule_id: "2",
            label: "03月08日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "吉田芳美議員",
                speaker_id: "20",
                content: "新型コロナウイルス感染症について",
                movie_name1: "kahoku/2024/0308000201.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("97");
    expect(records[1]!.councilId).toBe("98");
  });
});
