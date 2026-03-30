import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CutFlowConfig,
  Result,
  GeneratedAssets,
  PipelineResult,
  ProgressCallback,
} from "./types/index.js";
import { parseScript } from "./parser/script-parser.js";
import { generateImages } from "./generators/image-generator.js";
import { generateTTS } from "./generators/tts-generator.js";
import { buildTimeline } from "./timeline/timeline-builder.js";
import { exportCapCut } from "./exporters/capcut-exporter.js";
import { getCapCutProjectsDir } from "./config/config.js";

// 전체 파이프라인 실행
export async function runPipeline(
  scriptPath: string,
  config: CutFlowConfig,
  onProgress?: ProgressCallback,
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
  onProgress?.({
    phase: "parse",
    current: 0,
    total: 1,
    message: "대본 파싱 중...",
  });
  const parseResult = parseScript(scriptText);
  if (!parseResult.ok) return parseResult;
  const scenes = parseResult.data;
  onProgress?.({
    phase: "parse",
    current: 1,
    total: 1,
    message: `${scenes.length}개 장면 파싱 완료`,
  });

  // 3. 임시 폴더 생성 (에셋 저장용)
  const tempDir = join(tmpdir(), `cutflow-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  // 4. 이미지 + TTS 병렬 생성
  onProgress?.({
    phase: "image",
    current: 0,
    total: scenes.length,
    message: "이미지 생성 시작...",
  });
  onProgress?.({
    phase: "tts",
    current: 0,
    total: scenes.length,
    message: "TTS 생성 시작...",
  });

  const [imageResult, ttsResult] = await Promise.all([
    generateImages(scenes, {
      engine: config.imageEngine,
      apiKey:
        config.imageEngine === "grok" ? config.xaiApiKey : config.googleApiKey,
      style: config.imageStyle,
      size: config.imageSize,
      outputDir: tempDir,
      onSceneComplete: (idx) => {
        onProgress?.({
          phase: "image",
          current: idx + 1,
          total: scenes.length,
          sceneIndex: idx,
          message: `이미지 생성 ${idx + 1}/${scenes.length}`,
        });
      },
    }),
    generateTTS(scenes, {
      apiKey: config.elevenLabsApiKey,
      voiceId: config.elevenLabsVoiceId,
      model: config.ttsModel,
      outputDir: tempDir,
      onSceneComplete: (idx) => {
        onProgress?.({
          phase: "tts",
          current: idx + 1,
          total: scenes.length,
          sceneIndex: idx,
          message: `TTS 생성 ${idx + 1}/${scenes.length}`,
        });
      },
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
  onProgress?.({
    phase: "timeline",
    current: 0,
    total: 1,
    message: "타임라인 빌드 중...",
  });
  const timeline = buildTimeline(assets, config.canvas);

  // 7. CapCut 프로젝트 내보내기
  if (!config.outputDir) {
    const detected = getCapCutProjectsDir();
    const hint = detected
      ? `감지된 경로(${detected})가 존재하지 않습니다. CapCut 설치를 확인하세요.`
      : "지원 OS: Windows, macOS. --output 옵션으로 수동 지정하세요.";
    return {
      ok: false,
      error: {
        code: "E005",
        message: `CapCut 프로젝트 폴더를 찾을 수 없습니다. ${hint}`,
      },
    };
  }

  onProgress?.({
    phase: "export",
    current: 0,
    total: 1,
    message: "CapCut 프로젝트 내보내기...",
  });
  const exportResult = await exportCapCut(timeline, {
    outputDir: config.outputDir,
    projectName: config.projectName || "CutFlow Project",
  });
  if (!exportResult.ok) return exportResult;

  onProgress?.({
    phase: "export",
    current: 1,
    total: 1,
    message: "프로젝트 생성 완료",
  });

  return {
    ok: true,
    data: {
      projectPath: exportResult.data.projectPath,
      sceneCount: scenes.length,
      totalDuration: timeline.totalDuration,
    },
  };
}
