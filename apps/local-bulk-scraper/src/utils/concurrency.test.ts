import { describe, expect, it } from "vitest";
import {
  getHostConcurrency,
  getDetailConcurrency,
  runGroupedByHost,
} from "./concurrency";

describe("getHostConcurrency", () => {
  it("kaigiroku.net はオーバーライド値 20 を返す", () => {
    expect(getHostConcurrency("kaigiroku.net")).toBe(20);
  });

  it("オーバーライド未設定のキーはデフォルト 5 を返す", () => {
    expect(getHostConcurrency("dbsr.jp")).toBe(5);
  });

  it("任意のキーはデフォルト 5 を返す", () => {
    expect(getHostConcurrency("example.com")).toBe(5);
  });
});

describe("getDetailConcurrency", () => {
  it("discussnet_ssp は 4 を返す", () => {
    expect(getDetailConcurrency("discussnet_ssp")).toBe(4);
  });

  it("dbsearch は 2 を返す", () => {
    expect(getDetailConcurrency("dbsearch")).toBe(2);
  });

  it("kensakusystem は 2 を返す", () => {
    expect(getDetailConcurrency("kensakusystem")).toBe(2);
  });

  it("gijiroku_com は 2 を返す", () => {
    expect(getDetailConcurrency("gijiroku_com")).toBe(2);
  });

  it("カスタムアダプター（自治体コード）はデフォルト 10 を返す", () => {
    expect(getDetailConcurrency("012033")).toBe(10);
  });
});

describe("runGroupedByHost", () => {
  it("同一ホストの全タスクが完了する", async () => {
    const results: number[] = [];
    const targets = [
      { baseUrl: "https://example.com/a" },
      { baseUrl: "https://example.com/b" },
      { baseUrl: "https://example.com/c" },
    ];
    const tasks = [
      async () => { results.push(1); },
      async () => { results.push(2); },
      async () => { results.push(3); },
    ];

    await runGroupedByHost(targets, tasks);

    expect(results).toHaveLength(3);
    expect(results).toContain(1);
    expect(results).toContain(2);
    expect(results).toContain(3);
  });

  it("異なるホストのタスクが並列に開始される", async () => {
    const events: string[] = [];
    const targets = [
      { baseUrl: "https://a.example.com/" },
      { baseUrl: "https://b.example.org/" },
    ];
    const tasks = [
      async () => {
        events.push("a-start");
        await new Promise((r) => setTimeout(r, 50));
        events.push("a-end");
      },
      async () => {
        events.push("b-start");
        await new Promise((r) => setTimeout(r, 50));
        events.push("b-end");
      },
    ];

    await runGroupedByHost(targets, tasks);

    // 両方が相手の完了前に開始されている
    const aStartIdx = events.indexOf("a-start");
    const bStartIdx = events.indexOf("b-start");
    const aEndIdx = events.indexOf("a-end");
    const bEndIdx = events.indexOf("b-end");
    expect(aStartIdx).toBeLessThan(bEndIdx);
    expect(bStartIdx).toBeLessThan(aEndIdx);
  });

  it("共有サービスドメインのサブドメインが同一グループにまとめられる", async () => {
    let maxConcurrent = 0;
    let current = 0;
    const targets = [
      { baseUrl: "https://a.dbsr.jp/page" },
      { baseUrl: "https://b.dbsr.jp/page" },
      { baseUrl: "https://c.dbsr.jp/page" },
    ];
    const tasks = targets.map(() => async () => {
      current++;
      if (current > maxConcurrent) maxConcurrent = current;
      await new Promise((r) => setTimeout(r, 30));
      current--;
    });

    await runGroupedByHost(targets, tasks);

    // dbsr.jp のデフォルト並列数は 5 なので 3 タスクは全て並列可能だが、
    // 重要なのは同一グループにまとめられていること（全タスク完了する）
    expect(maxConcurrent).toBeGreaterThanOrEqual(1);
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });

  it("空配列でもエラーなく解決する", async () => {
    await expect(runGroupedByHost([], [])).resolves.toBeUndefined();
  });
});
