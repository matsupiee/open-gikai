import { describe, expect, it } from "vitest";
import { parseCouncilList } from "./list";
import type { CouncilItem } from "./shared";

describe("parseCouncilList", () => {
  it("会議・日程・プレイリストを展開して1レコードずつ返す", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "1",
        year: "2025-06-13",
        label: "令和7年6月鏡石町議会定例会（第8回）",
        schedules: [
          {
            schedule_id: "2",
            label: "06月12日　一般質問（1日目）",
            is_newest: false,
            playlist: [
              {
                playlist_id: "1",
                speaker_img: "komiyama_yasuko.jpg",
                speaker: "込山靖子議員",
                speaker_id: "8",
                content:
                  "１．子宮頸がんワクチンの危険性について\n２．太陽光パネルの自然環境への影響について",
                movie_name1: "kagamiishi/2025/0612000201.mp4",
                movie_released: "2",
              },
              {
                playlist_id: "2",
                speaker_img: "hata_kouichi.jpg",
                speaker: "畑幸一議員",
                speaker_id: "1",
                content: "１．農業振興について",
                movie_name1: "kagamiishi/2025/0612000202.mp4",
                movie_released: "2",
              },
            ],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(councils);

    expect(records).toHaveLength(2);

    expect(records[0]!.councilId).toBe("1");
    expect(records[0]!.councilLabel).toBe("令和7年6月鏡石町議会定例会（第8回）");
    expect(records[0]!.councilYear).toBe("2025-06-13");
    expect(records[0]!.scheduleId).toBe("2");
    expect(records[0]!.scheduleLabel).toBe("06月12日　一般質問（1日目）");
    expect(records[0]!.playlistId).toBe("1");
    expect(records[0]!.speaker).toBe("込山靖子議員");
    expect(records[0]!.speakerId).toBe("8");
    expect(records[0]!.content).toBe(
      "１．子宮頸がんワクチンの危険性について\n２．太陽光パネルの自然環境への影響について",
    );

    expect(records[1]!.playlistId).toBe("2");
    expect(records[1]!.speaker).toBe("畑幸一議員");
  });

  it("発言者が null の playlist エントリも含める", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "1",
        year: "2025-06-13",
        label: "令和7年6月鏡石町議会定例会（第8回）",
        schedules: [
          {
            schedule_id: "1",
            label: "06月11日　本会議",
            is_newest: false,
            playlist: [
              {
                playlist_id: "1",
                speaker_img: null,
                speaker: null,
                speaker_id: "0",
                content: "開会",
                movie_name1: null,
                movie_released: "2",
              },
            ],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(councils);

    expect(records).toHaveLength(1);
    expect(records[0]!.speaker).toBeNull();
    expect(records[0]!.speakerId).toBe("0");
  });

  it("スケジュールが複数ある場合すべて展開する", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "1",
        year: "2025-06-13",
        label: "令和7年6月鏡石町議会定例会（第8回）",
        schedules: [
          {
            schedule_id: "1",
            label: "06月11日　一般質問（1日目）",
            is_newest: false,
            playlist: [
              {
                playlist_id: "1",
                speaker_img: null,
                speaker: "議員A",
                speaker_id: "1",
                content: "質問A",
                movie_name1: null,
                movie_released: "2",
              },
            ],
            minute_text: [],
          },
          {
            schedule_id: "2",
            label: "06月12日　一般質問（2日目）",
            is_newest: false,
            playlist: [
              {
                playlist_id: "1",
                speaker_img: null,
                speaker: "議員B",
                speaker_id: "2",
                content: "質問B",
                movie_name1: null,
                movie_released: "2",
              },
              {
                playlist_id: "2",
                speaker_img: null,
                speaker: "議員C",
                speaker_id: "3",
                content: "質問C",
                movie_name1: null,
                movie_released: "2",
              },
            ],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(councils);

    expect(records).toHaveLength(3);
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[1]!.scheduleId).toBe("2");
    expect(records[2]!.scheduleId).toBe("2");
  });

  it("会議が空の場合は空配列を返す", () => {
    const records = parseCouncilList([]);
    expect(records).toHaveLength(0);
  });
});
