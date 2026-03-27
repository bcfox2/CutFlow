import { describe, it, expect } from "vitest";
import { buildTimeline } from "../src/timeline/timeline-builder.js";
import type { GeneratedAssets } from "../src/types/index.js";
import { MICROSECONDS_PER_SECOND } from "../src/types/index.js";

describe("buildTimeline", () => {
  const mockAssets: GeneratedAssets = {
    scenes: [
      {
        sceneIndex: 0,
        imagePath: "/tmp/img0.png",
        audioPath: "/tmp/audio0.mp3",
        audioDuration: 5 * MICROSECONDS_PER_SECOND,
        subtitles: [
          {
            text: "첫 번째 자막",
            startTime: 0,
            duration: 2 * MICROSECONDS_PER_SECOND,
          },
          {
            text: "두 번째 자막",
            startTime: 2 * MICROSECONDS_PER_SECOND,
            duration: 3 * MICROSECONDS_PER_SECOND,
          },
        ],
      },
      {
        sceneIndex: 1,
        imagePath: "/tmp/img1.png",
        audioPath: "/tmp/audio1.mp3",
        audioDuration: 3 * MICROSECONDS_PER_SECOND,
        subtitles: [
          {
            text: "세 번째 자막",
            startTime: 0,
            duration: 3 * MICROSECONDS_PER_SECOND,
          },
        ],
      },
    ],
    totalDuration: 8 * MICROSECONDS_PER_SECOND,
  };

  it("장면별 duration이 TTS 길이와 일치", () => {
    const timeline = buildTimeline(mockAssets);
    expect(timeline.videoTrack[0].duration).toBe(5 * MICROSECONDS_PER_SECOND);
    expect(timeline.videoTrack[1].duration).toBe(3 * MICROSECONDS_PER_SECOND);
  });

  it("장면간 start 시간이 연속적으로 증가", () => {
    const timeline = buildTimeline(mockAssets);
    expect(timeline.videoTrack[0].start).toBe(0);
    expect(timeline.videoTrack[1].start).toBe(5 * MICROSECONDS_PER_SECOND);
    expect(timeline.audioTrack[0].start).toBe(0);
    expect(timeline.audioTrack[1].start).toBe(5 * MICROSECONDS_PER_SECOND);
  });

  it("totalDuration이 모든 장면의 합", () => {
    const timeline = buildTimeline(mockAssets);
    expect(timeline.totalDuration).toBe(8 * MICROSECONDS_PER_SECOND);
  });

  it("자막 타임스탬프가 절대 시간으로 변환", () => {
    const timeline = buildTimeline(mockAssets);
    // 장면 0: 자막은 0, 2초
    expect(timeline.textTrack[0].start).toBe(0);
    expect(timeline.textTrack[1].start).toBe(2 * MICROSECONDS_PER_SECOND);
    // 장면 1: 자막은 5초 + 0 = 5초
    expect(timeline.textTrack[2].start).toBe(5 * MICROSECONDS_PER_SECOND);
  });

  it("트랙 수가 올바름", () => {
    const timeline = buildTimeline(mockAssets);
    expect(timeline.videoTrack).toHaveLength(2);
    expect(timeline.audioTrack).toHaveLength(2);
    expect(timeline.textTrack).toHaveLength(3);
  });

  it("기본 캔버스 크기 적용", () => {
    const timeline = buildTimeline(mockAssets);
    expect(timeline.canvas.width).toBe(1920);
    expect(timeline.canvas.height).toBe(1080);
  });
});
