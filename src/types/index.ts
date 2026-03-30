// ─── 상수 ───
export const MICROSECONDS_PER_SECOND = 1_000_000;
export const DEFAULT_FPS = 30;
export const DEFAULT_CANVAS = { width: 1920, height: 1080 };
export const CAPCUT_VERSION = 360000;
export const CAPCUT_NEW_VERSION = "157.0.0";

// ─── 대본 파싱 결과 ───
export interface Scene {
  index: number; // 장면 번호 (0부터)
  narration: string; // 나레이션 텍스트
  imagePrompt: string; // 이미지 생성 프롬프트
  direction?: string; // 연출 지시 (선택)
}

// ─── 생성된 에셋 ───
export interface GeneratedAssets {
  scenes: SceneAsset[];
  totalDuration: number; // 마이크로초
}

export interface SceneAsset {
  sceneIndex: number;
  imagePath: string; // 로컬 저장 경로
  audioPath: string; // TTS 오디오 경로
  audioDuration: number; // 마이크로초
  subtitles: Subtitle[];
}

export interface Subtitle {
  text: string;
  startTime: number; // 마이크로초 (장면 내 상대)
  duration: number; // 마이크로초
}

// ─── 타임라인 (중간 표현) ───
export interface Timeline {
  totalDuration: number; // 마이크로초
  canvas: { width: number; height: number };
  videoTrack: TimelineSegment[];
  audioTrack: TimelineSegment[];
  textTrack: TimelineSegment[];
}

export interface TimelineSegment {
  materialId: string; // UUID
  start: number; // 마이크로초 (전체 타임라인 기준)
  duration: number; // 마이크로초
  filePath?: string; // 미디어 파일 경로
  text?: string; // 텍스트 세그먼트용
}

// ─── 이미지 엔진 ───
export type ImageEngine = "grok" | "gemini" | "imagen";

// ─── 설정 ───
export interface CutFlowConfig {
  imageEngine: ImageEngine;
  xaiApiKey: string;
  googleApiKey: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  outputDir?: string;
  projectName?: string;
  canvas: {
    width: number;
    height: number;
    ratio: string;
  };
  imageStyle: string;
  imageSize: string;
  ttsModel: string;
}

// ─── 진행 상황 보고 ───
export type ProgressPhase = "parse" | "image" | "tts" | "timeline" | "export";

export interface ProgressEvent {
  phase: ProgressPhase;
  current: number;
  total: number;
  sceneIndex?: number;
  message: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ─── 파이프라인 결과 ───
export interface PipelineResult {
  projectPath: string;
  sceneCount: number;
  totalDuration: number;
}

// ─── 에러 처리 ───
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: CutFlowError };

export interface CutFlowError {
  code: string;
  message: string;
  cause?: Error;
}

// ─── CapCut JSON 타입 ───
export interface CapCutTimeRange {
  start: number;
  duration: number;
}

export interface CapCutClip {
  scale: { x: number; y: number };
  rotation: number;
  transform: { x: number; y: number };
  flip: { vertical: boolean; horizontal: boolean };
  alpha: number;
}
