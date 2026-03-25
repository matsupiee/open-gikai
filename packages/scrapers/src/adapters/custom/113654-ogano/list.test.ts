import { describe, it, expect } from "vitest";
import {
  parseListPage,
  buildMeeting,
} from "./list";
import {
  fileNameToYear,
  fileNameToMonth,
  fileNameToSessionType,
} from "./shared";

describe("fileNameToYear", () => {
  it("令和ファイル名から西暦年を返す", () => {
    expect(fileNameToYear("R0703T.html")).toBe(2025);
  });

  it("令和元年（R01）のファイル名から2019を返す", () => {
    expect(fileNameToYear("R0106T.html")).toBe(2019);
  });

  it("平成ファイル名から西暦年を返す", () => {
    expect(fileNameToYear("H2903T.html")).toBe(2017);
  });

  it("平成31年（H31）のファイル名から2019を返す", () => {
    expect(fileNameToYear("H3103T.html")).toBe(2019);
  });

  it("令和6年のファイル名から2024を返す", () => {
    expect(fileNameToYear("R0603T.html")).toBe(2024);
  });

  it("不正なファイル名は null を返す", () => {
    expect(fileNameToYear("index.html")).toBeNull();
  });
});

describe("fileNameToMonth", () => {
  it("R0703T.html から 3 を返す", () => {
    expect(fileNameToMonth("R0703T.html")).toBe(3);
  });

  it("R0611R.html から 11 を返す", () => {
    expect(fileNameToMonth("R0611R.html")).toBe(11);
  });

  it("H2906T.html から 6 を返す", () => {
    expect(fileNameToMonth("H2906T.html")).toBe(6);
  });

  it("不正なファイル名は null を返す", () => {
    expect(fileNameToMonth("index.html")).toBeNull();
  });
});

describe("fileNameToSessionType", () => {
  it("T は 定例会 を返す", () => {
    expect(fileNameToSessionType("R0703T.html")).toBe("定例会");
  });

  it("R は 臨時会 を返す", () => {
    expect(fileNameToSessionType("R0611R.html")).toBe("臨時会");
  });

  it("Z は 全員協議会 を返す", () => {
    expect(fileNameToSessionType("R0106Z.html")).toBe("全員協議会");
  });

  it("不正なファイル名は null を返す", () => {
    expect(fileNameToSessionType("index.html")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("会議録ファイル名を抽出する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="R0703T.html">第１回（３月）定例会</a></td>
          <td><a href="R0706T.html">第２回（６月）定例会</a></td>
          <td><a href="R0709T.html">第３回（９月）定例会</a></td>
        </tr>
      </table>
    `;

    const names = parseListPage(html);
    expect(names).toHaveLength(3);
    expect(names[0]).toBe("R0703T.html");
    expect(names[1]).toBe("R0706T.html");
    expect(names[2]).toBe("R0709T.html");
  });

  it("_index.html と main.html は除外する", () => {
    const html = `
      <a href="R0703T.html">第１回定例会</a>
      <a href="R0703T_index.html">目次</a>
      <a href="R0703Tmain.html">本文</a>
      <a href="index.html">一覧</a>
    `;

    const names = parseListPage(html);
    expect(names).toHaveLength(1);
    expect(names[0]).toBe("R0703T.html");
  });

  it("重複するファイル名は一度だけ返す", () => {
    const html = `
      <a href="R0703T.html">第１回定例会</a>
      <a href="R0703T.html">第１回定例会（再掲）</a>
    `;

    const names = parseListPage(html);
    expect(names).toHaveLength(1);
  });

  it("臨時会・全員協議会も抽出できる", () => {
    const html = `
      <a href="R0611R.html">第４回（11月）臨時会</a>
      <a href="R0106Z.html">全員協議会</a>
    `;

    const names = parseListPage(html);
    expect(names).toHaveLength(2);
    expect(names[0]).toBe("R0611R.html");
    expect(names[1]).toBe("R0106Z.html");
  });
});

describe("buildMeeting", () => {
  it("令和7年3月定例会のミーティングを構築する", () => {
    const meeting = buildMeeting("R0703T.html");

    expect(meeting).not.toBeNull();
    expect(meeting!.heldOn).toBe("2025-03-01");
    expect(meeting!.title).toBe("令和7年（3月）定例会");
    expect(meeting!.sessionType).toBe("plenary");
    expect(meeting!.fileName).toBe("R0703T.html");
    expect(meeting!.mainUrl).toBe(
      "https://www.town.ogano.lg.jp/menyu/gikai/sinkaigiroku/R0703Tmain.html",
    );
  });

  it("令和6年11月臨時会のミーティングを構築する", () => {
    const meeting = buildMeeting("R0611R.html");

    expect(meeting).not.toBeNull();
    expect(meeting!.heldOn).toBe("2024-11-01");
    expect(meeting!.title).toBe("令和6年（11月）臨時会");
    expect(meeting!.sessionType).toBe("extraordinary");
  });

  it("令和元年6月全員協議会のミーティングを構築する", () => {
    const meeting = buildMeeting("R0106Z.html");

    expect(meeting).not.toBeNull();
    expect(meeting!.heldOn).toBe("2019-06-01");
    expect(meeting!.title).toBe("令和元年（6月）全員協議会");
    expect(meeting!.sessionType).toBe("committee");
  });

  it("平成31年3月定例会のミーティングを構築する（平成最後の年）", () => {
    const meeting = buildMeeting("H3103T.html");

    expect(meeting).not.toBeNull();
    expect(meeting!.heldOn).toBe("2019-03-01");
    expect(meeting!.title).toBe("平成31年（3月）定例会");
    expect(meeting!.sessionType).toBe("plenary");
  });

  it("平成29年3月定例会のミーティングを構築する", () => {
    const meeting = buildMeeting("H2903T.html");

    expect(meeting).not.toBeNull();
    expect(meeting!.heldOn).toBe("2017-03-01");
    expect(meeting!.title).toBe("平成29年（3月）定例会");
  });

  it("不正なファイル名は null を返す", () => {
    expect(buildMeeting("index.html")).toBeNull();
  });
});
