# Script-to-CapCut Design Document

> **Summary**: 대본 → CapCut 프로젝트 자동 생성 CLI 도구의 상세 설계
>
> **Project**: CutFlow
> **Version**: 0.1.0
> **Author**: Claude
> **Date**: 2026-03-26
> **Status**: Draft
> **Planning Doc**: [script-to-capcut.plan.md](../../01-plan/features/script-to-capcut.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 실제 CapCut 프로젝트 파일(draft_content.json) 구조를 정확히 재현
- 파이프라인 각 단계를 독립 모듈로 분리하여 교체/테스트 용이하게 설계
- 최소 의존성으로 npm 패키지 배포 가능한 CLI 도구

### 1.2 Design Principles

- 각 모듈은 입력/출력이 명확한 순수 함수 패턴
- API 호출은 추상화 레이어를 통해 교체 가능
- CapCut JSON 생성은 실제 프로젝트 파일 분석 기반 (docs/samples/1203.zip)

---

## 2. Architecture

### 2.1 파이프라인 흐름도

```
cutflow generate script.txt
    │
    ▼
┌──────────────────┐
│  1. Config Load   │  .cutflowrc / 환경변수 / CLI 옵션
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  2. Script Parse  │  .txt/.md → Scene[] 배열
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ 3a.    │ │ 3b.    │  병렬 실행 (Promise.all)
│ Image  │ │ TTS    │
│ Gen    │ │ Gen    │
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌──────────────────┐
│  4. Timeline     │  이미지 duration = TTS duration (장면별)
│     Build        │  자막 = TTS 반환 타임스탬프 기반
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  5. CapCut       │  draft_content.json + 미디어 파일
│     Export       │  프로젝트 폴더 구조 생성
└────────┬─────────┘
         │
         ▼
    CapCut 프로젝트 폴더에 출력
```

### 2.2 Dependencies

| Component       | Depends On               | Purpose               |
| --------------- | ------------------------ | --------------------- |
| CLI             | Config, ScriptParser     | 진입점                |
| ScriptParser    | -                        | 대본 파싱 (순수 함수) |
| ImageGenerator  | Config (API키)           | xAI Grok API 호출     |
| TTSGenerator    | Config (API키, VoiceID)  | ElevenLabs API 호출   |
| TimelineBuilder | Scene[], GeneratedAssets | 타임라인 조립         |
| CapCutExporter  | Timeline, Config         | JSON + 폴더 구조 생성 |

---

## 3. Data Model

### 3.1 Core Types

```typescript
// 장면 (대본 파싱 결과)
interface Scene {
  index: number; // 장면 번호 (0부터)
  narration: string; // 나레이션 텍스트
  imagePrompt: string; // 이미지 생성 프롬프트 (선택)
  direction?: string; // 연출 지시 (선택)
}

// 생성된 에셋 (이미지 + TTS)
interface GeneratedAssets {
  scenes: SceneAsset[];
  totalDuration: number; // 마이크로초
}

interface SceneAsset {
  sceneIndex: number;
  imagePath: string; // 로컬 저장 경로
  audioPath: string; // TTS 오디오 경로
  audioDuration: number; // 마이크로초
  subtitles: Subtitle[]; // 자막 타임스탬프
}

interface Subtitle {
  text: string;
  startTime: number; // 마이크로초 (장면 내 상대)
  duration: number; // 마이크로초
}

// 타임라인 (CapCut 변환 전 중간 표현)
interface Timeline {
  totalDuration: number; // 마이크로초
  canvas: { width: number; height: number };
  videoTrack: TimelineSegment[];
  audioTrack: TimelineSegment[];
  textTrack: TimelineSegment[];
}

interface TimelineSegment {
  materialId: string; // UUID
  start: number; // 마이크로초
  duration: number; // 마이크로초
  filePath?: string; // 미디어 파일 경로
  text?: string; // 텍스트 세그먼트용
}
```

### 3.2 설정 타입

```typescript
interface CutFlowConfig {
  // API 키 (환경변수 우선)
  xaiApiKey: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;

  // 출력 설정
  outputDir?: string; // 기본: CapCut 프로젝트 폴더 자동 감지
  projectName?: string; // 기본: 대본 파일명

  // 캔버스 설정
  canvas: {
    width: number; // 기본: 1920
    height: number; // 기본: 1080
    ratio: string; // 기본: "original"
  };

  // 이미지 생성 설정
  imageStyle?: string; // 기본: "realistic"
  imageSize?: string; // 기본: "1920x1080"

  // TTS 설정
  ttsModel?: string; // 기본: "eleven_multilingual_v2"
}
```

---

## 4. CapCut draft_content.json 스키마 (실제 파일 분석 기반)

> docs/samples/1203.zip 분석 결과

### 4.1 루트 구조

```typescript
interface DraftContent {
  id: string; // UUID (프로젝트 ID)
  version: number; // 360000
  new_version: string; // "157.0.0"
  name: string; // 프로젝트명
  duration: number; // 전체 길이 (마이크로초)
  fps: number; // 30.0
  create_time: number; // 0
  update_time: number; // 0
  canvas_config: CanvasConfig;
  config: DraftConfig;
  tracks: Track[];
  materials: Materials;
  keyframes: Keyframes;
  platform: Platform;
  last_modified_platform: Platform;
  // ... 기타 메타데이터
}
```

### 4.2 Track & Segment 구조

```typescript
interface Track {
  id: string; // UUID
  type: "video" | "audio" | "text";
  attribute: number; // 0
  flag: number; // 0
  segments: Segment[];
}

interface Segment {
  id: string; // UUID
  material_id: string; // materials 내 항목 참조
  extra_material_refs: string[]; // speeds, canvases 등 보조 material 참조
  source_timerange: TimeRange;
  target_timerange: TimeRange;
  render_timerange: TimeRange; // { start: 0, duration: 0 }
  speed: number; // 1.0
  volume: number; // 1.0
  clip: ClipTransform;
  visible: boolean;
  // ... 다수 enable_* 플래그
}

interface TimeRange {
  start: number; // 마이크로초
  duration: number; // 마이크로초
}

interface ClipTransform {
  scale: { x: number; y: number }; // 1.0, 1.0
  rotation: number; // 0.0
  transform: { x: number; y: number }; // 0.0, 0.0
  flip: { vertical: boolean; horizontal: boolean };
  alpha: number; // 1.0
}
```

### 4.3 Materials 구조

```typescript
interface Materials {
  videos: VideoMaterial[];
  audios: AudioMaterial[];
  images: ImageMaterial[];
  texts: TextMaterial[];
  canvases: CanvasMaterial[];
  speeds: SpeedMaterial[];
  material_animations: AnimationMaterial[];
  placeholder_infos: PlaceholderInfo[];
  sound_channel_mappings: SoundChannelMapping[];
  material_colors: MaterialColor[];
  vocal_separations: VocalSeparation[];
  // ... 다수 빈 배열 (effects, stickers, transitions 등)
}

interface VideoMaterial {
  id: string; // UUID (segment.material_id가 참조)
  type: "video";
  duration: number; // 마이크로초
  path: string; // "##_draftpath_placeholder_UUID_##/ai_material/파일명"
  width: number; // 1280
  height: number; // 720
  has_audio: boolean;
  category_id: string; // "agic_generate"
  category_name: string; // "agic_generate"
  material_name: string; // "AI 미디어"
  crop: CropConfig; // 기본값: 꼭짓점 0~1 좌표
  // ... 다수 기본값 필드
}
```

### 4.4 경로 플레이스홀더

```
##_draftpath_placeholder_{DRAFT_FOLDER_ID}_##/ai_material/파일명.mp4
```

- `DRAFT_FOLDER_ID`: 프로젝트 폴더 UUID (draft_content.json의 상위 폴더명)
- 실제 경로는 CapCut이 런타임에 치환

### 4.5 프로젝트 폴더 구조

```
{PROJECT_UUID}/                     ← CapCut projects 폴더 내
├── draft_content.json              ← 핵심 프로젝트 파일
├── draft_content.json.bak          ← 백업
├── draft_cover.jpg                 ← 커버 이미지
├── draft_meta_info.json            ← {} (빈 파일)
├── draft_biz_config.json           ← (빈 파일)
├── draft_agency_config.json        ← {"video_resolution":720,...}
├── ai_material/                    ← 미디어 파일
│   ├── {uuid}.jpeg                 ← 이미지
│   ├── {uuid}.mp4                  ← 비디오
│   └── ...
└── common_attachment/              ← 첨부 설정 파일들
```

### 4.6 Segment ↔ Material 관계도

```
Track (type: "video")
  └─ Segment
       ├─ material_id ──────────→ materials.videos[].id
       └─ extra_material_refs ──→ materials.speeds[].id
                                  materials.canvases[].id
                                  materials.material_animations[].id
                                  materials.placeholder_infos[].id
                                  materials.sound_channel_mappings[].id
                                  materials.material_colors[].id
                                  materials.vocal_separations[].id
```

---

## 5. Module Design

### 5.1 Script Parser (`src/parser/script-parser.ts`)

**입력**: 대본 텍스트 (string)
**출력**: Scene[]

```typescript
// 대본 형식 (지원)
// ---
// [이미지: 프롬프트]  ← 선택. 없으면 나레이션에서 자동 생성
// 나레이션 텍스트
// ---

function parseScript(text: string): Scene[];
```

**장면 구분자 우선순위**:

1. `---` (수평선)
2. `## ` (h2 헤더)
3. 빈 줄 2개 연속

**이미지 프롬프트 규칙**:

- `[이미지: ...]` 또는 `[image: ...]` 태그가 있으면 사용
- 없으면 나레이션 텍스트를 이미지 프롬프트로 활용

### 5.2 Image Generator (`src/generators/image-generator.ts`)

**입력**: Scene[], config
**출력**: { sceneIndex, imagePath }[]

```typescript
interface ImageGeneratorOptions {
  apiKey: string;
  style?: string; // "realistic" | "illustration" | "anime"
  size?: string; // "1024x1024" | "1920x1080"
  outputDir: string; // 이미지 저장 폴더
}

async function generateImages(
  scenes: Scene[],
  options: ImageGeneratorOptions,
): Promise<{ sceneIndex: number; imagePath: string }[]>;
```

**API**: xAI Grok Image Generation

- endpoint: `https://api.x.ai/v1/images/generations`
- 병렬 처리: `Promise.allSettled` (개별 실패 허용)

### 5.3 TTS Generator (`src/generators/tts-generator.ts`)

**입력**: Scene[], config
**출력**: { sceneIndex, audioPath, duration, subtitles }[]

```typescript
interface TTSGeneratorOptions {
  apiKey: string;
  voiceId: string;
  model?: string; // "eleven_multilingual_v2"
  outputDir: string;
}

async function generateTTS(
  scenes: Scene[],
  options: TTSGeneratorOptions,
): Promise<
  {
    sceneIndex: number;
    audioPath: string;
    audioDuration: number; // 마이크로초
    subtitles: Subtitle[];
  }[]
>;
```

**API**: ElevenLabs Text-to-Speech

- endpoint: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- `with_timestamps` 옵션으로 자막 타임스탬프 획득
- 순차 처리 (API rate limit 고려)

### 5.4 Timeline Builder (`src/timeline/timeline-builder.ts`)

**입력**: Scene[], 생성된 에셋들
**출력**: Timeline

```typescript
function buildTimeline(
  scenes: Scene[],
  assets: GeneratedAssets,
  config: { canvas: { width: number; height: number } },
): Timeline;
```

**타임라인 조립 로직**:

1. 각 장면별 duration = 해당 TTS 오디오 길이
2. 이미지 세그먼트: 오디오 길이만큼 표시
3. 오디오 세그먼트: TTS 파일 배치
4. 텍스트 세그먼트: 자막별 타임스탬프 기반 배치
5. 모든 start는 이전 장면 누적 합

### 5.5 CapCut Exporter (`src/exporters/capcut-exporter.ts`)

**입력**: Timeline, config
**출력**: 프로젝트 폴더 (파일 시스템에 직접 생성)

```typescript
async function exportCapCut(
  timeline: Timeline,
  config: {
    outputDir: string; // CapCut projects 폴더
    projectName: string;
  },
): Promise<{ projectPath: string }>;
```

**생성 과정**:

1. 프로젝트 UUID 생성
2. 폴더 구조 생성 (`{uuid}/ai_material/`)
3. 미디어 파일 복사/이동
4. 각 세그먼트용 보조 Material 생성 (speeds, canvases, animations 등)
5. draft_content.json 조립
6. 보조 파일 생성 (draft_agency_config.json 등)

**보조 Material 생성 규칙** (세그먼트당 필수):

| Material               | 용도         | 기본값                                |
| ---------------------- | ------------ | ------------------------------------- |
| speeds                 | 재생 속도    | `{ mode: 0, speed: 1.0 }`             |
| canvases               | 배경 캔버스  | `{ type: "canvas_color", color: "" }` |
| material_animations    | 애니메이션   | `{ animations: [] }`                  |
| placeholder_infos      | 플레이스홀더 | `{ meta_type: "none" }`               |
| sound_channel_mappings | 사운드 채널  | `{ audio_channel_mapping: 0 }`        |
| material_colors        | 색상         | `{ is_color_clip: false }`            |
| vocal_separations      | 보컬 분리    | `{ choice: 0 }`                       |

---

## 6. CLI Interface

### 6.1 명령어 구조

```bash
# 기본 사용
cutflow generate <script-file> [options]

# 옵션
  -o, --output <dir>       출력 폴더 (기본: CapCut 프로젝트 폴더)
  -n, --name <name>        프로젝트 이름 (기본: 파일명)
  -v, --voice <id>         ElevenLabs Voice ID
  -s, --style <style>      이미지 스타일 (realistic|illustration|anime)
  --canvas <WxH>           캔버스 크기 (기본: 1920x1080)
  --dry-run                미디어 생성 없이 JSON 구조만 출력
  --verbose                상세 로그

# 설정
cutflow init                설정 파일(.cutflowrc) 생성 (인터랙티브)
cutflow config <key> <val>  설정값 변경
```

### 6.2 CLI 출력 (Clack 기반)

```
◇ CutFlow - CapCut 프로젝트 생성기

◆ 대본 파싱 완료 (5개 장면)

◇ 에셋 생성 중...
  ├ 이미지 생성 [3/5] ████████░░ 60%
  └ TTS 생성   [4/5] █████████░ 80%

◆ 타임라인 조립 완료 (총 2분 34초)

◇ CapCut 프로젝트 생성 완료!
  경로: C:\Users\...\CapCut\...\{project-name}\
  → CapCut을 열어 프로젝트를 확인하세요
```

---

## 7. Error Handling

### 7.1 에러 코드

| Code | Message               | Cause                   | Handling               |
| ---- | --------------------- | ----------------------- | ---------------------- |
| E001 | API 키 미설정         | 환경변수/설정파일 없음  | `cutflow init` 안내    |
| E002 | 대본 파싱 실패        | 빈 파일 또는 장면 없음  | 대본 형식 안내         |
| E003 | 이미지 생성 실패      | xAI API 에러            | 3회 재시도 → 스킵 옵션 |
| E004 | TTS 생성 실패         | ElevenLabs API 에러     | 3회 재시도 → 중단      |
| E005 | CapCut 경로 감지 실패 | 미설치 또는 비표준 경로 | `--output` 옵션 안내   |
| E006 | 파일 쓰기 실패        | 권한 부족               | 관리자 권한 안내       |

### 7.2 에러 응답 패턴

```typescript
// Result 패턴 (예외 대신 반환값으로 에러 전달)
type Result<T> = { ok: true; data: T } | { ok: false; error: CutFlowError };

interface CutFlowError {
  code: string;
  message: string;
  cause?: Error;
}
```

---

## 8. Test Plan

### 8.1 Test Scope

| Type        | Target                                        | Tool      |
| ----------- | --------------------------------------------- | --------- |
| Unit        | ScriptParser, TimelineBuilder, CapCutExporter | Vitest    |
| Integration | 전체 파이프라인 (mock API)                    | Vitest    |
| E2E         | 생성된 JSON의 CapCut 호환성                   | 수동 검증 |

### 8.2 핵심 테스트 케이스

- [ ] 대본 파싱: 3가지 구분자(---, ##, 빈줄) 모두 정상 동작
- [ ] 대본 파싱: 이미지 프롬프트 태그 추출
- [ ] 타임라인: 장면별 duration이 TTS 길이와 일치
- [ ] 타임라인: 장면간 start 시간이 연속적으로 증가
- [ ] CapCut JSON: 실제 샘플(1203.zip)과 동일한 필수 필드 존재
- [ ] CapCut JSON: material_id 참조가 모두 유효
- [ ] CapCut JSON: extra_material_refs 7개 보조 Material 포함
- [ ] 에러: API 키 미설정 시 E001 에러
- [ ] 에러: 빈 대본 시 E002 에러

---

## 9. Implementation Order

### 9.1 구현 순서 (의존성 기반)

```
Phase 1: 기반 (API 호출 없이 동작하는 부분)
  1. [ ] 타입 정의 (src/types/index.ts)
  2. [ ] 설정 로더 (src/config/config.ts)
  3. [ ] 대본 파서 (src/parser/script-parser.ts)
  4. [ ] CapCut JSON 빌더 (src/exporters/capcut-exporter.ts)
       → 샘플 파일 기반으로 JSON 템플릿 구성
  5. [ ] 타임라인 빌더 (src/timeline/timeline-builder.ts)

Phase 2: API 연동
  6. [ ] 이미지 생성기 (src/generators/image-generator.ts)
  7. [ ] TTS 생성기 (src/generators/tts-generator.ts)

Phase 3: CLI + 통합
  8. [ ] CLI 진입점 (src/cli/index.ts)
  9. [ ] 파이프라인 오케스트레이터 (src/pipeline.ts)
  10. [ ] 테스트 + 실제 CapCut 검증
```

### 9.2 파일 생성 목록

| 순서 | 파일                                | 의존성        |
| ---- | ----------------------------------- | ------------- |
| 1    | `src/types/index.ts`                | 없음          |
| 2    | `src/config/config.ts`              | types         |
| 3    | `src/parser/script-parser.ts`       | types         |
| 4    | `src/exporters/capcut-exporter.ts`  | types         |
| 5    | `src/timeline/timeline-builder.ts`  | types         |
| 6    | `src/generators/image-generator.ts` | types, config |
| 7    | `src/generators/tts-generator.ts`   | types, config |
| 8    | `src/cli/index.ts`                  | 전체          |
| 9    | `src/pipeline.ts`                   | 전체          |
| 10   | `tests/*.test.ts`                   | 전체          |

---

## 10. Coding Conventions

### 10.1 Naming

| Target          | Rule             | Example                   |
| --------------- | ---------------- | ------------------------- |
| 파일            | kebab-case       | `script-parser.ts`        |
| 함수            | camelCase        | `parseScript()`           |
| 타입/인터페이스 | PascalCase       | `Scene`, `Timeline`       |
| 상수            | UPPER_SNAKE_CASE | `MICROSECONDS_PER_SECOND` |

### 10.2 주요 상수

```typescript
const MICROSECONDS_PER_SECOND = 1_000_000;
const DEFAULT_FPS = 30;
const DEFAULT_CANVAS = { width: 1920, height: 1080 };
const CAPCUT_VERSION = 360000;
const CAPCUT_NEW_VERSION = "157.0.0";
```

### 10.3 Import Order

```typescript
// 1. Node.js 내장
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 2. 외부 패키지
import { Command } from "commander";

// 3. 내부 모듈
import { parseScript } from "../parser/script-parser.js";

// 4. 타입
import type { Scene, Timeline } from "../types/index.js";
```

---

## Version History

| Version | Date       | Changes                                    | Author |
| ------- | ---------- | ------------------------------------------ | ------ |
| 0.1     | 2026-03-26 | Initial draft (실제 CapCut 파일 분석 기반) | Claude |
