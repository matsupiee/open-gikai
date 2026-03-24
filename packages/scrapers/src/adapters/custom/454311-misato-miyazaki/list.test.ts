import { describe, it, expect } from "vitest";
import { expandCouncils } from "./list";
import type { CouncilItem } from "./list";

describe("expandCouncils", () => {
  it("council → schedule → playlist を展開して schedule 単位のレコードを返す", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "84",
        year: "2025-02-21",
        label: "令和7年第1回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "2月21日　開会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "開会、会期の決定",
                movie_name1: "miyazaki/2025/2025022101.mp4",
                movie_released: "2",
              },
            ],
          },
          {
            schedule_id: "2",
            label: "3月2日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "田中議員",
                speaker_id: "5",
                content: "１　農業振興策について",
                movie_name1: "miyazaki/2025/2025030201.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("84");
    expect(records[0]!.councilLabel).toBe("令和7年第1回定例会");
    expect(records[0]!.councilYear).toBe("2025-02-21");
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[0]!.scheduleLabel).toBe("2月21日　開会");
    expect(records[0]!.playlist).toHaveLength(1);

    expect(records[1]!.scheduleId).toBe("2");
    expect(records[1]!.scheduleLabel).toBe("3月2日　一般質問");
  });

  it("playlist が空の schedule はスキップする", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "84",
        year: "2025-02-21",
        label: "令和7年第1回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "2月21日　開会",
            playlist: [],
          },
          {
            schedule_id: "2",
            label: "3月2日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "田中議員",
                speaker_id: "5",
                content: "農業振興策について",
                movie_name1: "miyazaki/2025/2025030201.mp4",
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

  it("councils が空の場合は空配列を返す", () => {
    expect(expandCouncils([])).toHaveLength(0);
  });

  it("複数の council を展開する", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "83",
        year: "2024-09-01",
        label: "令和6年第3回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "9月2日　開会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "開会",
                movie_name1: null,
                movie_released: "2",
              },
            ],
          },
        ],
      },
      {
        council_id: "84",
        year: "2024-12-01",
        label: "令和6年第4回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "12月2日　開会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "開会",
                movie_name1: null,
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("83");
    expect(records[1]!.councilId).toBe("84");
  });
});
