import type { Scene, Result } from "../types/index.js";

// 이미지 프롬프트 태그 정규식: [이미지: ...] 또는 [image: ...]
const IMAGE_TAG_REGEX = /^\[(?:이미지|image)\s*:\s*(.+?)\]\s*$/im;

// 대본을 장면 배열로 파싱
export function parseScript(text: string): Result<Scene[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: { code: "E002", message: "대본이 비어있습니다." },
    };
  }

  // 장면 구분: --- (수평선) > ## (h2 헤더) > 빈 줄 2개
  const rawScenes = splitScenes(trimmed);

  const scenes: Scene[] = [];
  for (let i = 0; i < rawScenes.length; i++) {
    const block = rawScenes[i].trim();
    if (!block) continue;

    const { narration, imagePrompt, direction } = parseSceneBlock(block);
    if (!narration) continue;

    scenes.push({
      index: scenes.length,
      narration,
      imagePrompt: imagePrompt || narration,
      direction,
    });
  }

  if (scenes.length === 0) {
    return {
      ok: false,
      error: {
        code: "E002",
        message: "파싱 가능한 장면이 없습니다. 대본 형식을 확인하세요.",
      },
    };
  }

  return { ok: true, data: scenes };
}

// 장면 분리 (구분자 우선순위: --- > ## > 빈줄 2개)
function splitScenes(text: string): string[] {
  // 1. --- 구분자
  if (/^-{3,}\s*$/m.test(text)) {
    return text.split(/^-{3,}\s*$/m);
  }

  // 2. ## 헤더 구분자
  if (/^##\s+/m.test(text)) {
    // ## 헤더를 유지하면서 분리
    const parts = text.split(/^(?=##\s+)/m);
    return parts;
  }

  // 3. 빈 줄 2개 이상
  if (/\n\s*\n\s*\n/.test(text)) {
    return text.split(/\n\s*\n\s*\n/);
  }

  // 구분자 없으면 전체를 하나의 장면으로
  return [text];
}

// 장면 블록에서 나레이션, 이미지 프롬프트, 연출 추출
function parseSceneBlock(block: string): {
  narration: string;
  imagePrompt: string | null;
  direction: string | undefined;
} {
  const lines = block.split("\n");
  let imagePrompt: string | null = null;
  let direction: string | undefined;
  const narrationLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // ## 헤더는 무시 (장면 제목)
    if (trimmedLine.startsWith("## ")) continue;

    // [이미지: ...] 태그
    const imageMatch = trimmedLine.match(IMAGE_TAG_REGEX);
    if (imageMatch) {
      imagePrompt = imageMatch[1].trim();
      continue;
    }

    // [연출: ...] 태그
    const dirMatch = trimmedLine.match(
      /^\[(?:연출|direction)\s*:\s*(.+?)\]\s*$/i,
    );
    if (dirMatch) {
      direction = dirMatch[1].trim();
      continue;
    }

    // 빈 줄이 아닌 나머지 = 나레이션
    if (trimmedLine) {
      narrationLines.push(trimmedLine);
    }
  }

  return {
    narration: narrationLines.join(" "),
    imagePrompt,
    direction,
  };
}
