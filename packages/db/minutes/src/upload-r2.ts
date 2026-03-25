/**
 * dbjson/ の SQLite ファイルを Cloudflare R2 にアップロードするスクリプト
 *
 * manifest.json に記載されたファイルをすべて R2 にアップロードする。
 * アップロード先のキーは manifest に記載されたパスと一致する（R2 構造と一致）。
 *
 * 必要な環境変数（.env.local）:
 *   R2_ACCOUNT_ID       - Cloudflare アカウント ID
 *   R2_ACCESS_KEY_ID    - R2 API トークン（アクセスキー ID）
 *   R2_SECRET_ACCESS_KEY - R2 API トークン（シークレットアクセスキー）
 *   R2_BUCKET_NAME      - R2 バケット名
 *
 * 使い方:
 *   bun run upload:r2
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// --- Setup ---

const root = resolve(fileURLToPath(import.meta.url), "../../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const dbjsonDir = resolve(root, "packages/db/minutes/dbjson");

// --- Main ---

async function uploadFile(
  s3: S3Client,
  bucket: string,
  localPath: string,
  r2Key: string
): Promise<void> {
  const fileSize = statSync(localPath).size;
  const sizeMb = (fileSize / 1024 / 1024).toFixed(1);
  process.stdout.write(`  ${r2Key} (${sizeMb} MB)...`);

  const contentType = r2Key.endsWith(".json")
    ? "application/json"
    : "application/octet-stream";

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: createReadStream(localPath),
      ContentLength: fileSize,
      ContentType: contentType,
    })
  );

  console.log(" ✓");
}

async function main() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
  } = process.env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME
  ) {
    console.error("[upload-r2] R2 認証情報が環境変数に設定されていません");
    console.error(
      "  必要な変数: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
    process.exit(1);
  }

  const manifestPath = resolve(dbjsonDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`[upload-r2] manifest.json が見つかりません: ${manifestPath}`);
    console.error("  先に build:sqlite を実行してください。");
    process.exit(1);
  }

  const manifest: {
    index: { path: string; size: number };
    minutes: Record<string, Record<string, Array<{ path: string; size: number }>>>;
  } = JSON.parse(readFileSync(manifestPath, "utf-8"));

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  // アップロード対象ファイルを収集
  const uploads: { localPath: string; r2Key: string }[] = [
    {
      localPath: resolve(dbjsonDir, manifest.index.path),
      r2Key: manifest.index.path,
    },
  ];

  for (const regions of Object.values(manifest.minutes)) {
    for (const files of Object.values(regions)) {
      for (const file of files) {
        uploads.push({
          localPath: resolve(dbjsonDir, file.path),
          r2Key: file.path,
        });
      }
    }
  }

  // manifest.json 自体もアップロード
  uploads.push({ localPath: manifestPath, r2Key: "manifest.json" });

  console.log(
    `[upload-r2] ${uploads.length} ファイルを R2 バケット "${R2_BUCKET_NAME}" にアップロード中...`
  );

  for (const { localPath, r2Key } of uploads) {
    await uploadFile(s3, R2_BUCKET_NAME, localPath, r2Key);
  }

  console.log("[upload-r2] アップロード完了!");
}

main().catch((err) => {
  console.error("[upload-r2] Fatal error:", err);
  process.exit(1);
});
