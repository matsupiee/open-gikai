import { OpenAI } from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

interface StatementContext {
  id: string;
  content: string;
  speakerName: string | null;
  meetingTitle: string;
  heldOn: string;
}

/**
 * 関連発言をコンテキストとしてLLMに渡し、質問への回答を生成する
 */
export async function generateAnswer(
  question: string,
  statements: StatementContext[]
): Promise<string> {
  const client = getOpenAIClient();

  const contextText = statements
    .map(
      (s, i) =>
        `発言${i + 1}（${s.speakerName ?? "不明"} / ${s.meetingTitle} / ${s.heldOn}）:\n${s.content}`
    )
    .join("\n\n");

  const systemPrompt = `あなたは日本の地方議会・国会の議事録を分析するアシスタントです。
提供された議会発言のコンテキストをもとに、ユーザーの質問に日本語で回答してください。

ルール:
- 必ずコンテキストに含まれる発言のみを根拠にして回答する
- 回答中で根拠となった発言を「発言①」「発言②」のように番号で引用する
- コンテキストに関連情報がない場合は「提供された発言には該当する情報が含まれていませんでした」と答える
- 簡潔かつ包括的に回答する（200〜400字程度）`;

  const userMessage = `以下の議会発言を参考に質問に答えてください。

【参考発言】
${contextText}

【質問】
${question}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const answer = response.choices[0]?.message?.content;
    if (!answer) {
      throw new Error("No answer returned from LLM");
    }

    return answer;
  } catch (error) {
    console.error("Error generating answer:", error);
    throw error;
  }
}
