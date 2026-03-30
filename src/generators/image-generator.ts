import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Scene, Result, ImageEngine } from "../types/index.js";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

interface ImageGenOptions {
  engine: ImageEngine;
  apiKey: string; // xAI 또는 Google API 키
  style?: string;
  size?: string;
  outputDir: string;
  onSceneComplete?: (sceneIndex: number) => void;
}

interface ImageResult {
  sceneIndex: number;
  imagePath: string;
}

// 지수 백오프 딜레이 계산
function backoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
}

// 이미지 저장 헬퍼
async function saveImage(base64: string, outputDir: string): Promise<string> {
  const fileName = `${randomUUID()}.png`;
  const filePath = join(outputDir, fileName);
  await writeFile(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

// ─── xAI Grok 이미지 생성 ───
async function generateWithGrok(
  prompt: string,
  apiKey: string,
  outputDir: string,
): Promise<string> {
  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
  return saveImage(data.data[0].b64_json, outputDir);
}

// ─── Google Gemini (나노바나나) 이미지 생성 ───
async function generateWithGemini(
  prompt: string,
  apiKey: string,
  outputDir: string,
): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("Gemini 응답에 이미지가 없습니다.");

  for (const part of parts) {
    if (part.inlineData?.data) {
      return saveImage(part.inlineData.data, outputDir);
    }
  }
  throw new Error("Gemini 응답에서 이미지 데이터를 찾을 수 없습니다.");
}

// ─── Google Imagen 4 이미지 생성 ───
async function generateWithImagen(
  prompt: string,
  apiKey: string,
  outputDir: string,
): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "16:9",
    },
  });

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) throw new Error("Imagen 응답에 이미지가 없습니다.");

  return saveImage(imageBytes, outputDir);
}

// ─── 메인: 멀티 엔진 이미지 생성 ───
export async function generateImages(
  scenes: Scene[],
  options: ImageGenOptions,
): Promise<Result<ImageResult[]>> {
  const results: ImageResult[] = [];
  const engineFn =
    options.engine === "gemini"
      ? generateWithGemini
      : options.engine === "imagen"
        ? generateWithImagen
        : generateWithGrok;

  // 병렬 처리 (개별 실패 허용)
  const promises = scenes.map(async (scene): Promise<ImageResult | null> => {
    const prompt = buildImagePrompt(scene, options.style);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const filePath = await engineFn(
          prompt,
          options.apiKey,
          options.outputDir,
        );
        options.onSceneComplete?.(scene.index);
        return { sceneIndex: scene.index, imagePath: filePath };
      } catch (err) {
        if (attempt === MAX_RETRIES - 1) return null;
        await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
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
