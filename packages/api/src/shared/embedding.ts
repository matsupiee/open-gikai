import { OpenAI } from "openai";
import { env } from "@open-gikai/env/server";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

function normalizeText(text: string): string {
  return text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * テキストを正規化（改行・連続スペースを整理）してから text-embedding-3-small モデルに送信
 * 結果として、1536次元のベクトルを返す
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const client = getOpenAIClient();
    const normalizedText = normalizeText(text);

    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: normalizedText,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error("No embedding returned from API");
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    const client = getOpenAIClient();
    const normalizedTexts = texts.map(normalizeText);

    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: normalizedTexts,
    });

    const embeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    return embeddings;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}
