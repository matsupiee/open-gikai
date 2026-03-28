import { SharedSystemAdapterKey } from "./scrapers";
import { extractGroupKey } from "./group-key";

/** 全ホストグループを通じた同時実行数の上限 */
const GLOBAL_HOST_GROUP_CONCURRENCY = 30;

export function getHostConcurrency(_groupKey: string): number {
  if (_groupKey === "kaigiroku.net") return 10;
  if (_groupKey === "dbsr.jp") return 5;
  return 3;
}

/**
 * タスクをサーバー単位でグループ化し、同一サーバーは HOST_CONCURRENCY 並列・サーバー間は並列で実行する。
 *
 * dbsr.jp (*.dbsr.jp)、discussnet-ssp (ssp.kaigiroku.net)、kensakusystem (*.kensakusystem.jp) のように
 * 複数自治体が同一サーバーを共有するシステムでは、並列数を抑えて IP 制限を回避する。
 */
export async function runGroupedByHost(
  targets: { baseUrl: string | null }[],
  tasks: (() => Promise<void>)[],
): Promise<void> {
  const hostGroups = new Map<string, { groupKey: string; tasks: (() => Promise<void>)[] }>();

  for (let i = 0; i < targets.length; i++) {
    const groupKey = extractGroupKey(new URL(targets[i]!.baseUrl!).hostname);
    if (!hostGroups.has(groupKey)) hostGroups.set(groupKey, { groupKey, tasks: [] });
    hostGroups.get(groupKey)!.tasks.push(tasks[i]!);
  }

  const hostTasks = [...hostGroups.values()].map(({ groupKey, tasks: groupTasks }) => async () => {
    const concurrency = getHostConcurrency(groupKey);
    const executing = new Set<Promise<void>>();
    for (const task of groupTasks) {
      const p: Promise<void> = task().finally(() => executing.delete(p));
      executing.add(p);
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  });

  // ホストグループ間も並列数を制限する。
  // カスタムアダプターは各自治体がそれぞれ独立したホストグループになるため、
  // 制限なしだと数百の同時 HTTP 接続が発生し、タイムアウトや接続エラーで
  // サイレントに 0 件になる自治体が多発する。
  const executing = new Set<Promise<void>>();
  for (const task of hostTasks) {
    const p: Promise<void> = task().finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= GLOBAL_HOST_GROUP_CONCURRENCY) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// --- fetchDetail の並列数（アダプター種別ごと） ---
export function getDetailConcurrency(adapterKey: string): number {
  if (adapterKey === SharedSystemAdapterKey.DISCUSSNET) return 2;
  if (adapterKey === SharedSystemAdapterKey.DBSEARCH) return 2;
  if (adapterKey === SharedSystemAdapterKey.KENSAKUSYSTEM) return 2;
  if (adapterKey === SharedSystemAdapterKey.GIJIROKUCOM) return 2;

  // カスタムアダプターはそのサイト単体なので負荷をかけても問題ない
  return 10;
}
