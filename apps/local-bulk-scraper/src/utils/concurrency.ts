import { SharedSystemAdapterKey } from "@open-gikai/scrapers";
import { extractGroupKey } from "./group-key";

// 同一ホスト内のデフォルト並列数。
// dbsr.jp 等の共有サービスでは、高すぎるとレート制限で 0 件応答が返るため控えめに設定。
export const DEFAULT_HOST_CONCURRENCY = 5;

/**
 * グループキー単位の並列数オーバーライド。
 * サイトの耐性に応じて個別に設定する。キーは extractGroupKey() の戻り値に対応。
 */
export const HOST_CONCURRENCY_OVERRIDES: Record<string, number> = {
  "kaigiroku.net": 20, // discussnet-ssp: 十分な耐性あり
};

export function getHostConcurrency(groupKey: string): number {
  return HOST_CONCURRENCY_OVERRIDES[groupKey] ?? DEFAULT_HOST_CONCURRENCY;
}

// --- fetchDetail の並列数（アダプター種別ごと） ---

export const DEFAULT_DETAIL_CONCURRENCY = 10;

const DETAIL_CONCURRENCY_OVERRIDES: Record<string, number> = {
  [SharedSystemAdapterKey.DISCUSSNET]: 4,
  [SharedSystemAdapterKey.DBSEARCH]: 2,
  [SharedSystemAdapterKey.KENSAKUSYSTEM]: 2,
  [SharedSystemAdapterKey.GIJIROKUCOM]: 2,
};

export function getDetailConcurrency(adapterKey: string): number {
  return DETAIL_CONCURRENCY_OVERRIDES[adapterKey] ?? DEFAULT_DETAIL_CONCURRENCY;
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

  return Promise.all(hostTasks.map((t) => t())).then(() => undefined);
}
