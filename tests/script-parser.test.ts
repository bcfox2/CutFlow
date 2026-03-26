import { describe, it, expect } from "vitest";
import { parseScript } from "../src/parser/script-parser.js";

describe("parseScript", () => {
  it("--- 구분자로 장면 분리", () => {
    const script = `첫 번째 장면 나레이션
---
두 번째 장면 나레이션
---
세 번째 장면 나레이션`;

    const result = parseScript(script);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);
    expect(result.data[0].narration).toBe("첫 번째 장면 나레이션");
    expect(result.data[2].narration).toBe("세 번째 장면 나레이션");
  });

  it("## 헤더 구분자로 장면 분리", () => {
    const script = `## 장면 1
첫 번째 나레이션

## 장면 2
두 번째 나레이션`;

    const result = parseScript(script);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].narration).toBe("첫 번째 나레이션");
  });

  it("빈 줄 2개로 장면 분리", () => {
    const script = `첫 번째 장면


두 번째 장면


세 번째 장면`;

    const result = parseScript(script);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);
  });

  it("[이미지: ...] 태그 추출", () => {
    const script = `[이미지: 아름다운 해변 풍경]
해변에서 석양이 지고 있습니다.
---
[image: cityscape at night]
도시의 야경이 펼쳐집니다.`;

    const result = parseScript(script);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].imagePrompt).toBe("아름다운 해변 풍경");
    expect(result.data[1].imagePrompt).toBe("cityscape at night");
  });

  it("이미지 태그 없으면 나레이션을 프롬프트로 사용", () => {
    const script = "해변에서 석양이 지고 있습니다.";

    const result = parseScript(script);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].imagePrompt).toBe("해변에서 석양이 지고 있습니다.");
  });

  it("빈 대본은 E002 에러", () => {
    const result = parseScript("");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("E002");
  });

  it("구분자만 있는 대본은 E002 에러", () => {
    const result = parseScript("---\n---\n---");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("E002");
  });
});
