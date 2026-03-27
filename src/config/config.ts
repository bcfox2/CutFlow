import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import type { CutFlowConfig, Result } from "../types/index.js";
import { DEFAULT_CANVAS } from "../types/index.js";

const CONFIG_FILENAME = ".cutflowrc";

// 기본 설정값
const DEFAULTS: Omit<
  CutFlowConfig,
  "xaiApiKey" | "elevenLabsApiKey" | "elevenLabsVoiceId"
> = {
  canvas: { ...DEFAULT_CANVAS, ratio: "original" },
  imageStyle: "realistic",
  imageSize: "1920x1080",
  ttsModel: "eleven_multilingual_v2",
};

// CapCut 프로젝트 폴더 경로 (OS별)
export function getCapCutProjectsDir(): string | null {
  const os = platform();
  if (os === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    return join(
      localAppData,
      "CapCut",
      "User Data",
      "Projects",
      "com.lveditor.draft",
    );
  }
  if (os === "darwin") {
    return join(
      homedir(),
      "Movies",
      "CapCut",
      "User Data",
      "Projects",
      "com.lveditor.draft",
    );
  }
  return null;
}

// .cutflowrc 파일 로드
async function loadRcFile(): Promise<Partial<CutFlowConfig>> {
  const paths = [
    join(process.cwd(), CONFIG_FILENAME),
    join(homedir(), CONFIG_FILENAME),
  ];

  for (const p of paths) {
    try {
      const content = await readFile(p, "utf-8");
      return JSON.parse(content);
    } catch {
      // 파일 없으면 다음 경로 시도
    }
  }
  return {};
}

// 설정 로드 (환경변수 > .cutflowrc > 기본값)
export async function loadConfig(
  overrides?: Partial<CutFlowConfig>,
): Promise<Result<CutFlowConfig>> {
  const rc = await loadRcFile();

  const xaiApiKey =
    overrides?.xaiApiKey || process.env.XAI_API_KEY || rc.xaiApiKey || "";
  const elevenLabsApiKey =
    overrides?.elevenLabsApiKey ||
    process.env.ELEVENLABS_API_KEY ||
    rc.elevenLabsApiKey ||
    "";
  const elevenLabsVoiceId =
    overrides?.elevenLabsVoiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    rc.elevenLabsVoiceId ||
    "";

  if (!xaiApiKey) {
    return {
      ok: false,
      error: {
        code: "E001",
        message:
          "XAI_API_KEY가 설정되지 않았습니다. 환경변수 또는 .cutflowrc를 확인하세요.",
      },
    };
  }
  if (!elevenLabsApiKey) {
    return {
      ok: false,
      error: {
        code: "E001",
        message: "ELEVENLABS_API_KEY가 설정되지 않았습니다.",
      },
    };
  }
  if (!elevenLabsVoiceId) {
    return {
      ok: false,
      error: {
        code: "E001",
        message: "ELEVENLABS_VOICE_ID가 설정되지 않았습니다.",
      },
    };
  }

  const config: CutFlowConfig = {
    xaiApiKey,
    elevenLabsApiKey,
    elevenLabsVoiceId,
    outputDir:
      overrides?.outputDir ||
      rc.outputDir ||
      getCapCutProjectsDir() ||
      undefined,
    projectName: overrides?.projectName || rc.projectName,
    canvas: overrides?.canvas || rc.canvas || DEFAULTS.canvas,
    imageStyle: overrides?.imageStyle || rc.imageStyle || DEFAULTS.imageStyle,
    imageSize: overrides?.imageSize || rc.imageSize || DEFAULTS.imageSize,
    ttsModel: overrides?.ttsModel || rc.ttsModel || DEFAULTS.ttsModel,
  };

  return { ok: true, data: config };
}
