/**
 * dbsearch スクレイパーの動作確認スクリプト
 * Usage: bun --env-file ../web/.env src/utils/test-dbsearch.ts
 */

import { fetchMeetingList } from "../system-types/dbsearch/list/scraper";
import { fetchMeetingDetail } from "../system-types/dbsearch/detail/scraper";

// 音更町（シンプルな dbsr.jp URL）
const BASE_URL =
  "http://www.town.otofuke.hokkaido.dbsr.jp/index.php/4880599?Template=search-detail";
const MUNICIPALITY_ID = "cezm3fpz2st0u233txdipfeu";
const YEAR = 2024;

async function main() {
  console.log("=== Step 1: 議事録一覧取得 ===");
  console.log(`baseUrl: ${BASE_URL}, year: ${YEAR}`);

  const records = await fetchMeetingList(BASE_URL, YEAR);
  if (!records || records.length === 0) {
    console.error("❌ 一覧取得失敗または0件");
    process.exit(1);
  }

  console.log(`✅ ${records.length} 件取得`);
  for (const r of records.slice(0, 3)) {
    console.log(`  id=${r.id}  title=${r.title}`);
    console.log(`  url=${r.url}`);
  }

  // 名簿ではなく本文を選ぶ
  const first = records.find((r) => !r.title.includes("名簿")) ?? records[0]!;
  console.log(`\n=== Step 2: 詳細取得 (id=${first.id}) ===`);
  console.log(`url: ${first.url}`);

  const meeting = await fetchMeetingDetail(
    first.url,
    MUNICIPALITY_ID,
    first.id,
    first.title
  );

  if (!meeting) {
    console.error("❌ 詳細取得失敗");
    process.exit(1);
  }

  console.log(`\n✅ MeetingData:`);
  console.log(`  title:       ${meeting.title}`);
  console.log(`  heldOn:      ${meeting.heldOn}`);
  console.log(`  meetingType: ${meeting.meetingType}`);
  console.log(`  externalId:  ${meeting.externalId}`);
  console.log(`  statements:  ${meeting.statements.length} 件`);

  if (meeting.statements.length === 0) {
    console.warn("⚠️  statements が 0 件です");
  }

  for (const [i, s] of meeting.statements.slice(0, 5).entries()) {
    console.log(`\n  [${i}] kind=${s.kind}`);
    console.log(`       speakerName=${s.speakerName}  speakerRole=${s.speakerRole}`);
    console.log(`       content(先頭80): ${s.content.slice(0, 80)}`);
    console.log(`       offset: ${s.startOffset}..${s.endOffset}`);
    console.log(`       hash: ${s.contentHash.slice(0, 16)}...`);
  }

  if (meeting.statements.length > 5) {
    console.log(`\n  ... (残り ${meeting.statements.length - 5} 件省略)`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
