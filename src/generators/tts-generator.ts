import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Scene, Subtitle, Result } from "../types/index.js";
import { MICROSECONDS_PER_SECOND } from "../types/index.js";

interface TTSGenOptions {
  apiKey: string;
  voiceId: string;
  model?: string;
  outputDir: string;
}

interface TTSResult {
  sceneIndex: number;
  audioPath: string;
  audioDuration: number; // 마이크로초
  subtitles: Subtitle[];
}

// ElevenLabs TTS 생성 (순차 처리 - rate limit 고려)
export async function generateTTS(
  scenes: Scene[],
  options: TTSGenOptions,
): Promise<Result<TTSResult[]>> {
  const results: TTSResult[] = [];
  const model = options.model || "eleven_multilingual_v2";

  for (const scene of scenes) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // TTS with timestamps 요청
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}/with-timestamps`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": options.apiKey,
            },
            body: JSON.stringify({
              text: scene.narration,
              model_id: model,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `ElevenLabs API 오류 (${response.status}): ${errText}`,
          );
        }

        const data = (await response.json()) as {
          audio_base64: string;
          alignment: {
            characters: string[];
            character_start_times_seconds: number[];
            character_end_times_seconds: number[];
          };
        };

        // 오디오 파일 저장
        const fileName = `${randomUUID()}.mp3`;
        const filePath = join(options.outputDir, fileName);
        await writeFile(filePath, Buffer.from(data.audio_base64, "base64"));

        // 자막 생성 (문장 단위로 그룹핑)
        const subtitles = buildSubtitles(data.alignment);

        // 오디오 길이 계산 (마지막 문자의 끝 시간)
        const endTimes = data.alignment.character_end_times_seconds;
        const durationSec =
          endTimes.length > 0 ? endTimes[endTimes.length - 1] : 0;
        // 여유분 0.5초 추가
        const audioDuration = Math.ceil(
          (durationSec + 0.5) * MICROSECONDS_PER_SECOND,
        );

        results.push({
          sceneIndex: scene.index,
          audioPath: filePath,
          audioDuration,
          subtitles,
        });

        break; // 성공 시 재시도 중단
      } catch (err) {
        lastError = err as Error;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    if (!results.find((r) => r.sceneIndex === scene.index)) {
      console.error(
        "장면 %d TTS 생성 실패: %s",
        scene.index + 1,
        lastError?.message || "알 수 없는 오류",
      );
      return {
        ok: false,
        error: {
          code: "E004",
          message: `장면 ${scene.index + 1} TTS 생성 실패: ${lastError?.message}`,
          cause: lastError || undefined,
        },
      };
    }
  }

  return { ok: true, data: results };
}

// 문자 타임스탬프 → 자막 (단어/구절 단위로 그룹핑)
function buildSubtitles(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): Subtitle[] {
  const {
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  } = alignment;
  if (characters.length === 0) return [];

  const subtitles: Subtitle[] = [];
  let currentText = "";
  let segStart = character_start_times_seconds[0];
  let segEnd = character_end_times_seconds[0];

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    currentText += char;
    segEnd = character_end_times_seconds[i];

    // 문장 부호 또는 일정 길이에서 자막 분리
    const isPunctuation = /[.!?。！？,，;；]/.test(char);
    const isLongEnough = currentText.length >= 20;
    const isLast = i === characters.length - 1;

    if ((isPunctuation || isLongEnough || isLast) && currentText.trim()) {
      subtitles.push({
        text: currentText.trim(),
        startTime: Math.round(segStart * MICROSECONDS_PER_SECOND),
        duration: Math.round((segEnd - segStart) * MICROSECONDS_PER_SECOND),
      });
      currentText = "";
      if (i + 1 < characters.length) {
        segStart = character_start_times_seconds[i + 1];
      }
    }
  }

  return subtitles;
}
