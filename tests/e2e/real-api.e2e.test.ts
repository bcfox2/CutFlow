import "dotenv/config";
import { describe, it, expect } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { runPipeline } from "../../src/pipeline.js";
import type { CutFlowConfig } from "../../src/types/index.js";

// 실제 API 키가 있을 때만 실행
const hasApiKeys =
  process.env.XAI_API_KEY &&
  process.env.ELEVENLABS_API_KEY &&
  process.env.ELEVENLABS_VOICE_ID;

describe.skipIf(!hasApiKeys)("E2E: 실제 API 호출", () => {
  const outputDir = join(tmpdir(), `cutflow-real-e2e-${randomUUID()}`);
  const fixtureDir = join(__dirname, "..", "fixtures");

  it("실제 xAI + ElevenLabs로 CapCut 프로젝트 생성", async () => {
    const scriptPath = join(fixtureDir, "sample-2scene.txt");
    const config: CutFlowConfig = {
      imageEngine: "grok",
      xaiApiKey: process.env.XAI_API_KEY!,
      googleApiKey: process.env.GOOGLE_API_KEY || "",
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY!,
      elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID!,
      outputDir,
      projectName: "Real E2E 테스트",
      canvas: { width: 1920, height: 1080, ratio: "16:9" },
      imageStyle: "cinematic",
      imageSize: "1024x1024",
      ttsModel: "eleven_multilingual_v2",
    };

    const result = await runPipeline(scriptPath, config);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.error("파이프라인 실패:", result.error);
      return;
    }

    // 기본 검증
    expect(result.data.sceneCount).toBe(2);
    expect(result.data.totalDuration).toBeGreaterThan(0);

    // draft_content.json 유효성
    const draftPath = join(result.data.projectPath, "draft_content.json");
    expect(existsSync(draftPath)).toBe(true);
    const draft = JSON.parse(await readFile(draftPath, "utf-8"));

    // 이미지/오디오 Material이 실제 데이터로 채워졌는지
    expect(draft.materials.videos.length).toBe(2);
    expect(draft.materials.audios.length).toBe(2);

    // 생성된 이미지 크기 확인 (1x1이 아닌 실제 이미지)
    const materialDir = join(result.data.projectPath, "ai_material");
    const { readdir, stat } = await import("node:fs/promises");
    const files = await readdir(materialDir);
    for (const file of files.filter((f) => f.endsWith(".png"))) {
      const s = await stat(join(materialDir, file));
      expect(s.size).toBeGreaterThan(1000); // 실제 이미지는 1KB 이상
    }

    console.log("프로젝트 경로:", result.data.projectPath);
    console.log("장면 수:", result.data.sceneCount);
    console.log("총 길이(μs):", result.data.totalDuration);

    // 정리
    await rm(outputDir, { recursive: true, force: true });
  }, 120000); // 2분 타임아웃 (API 호출 시간)
});
