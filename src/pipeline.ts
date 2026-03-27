import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { CutFlowConfig, Result, GeneratedAssets } from "./types/index.js";
import { parseScript } from "./parser/script-parser.js";
import { generateImages } from "./generators/image-generator.js";
import { generateTTS } from "./generators/tts-generator.js";
import { buildTimeline } from "./timeline/timeline-builder.js";
import { exportCapCut } from "./exporters/capcut-exporter.js";

interface PipelineResult {
  projectPath: string;
  sceneCount: number;
  totalDuration: number;
}

// 전체 파이프라인 실행
export async function runPipeline(
  scriptPath: string,
  config: CutFlowConfig,
): Promise<Result<PipelineResult>> {
  // 1. 대본 읽기
  let scriptText: string;
  try {
    scriptText = await readFile(scriptPath, "utf-8");
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "E002",
        message: `대본 파일을 읽을 수 없습니다: ${scriptPath}`,
        cause: err as Error,
      },
    };
  }

  // 2. 대본 파싱
  const parseResult = parseScript(scriptText);
  if (!parseResult.ok) return parseResult;
  const scenes = parseResult.data;

  // 3. 임시 폴더 생성 (에셋 저장용)
  const tempDir = join(tmpdir(), `cutflow-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  // 4. 이미지 + TTS 병렬 생성
  const [imageResult, ttsResult] = await Promise.all([
    generateImages(scenes, {
      apiKey: config.xaiApiKey,
      style: config.imageStyle,
      size: config.imageSize,
      outputDir: tempDir,
    }),
    generateTTS(scenes, {
      apiKey: config.elevenLabsApiKey,
      voiceId: config.elevenLabsVoiceId,
      model: config.ttsModel,
      outputDir: tempDir,
    }),
  ]);

  if (!imageResult.ok) return imageResult;
  if (!ttsResult.ok) return ttsResult;

  // 5. 에셋 조합
  const assets: GeneratedAssets = {
    scenes: scenes.map((scene) => {
      const img = imageResult.data.find((i) => i.sceneIndex === scene.index);
      const tts = ttsResult.data.find((t) => t.sceneIndex === scene.index);
      return {
        sceneIndex: scene.index,
        imagePath: img?.imagePath || "",
        audioPath: tts?.audioPath || "",
        audioDuration: tts?.audioDuration || 0,
        subtitles: tts?.subtitles || [],
      };
    }),
    totalDuration: ttsResult.data.reduce((sum, t) => sum + t.audioDuration, 0),
  };

  // 6. 타임라인 빌드
  const timeline = buildTimeline(assets, config.canvas);

  // 7. CapCut 프로젝트 내보내기
  if (!config.outputDir) {
    return {
      ok: false,
      error: {
        code: "E005",
        message:
          "CapCut 프로젝트 폴더를 찾을 수 없습니다. --output 옵션으로 지정하세요.",
      },
    };
  }

  const exportResult = await exportCapCut(timeline, {
    outputDir: config.outputDir,
    projectName: config.projectName || "CutFlow Project",
  });
  if (!exportResult.ok) return exportResult;

  return {
    ok: true,
    data: {
      projectPath: exportResult.data.projectPath,
      sceneCount: scenes.length,
      totalDuration: timeline.totalDuration,
    },
  };
}
