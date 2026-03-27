# 프로젝트: CutFlow

대본만 넣으면 CapCut 프로젝트 파일로 완성하는 CLI 도구

## 기술 스택

- TypeScript + Node.js (ESM)
- Commander (CLI) + Clack (UI 예정)
- tsup (빌드), Vitest (테스트)
- xAI Grok (이미지), ElevenLabs (TTS)

## 주요 디렉토리

- `src/cli/` - CLI 진입점
- `src/parser/` - 대본 파서
- `src/generators/` - 이미지/TTS 생성기
- `src/timeline/` - 타임라인 빌더
- `src/exporters/` - CapCut JSON 출력
- `tests/` - Vitest 테스트

## 명령어

- 빌드: `npm run build`
- 테스트: `npm test`
- 실행: `node dist/index.js generate <대본.txt>`

## 환경변수

- `XAI_API_KEY` - xAI Grok 이미지 생성
- `ELEVENLABS_API_KEY` - ElevenLabs TTS
- `ELEVENLABS_VOICE_ID` - TTS 음성 ID

## 규칙

- 공통 규칙은 상위 `D:\GitHub\CLAUDE.md` 상속
- CapCut JSON: 시간 단위 = 마이크로초 (1초 = 1,000,000)
- CapCut 경로: `##_draftpath_placeholder_{UUID}_##/` 플레이스홀더
- 세그먼트당 7개 보조 Material 필수

## 상세 문서

- 아카이브: @docs/archive/2026-03/script-to-capcut/
