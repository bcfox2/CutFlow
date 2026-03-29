import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Scene, Result } from "../types/index.js";

interface ImageGenOptions {
  apiKey: string;
  style?: string;
  size?: string;
  outputDir: string;
}

interface ImageResult {
  sceneIndex: number;
  imagePath: string;
}

// xAI Grok 이미지 생성
export async function generateImages(
  scenes: Scene[],
  options: ImageGenOptions,
): Promise<Result<ImageResult[]>> {
  const results: ImageResult[] = [];

  // 병렬 처리 (개별 실패 허용)
  const promises = scenes.map(async (scene): Promise<ImageResult | null> => {
    const prompt = buildImagePrompt(scene, options.style);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch("https://api.x.ai/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-imagine-image",
            prompt,
            n: 1,
            response_format: "b64_json",
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`xAI API 오류 (${response.status}): ${errText}`);
        }

        const data = (await response.json()) as {
          data: Array<{ b64_json: string }>;
        };
        const imageData = data.data[0].b64_json;
        const fileName = `${randomUUID()}.png`;
        const filePath = join(options.outputDir, fileName);

        await writeFile(filePath, Buffer.from(imageData, "base64"));
        return { sceneIndex: scene.index, imagePath: filePath };
      } catch (err) {
        if (attempt === 2) {
          console.error(
            "장면 %d 이미지 생성 실패: %s",
            scene.index + 1,
            (err as Error).message,
          );
          return null;
        }
        // 재시도 대기
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    return null;
  });

  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      results.push(result.value);
    }
  }

  if (results.length === 0) {
    return {
      ok: false,
      error: { code: "E003", message: "모든 이미지 생성에 실패했습니다." },
    };
  }

  // 인덱스 순 정렬
  results.sort((a, b) => a.sceneIndex - b.sceneIndex);
  return { ok: true, data: results };
}

// 스타일에 따른 프롬프트 구성
function buildImagePrompt(scene: Scene, style?: string): string {
  const base = scene.imagePrompt;
  const stylePrefix: Record<string, string> = {
    realistic: "Photorealistic, high quality photograph,",
    illustration: "Digital illustration, vibrant colors, detailed artwork,",
    anime: "Anime style, Japanese animation aesthetic,",
    cinematic: "Cinematic shot, dramatic lighting, movie still,",
  };

  const prefix = stylePrefix[style || "realistic"] || "";
  return `${prefix} ${base}`.trim();
}
