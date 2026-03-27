# CutFlow

대본만 넣으면 CapCut 프로젝트 파일로 완성하는 CLI 도구

```
대본.txt → [이미지 생성 + TTS 생성] → CapCut 프로젝트 출력
```

## 설치

```bash
git clone https://github.com/bcfox2/CutFlow.git
cd CutFlow
npm install
npm run build
```

## 사용법

### 1. API 키 설정

```bash
export XAI_API_KEY="xai-..."
export ELEVENLABS_API_KEY="..."
export ELEVENLABS_VOICE_ID="..."
```

또는 프로젝트 루트에 `.cutflowrc` 파일 생성:

```json
{
  "xaiApiKey": "xai-...",
  "elevenLabsApiKey": "...",
  "elevenLabsVoiceId": "..."
}
```

### 2. 대본 작성

장면은 `---`로 구분합니다. `[이미지: ...]` 태그로 이미지 프롬프트를 지정할 수 있습니다.

```
[이미지: 아름다운 해변의 석양]
오늘은 바다로 여행을 떠나봅시다.
파도 소리가 들려옵니다.
---
[이미지: 깊은 숲속의 오솔길]
숲속 길을 따라 걸어봅니다.
새소리가 가득합니다.
---
여행의 끝, 집으로 돌아왔습니다.
```

> 이미지 태그가 없으면 나레이션 텍스트가 프롬프트로 사용됩니다.

### 3. 실행

```bash
node dist/index.js generate 대본.txt
```

### 옵션

```
-o, --output <dir>   출력 폴더 (기본: CapCut 프로젝트 폴더 자동 감지)
-n, --name <name>    프로젝트 이름
-v, --voice <id>     ElevenLabs Voice ID
-s, --style <style>  이미지 스타일 (realistic|illustration|anime|cinematic)
--canvas <WxH>       캔버스 크기 (기본: 1920x1080)
```

## 동작 원리

1. **대본 파싱** - `---`, `##`, 빈 줄 2개로 장면 분리
2. **이미지 생성** - xAI Grok API로 장면별 이미지 생성 (병렬)
3. **TTS 생성** - ElevenLabs API로 나레이션 음성 + 자막 타임스탬프
4. **타임라인 조립** - 이미지 + 오디오 + 자막을 시간순 배치
5. **CapCut 출력** - `draft_content.json` + 미디어 파일을 프로젝트 폴더에 생성

## CapCut 프로젝트 경로

| OS      | 경로                                                          |
| ------- | ------------------------------------------------------------- |
| Windows | `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft` |
| Mac     | `~/Movies/CapCut/User Data/Projects/com.lveditor.draft`       |

## 기술 스택

- TypeScript + Node.js (ESM)
- Commander (CLI)
- tsup (빌드), Vitest (테스트)
- xAI Grok (이미지), ElevenLabs (TTS)

## 개발

```bash
npm run build     # 빌드
npm test          # 테스트 실행
npm run dev       # 워치 모드 빌드
```

## 라이선스

MIT
