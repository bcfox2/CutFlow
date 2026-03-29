import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { runPipeline } from "../../src/pipeline.js";
import type { CutFlowConfig } from "../../src/types/index.js";

// 가짜 1x1 PNG (base64)
const FAKE_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// 가짜 MP3 헤더 (base64, 최소 프레임)
const FAKE_MP3_B64 = "//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVV";

// xAI 이미지 API 목 응답
function mockImageResponse() {
  return new Response(JSON.stringify({ data: [{ b64_json: FAKE_PNG_B64 }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ElevenLabs TTS API 목 응답
function mockTTSResponse(text: string) {
  const chars = text.split("");
  const startTimes = chars.map((_, i) => i * 0.1);
  const endTimes = chars.map((_, i) => (i + 1) * 0.1);

  return new Response(
    JSON.stringify({
      audio_base64: FAKE_MP3_B64,
      alignment: {
        characters: chars,
        character_start_times_seconds: startTimes,
        character_end_times_seconds: endTimes,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("E2E: 전체 파이프라인 (Mock API)", () => {
  let outputDir: string;
  let fixtureDir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    outputDir = join(tmpdir(), `cutflow-e2e-${randomUUID()}`);
    fixtureDir = join(__dirname, "..", "fixtures");

    // fetch 모킹: xAI + ElevenLabs 분기
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("api.x.ai")) {
        return mockImageResponse();
      }
      if (url.includes("elevenlabs.io")) {
        // 요청 body에서 텍스트 추출
        const req = input as Request;
        let text = "테스트";
        try {
          const body = await (typeof req.json === "function"
            ? req.json()
            : JSON.parse(String(input)));
          text = body.text || text;
        } catch {
          /* fallback */
        }
        return mockTTSResponse(text);
      }

      return originalFetch(input as RequestInfo, undefined);
    }) as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    // 임시 출력 폴더 정리
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("2장면 대본 → CapCut 프로젝트 생성 성공", async () => {
    const scriptPath = join(fixtureDir, "sample-2scene.txt");
    const config: CutFlowConfig = {
      xaiApiKey: "test-xai-key",
      elevenLabsApiKey: "test-elevenlabs-key",
      elevenLabsVoiceId: "test-voice-id",
      outputDir,
      projectName: "E2E 테스트 프로젝트",
      canvas: { width: 1920, height: 1080, ratio: "16:9" },
      imageStyle: "realistic",
      imageSize: "1024x1024",
      ttsModel: "eleven_multilingual_v2",
    };

    const result = await runPipeline(scriptPath, config);

    // 파이프라인 성공 확인
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.sceneCount).toBe(2);
    expect(result.data.totalDuration).toBeGreaterThan(0);
    expect(result.data.projectPath).toBeTruthy();
  }, 30000);

  it("생성된 CapCut JSON 구조 검증", async () => {
    const scriptPath = join(fixtureDir, "sample-2scene.txt");
    const config: CutFlowConfig = {
      xaiApiKey: "test-xai-key",
      elevenLabsApiKey: "test-elevenlabs-key",
      elevenLabsVoiceId: "test-voice-id",
      outputDir,
      projectName: "구조 검증",
      canvas: { width: 1920, height: 1080, ratio: "16:9" },
      imageStyle: "cinematic",
      imageSize: "1024x1024",
      ttsModel: "eleven_multilingual_v2",
    };

    const result = await runPipeline(scriptPath, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // draft_content.json 읽기
    const draftPath = join(result.data.projectPath, "draft_content.json");
    const draftRaw = await readFile(draftPath, "utf-8");
    const draft = JSON.parse(draftRaw);

    // 기본 메타 필드
    expect(draft.id).toBeTruthy();
    expect(draft.version).toBe(360000);
    expect(draft.name).toBe("구조 검증");
    expect(draft.fps).toBe(30);
    expect(draft.duration).toBeGreaterThan(0);

    // 캔버스 설정
    expect(draft.canvas_config.width).toBe(1920);
    expect(draft.canvas_config.height).toBe(1080);

    // 트랙 구조
    expect(draft.tracks.length).toBeGreaterThanOrEqual(2); // video + audio 최소
    const videoTrack = draft.tracks.find(
      (t: { type: string }) => t.type === "video",
    );
    const audioTrack = draft.tracks.find(
      (t: { type: string }) => t.type === "audio",
    );
    const textTrack = draft.tracks.find(
      (t: { type: string }) => t.type === "text",
    );

    expect(videoTrack).toBeDefined();
    expect(videoTrack.segments).toHaveLength(2); // 2장면
    expect(audioTrack).toBeDefined();
    expect(audioTrack.segments).toHaveLength(2);
    expect(textTrack).toBeDefined();
    expect(textTrack.segments.length).toBeGreaterThan(0);

    // 세그먼트 시간 연속성 검증
    const vSegs = videoTrack.segments;
    expect(vSegs[0].target_timerange.start).toBe(0);
    expect(vSegs[1].target_timerange.start).toBe(
      vSegs[0].target_timerange.duration,
    );

    // Material 배열 검증
    expect(draft.materials.videos).toHaveLength(2);
    expect(draft.materials.audios).toHaveLength(2);
    expect(draft.materials.texts.length).toBeGreaterThan(0);

    // 보조 Material 7종 확인 (세그먼트당)
    const totalSegments =
      videoTrack.segments.length +
      audioTrack.segments.length +
      textTrack.segments.length;
    expect(draft.materials.speeds).toHaveLength(totalSegments);
    expect(draft.materials.canvases).toHaveLength(totalSegments);
    expect(draft.materials.material_animations).toHaveLength(totalSegments);

    // extra_material_refs 7개 확인
    for (const seg of videoTrack.segments) {
      expect(seg.extra_material_refs).toHaveLength(7);
    }
  }, 30000);

  it("프로젝트 폴더에 필수 파일 존재", async () => {
    const scriptPath = join(fixtureDir, "sample-2scene.txt");
    const config: CutFlowConfig = {
      xaiApiKey: "test-xai-key",
      elevenLabsApiKey: "test-elevenlabs-key",
      elevenLabsVoiceId: "test-voice-id",
      outputDir,
      projectName: "파일 검증",
      canvas: { width: 1920, height: 1080, ratio: "16:9" },
      imageStyle: "realistic",
      imageSize: "1024x1024",
      ttsModel: "eleven_multilingual_v2",
    };

    const result = await runPipeline(scriptPath, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const projectPath = result.data.projectPath;

    // 필수 파일 존재 확인
    expect(existsSync(join(projectPath, "draft_content.json"))).toBe(true);
    expect(existsSync(join(projectPath, "draft_meta_info.json"))).toBe(true);
    expect(existsSync(join(projectPath, "draft_agency_config.json"))).toBe(
      true,
    );

    // ai_material 폴더에 미디어 파일 존재
    const materialDir = join(projectPath, "ai_material");
    expect(existsSync(materialDir)).toBe(true);
    const files = await readdir(materialDir);
    const pngFiles = files.filter((f) => f.endsWith(".png"));
    const mp3Files = files.filter((f) => f.endsWith(".mp3"));
    expect(pngFiles.length).toBe(2); // 2장면 이미지
    expect(mp3Files.length).toBe(2); // 2장면 TTS
  }, 30000);

  it("CapCut 미디어 경로가 절대 경로로 설정", async () => {
    const scriptPath = join(fixtureDir, "sample-2scene.txt");
    const config: CutFlowConfig = {
      xaiApiKey: "test-xai-key",
      elevenLabsApiKey: "test-elevenlabs-key",
      elevenLabsVoiceId: "test-voice-id",
      outputDir,
      projectName: "경로 검증",
      canvas: { width: 1920, height: 1080, ratio: "16:9" },
      imageStyle: "realistic",
      imageSize: "1024x1024",
      ttsModel: "eleven_multilingual_v2",
    };

    const result = await runPipeline(scriptPath, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const draftPath = join(result.data.projectPath, "draft_content.json");
    const draft = JSON.parse(await readFile(draftPath, "utf-8"));

    // 미디어 경로가 절대 경로 (forward slash)
    const videoPath = draft.materials.videos[0]?.path;
    expect(videoPath).toContain("/ai_material/");
    expect(videoPath).not.toContain("##_draftpath_placeholder");

    // draft_meta_info.json에 draft_fold_path 존재
    const metaPath = join(result.data.projectPath, "draft_meta_info.json");
    const meta = JSON.parse(await readFile(metaPath, "utf-8"));
    expect(meta.draft_fold_path).toBeTruthy();
    expect(meta.draft_name).toBe("경로 검증");
  }, 30000);

  it("outputDir 없으면 E005 에러", async () => {
    const scriptPath = join(fixtureDir, "sample-2scene.txt");
    const config: CutFlowConfig = {
      xaiApiKey: "test-xai-key",
      elevenLabsApiKey: "test-elevenlabs-key",
      elevenLabsVoiceId: "test-voice-id",
      outputDir: undefined as unknown as string, // 의도적 누락
      projectName: "에러 테스트",
      canvas: { width: 1920, height: 1080, ratio: "16:9" },
      imageStyle: "realistic",
      imageSize: "1024x1024",
      ttsModel: "eleven_multilingual_v2",
    };

    const result = await runPipeline(scriptPath, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("E005");
  }, 30000);
});
