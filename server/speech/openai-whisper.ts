import path from "path";

/**
 * Gemini 湲곕컲 ?뚯꽦 ?몄떇 ?쒕퉬??(湲곗〈 OpenAI Whisper ?泥?
 * Gemini 1.5 Flash / 2.0 Flash 紐⑤뜽???ㅻ뵒???댄빐 湲곕뒫???쒖슜?⑸땲??
 */
export class GeminiSpeechService {
  private apiKey: string;
  private language: string;

  constructor(apiKey: string, language: string = "ko") {
    if (!apiKey) {
      throw new Error("Gemini API ?ㅺ? ?꾩슂?⑸땲??");
    }
    this.apiKey = apiKey;
    this.language = language;
    console.log(`?렎 Gemini ?뚯꽦 ?몄떇 ?쒕퉬??珥덇린?붾맖 (?몄뼱: ${language})`);
  }

  /**
   * ?ㅻ뵒??踰꾪띁瑜??띿뒪?몃줈 蹂??(Gemini inline audio 諛⑹떇)
   */
  async transcribeBuffer(audioBuffer: Buffer, filename: string): Promise<string> {
    if (audioBuffer.length === 0) {
      throw new Error("?ㅻ뵒???곗씠?곌? 鍮꾩뼱?덉뒿?덈떎.");
    }

    const fileSizeInMB = audioBuffer.length / (1024 * 1024);
    if (fileSizeInMB > 20) {
      throw new Error(`?뚯씪 ?ш린媛 ?덈Т ?쎈땲?? ${fileSizeInMB.toFixed(2)}MB (理쒕? 20MB)`);
    }

    const mimeType = this.getMimeTypeFromFilename(filename);
    const base64Audio = audioBuffer.toString("base64");

    const langInstruction = this.language === "ko"
      ? "?ㅼ쓬 ?ㅻ뵒?ㅻ? ?쒓뎅?대줈 ?뺥솗?섍쾶 ?띿뒪?몃줈 蹂?섑빐二쇱꽭?? ?띿뒪?몃쭔 異쒕젰?섍퀬 ?ㅻⅨ ?ㅻ챸? ?섏? 留덉꽭??"
      : `Transcribe the following audio to text in ${this.language}. Output text only.`;

    console.log(`?? Gemini ?뚯꽦 ?몄떇 API ?몄텧 以?.. (${fileSizeInMB.toFixed(2)}MB, ${mimeType})`);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: langInstruction },
                {
                  inlineData: {
                    mimeType,
                    data: base64Audio
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini ?뚯꽦 ?몄떇 API ?ㅻ쪟 (${res.status}): ${errBody}`);
    }

    const json = await res.json() as any;
    const transcription: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!transcription) {
      throw new Error("?뚯꽦?먯꽌 ?띿뒪?몃? ?몄떇?섏? 紐삵뻽?듬땲??");
    }

    const clean = transcription.trim();
    console.log(`??Gemini ?뚯꽦 ?몄떇 ?꾨즺: "${clean.substring(0, 50)}${clean.length > 50 ? "..." : ""}"`);
    return clean;
  }

  private getMimeTypeFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const map: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
      ".webm": "audio/webm",
      ".flac": "audio/flac",
      ".aac": "audio/aac"
    };
    return map[ext] || "audio/webm";
  }

  isSupportedFormat(filename: string): boolean {
    const supported = [".mp3", ".wav", ".ogg", ".m4a", ".webm", ".flac", ".aac"];
    return supported.includes(path.extname(filename).toLowerCase());
  }
}

// ?섏쐞 ?명솚?깆쓣 ?꾪빐 湲곗〈 ?⑥닔紐??좎? (routes.ts?먯꽌 洹몃?濡??ъ슜 媛??
export function getOpenAIWhisperService(): null {
  return null;
}
