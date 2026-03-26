import { randomUUID } from "node:crypto";
import type {
  GeneratedAssets,
  Timeline,
  TimelineSegment,
} from "../types/index.js";
import { DEFAULT_CANVAS } from "../types/index.js";

// 에셋 → 타임라인 조립
export function buildTimeline(
  assets: GeneratedAssets,
  canvas = DEFAULT_CANVAS,
): Timeline {
  const videoTrack: TimelineSegment[] = [];
  const audioTrack: TimelineSegment[] = [];
  const textTrack: TimelineSegment[] = [];

  let currentStart = 0;

  for (const scene of assets.scenes) {
    const duration = scene.audioDuration;

    // 비디오 트랙: 이미지를 오디오 길이만큼 표시
    videoTrack.push({
      materialId: randomUUID(),
      start: currentStart,
      duration,
      filePath: scene.imagePath,
    });

    // 오디오 트랙: TTS 파일 배치
    audioTrack.push({
      materialId: randomUUID(),
      start: currentStart,
      duration,
      filePath: scene.audioPath,
    });

    // 텍스트 트랙: 자막 배치 (장면 내 상대 시간 → 전체 타임라인 절대 시간)
    for (const sub of scene.subtitles) {
      textTrack.push({
        materialId: randomUUID(),
        start: currentStart + sub.startTime,
        duration: sub.duration,
        text: sub.text,
      });
    }

    currentStart += duration;
  }

  return {
    totalDuration: currentStart,
    canvas,
    videoTrack,
    audioTrack,
    textTrack,
  };
}
