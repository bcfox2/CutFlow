# Script-to-CapCut 자동 생성 Planning Document

> **Summary**: 대본 텍스트를 입력하면 이미지 생성, TTS, 자막을 포함한 CapCut 프로젝트 파일을 자동 생성하는 도구
>
> **Project**: CutFlow
> **Version**: 0.1.0
> **Author**: Claude
> **Date**: 2026-03-26
> **Status**: Draft

---

## Executive Summary

| Perspective            | Content                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Problem**            | 유튜브/숏폼 영상 제작 시 대본 → 이미지 생성 → TTS → 자막 → 편집 과정이 수작업으로 반복되어 시간 소모가 큼         |
| **Solution**           | 대본만 입력하면 AI로 이미지/TTS/자막을 자동 생성하고 CapCut 프로젝트 파일(draft_content.json)로 조립하는 CLI 도구 |
| **Function/UX Effect** | `cutflow generate script.txt` 한 줄로 CapCut에서 바로 열 수 있는 완성 프로젝트 생성. 편집 시간 90% 단축           |
| **Core Value**         | 콘텐츠 크리에이터가 "대본 작성"에만 집중하고, 반복적인 영상 조립 작업을 완전 자동화                               |

---

## 1. Overview

### 1.1 Purpose

유튜브/숏폼 영상 제작의 반복 작업(이미지 생성, 음성 합성, 자막 배치, 타임라인 조립)을 자동화하여 대본만으로 CapCut 편집 프로젝트를 완성한다.

### 1.2 Background

- [AI 유튜브 자동화 가이드](https://gitteraifactory.github.io/ai-youtube-automation-guide/?v=2)에서 영감을 받은 프로젝트
- 기존 방식: Claude Code 내에서 스킬 파일로 실행 → CutFlow는 독립 도구로 발전
- 핵심 워크플로우: `대본 → 장면 분리 → 이미지 생성 → TTS → 자막 → CapCut JSON 조립`

### 1.3 Related Documents

- 참고: [AI YouTube Automation Guide](https://gitteraifactory.github.io/ai-youtube-automation-guide/?v=2)
- 참고: [capcut-srt-export](https://github.com/vogelcodes/capcut-srt-export) - CapCut JSON 파싱 참고
- 참고: [capcut-export](https://github.com/emosheeep/capcut-export) - CapCut 트랙 구조 참고

---

## 2. Scope

### 2.1 In Scope

- [x] 대본 텍스트 파싱 (장면/나레이션 구분)
- [ ] AI 이미지 생성 (xAI Grok API)
- [ ] TTS 음성 합성 (ElevenLabs API)
- [ ] 자막(SRT) 자동 생성
- [ ] CapCut 프로젝트 JSON 생성 (draft_content.json)
- [ ] CLI 인터페이스 (`cutflow generate`)
- [ ] 프로젝트 설정 파일 (API 키, 음성 설정 등)

### 2.2 Out of Scope

- CapCut 데스크톱 앱 자체의 수정/플러그인
- 영상 렌더링 (CapCut에서 수행)
- 웹 UI (1차 버전은 CLI만)
- 영상/이미지 직접 편집 기능
- CapCut 이외의 편집기 지원 (Premiere, DaVinci 등)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID    | Requirement                                            | Priority | Status  |
| ----- | ------------------------------------------------------ | -------- | ------- |
| FR-01 | 대본 텍스트 파일(.txt/.md)을 입력받아 장면 단위로 파싱 | High     | Pending |
| FR-02 | 각 장면에 대해 AI 이미지 생성 (xAI Grok API)           | High     | Pending |
| FR-03 | 전체 나레이션 TTS 음성 생성 (ElevenLabs API)           | High     | Pending |
| FR-04 | 음성 기반 자막 타임스탬프 자동 생성                    | High     | Pending |
| FR-05 | CapCut draft_content.json 형식으로 프로젝트 파일 조립  | High     | Pending |
| FR-06 | CapCut 프로젝트 폴더에 직접 출력 (OS별 경로 자동 감지) | Medium   | Pending |
| FR-07 | 설정 파일(.cutflowrc)로 API 키/음성/스타일 관리        | Medium   | Pending |
| FR-08 | 이미지 스타일 프리셋 지원 (실사, 일러스트, 만화 등)    | Low      | Pending |
| FR-09 | Ken Burns 효과 (줌인/줌아웃) 자동 적용                 | Medium   | Pending |
| FR-10 | BGM 트랙 추가 지원 (로컬 파일 지정)                    | Low      | Pending |

### 3.2 Non-Functional Requirements

| Category      | Criteria                               | Measurement Method |
| ------------- | -------------------------------------- | ------------------ |
| Performance   | 5분 대본 기준 3분 이내 생성 완료       | CLI 실행 시간 측정 |
| Reliability   | API 실패 시 재시도 + 부분 결과 저장    | 에러 로그 확인     |
| Usability     | 설치 후 3분 이내 첫 프로젝트 생성 가능 | 사용자 테스트      |
| Compatibility | Windows/Mac 모두 지원                  | OS별 테스트        |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `cutflow generate script.txt` 실행 시 CapCut 프로젝트 생성
- [ ] 생성된 프로젝트를 CapCut에서 정상 오픈 가능
- [ ] 이미지, 음성, 자막이 타임라인에 올바르게 배치
- [ ] README에 설치/사용 방법 문서화

### 4.2 Quality Criteria

- [ ] 생성된 JSON이 CapCut에서 오류 없이 로드
- [ ] API 키 미설정 시 명확한 에러 메시지
- [ ] 10개 이상 장면 대본에서도 정상 동작

---

## 5. Risks and Mitigation

| Risk                              | Impact | Likelihood | Mitigation                                                  |
| --------------------------------- | ------ | ---------- | ----------------------------------------------------------- |
| CapCut JSON 포맷 비공개/변경 가능 | High   | Medium     | 리버스 엔지니어링 + 버전별 어댑터 패턴                      |
| CapCut 최신 버전 파일 암호화      | High   | Medium     | 암호화 이전 포맷 지원, 커뮤니티 솔루션 모니터링             |
| API 비용 누적 (이미지+TTS)        | Medium | High       | 비용 추정 표시, 로컬 대안(Stable Diffusion, Piper TTS) 고려 |
| xAI/ElevenLabs API 변경           | Medium | Low        | API 클라이언트 추상화 레이어로 교체 용이하게 설계           |
| 타임스탬프 동기화 불일치          | Medium | Medium     | TTS 반환 타임스탬프 직접 활용, 수동 오프셋 옵션             |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level          | Characteristics              | Recommended For | Selected |
| -------------- | ---------------------------- | --------------- | :------: |
| **Starter**    | 단순 구조                    | 정적 사이트     |    ☐     |
| **Dynamic**    | 모듈 기반, BaaS              | 웹앱            |    ☐     |
| **Enterprise** | 계층 분리, DI                | 대규모 시스템   |    ☐     |
| **CLI Tool**   | Node.js CLI, 파이프라인 패턴 | **이 프로젝트** |    ☑     |

### 6.2 Key Architectural Decisions

| Decision        | Options                   | Selected                  | Rationale                              |
| --------------- | ------------------------- | ------------------------- | -------------------------------------- |
| 언어            | TypeScript / Python       | **TypeScript**            | CapCut JSON 처리에 적합, npm 배포 용이 |
| 런타임          | Node.js / Deno / Bun      | **Node.js**               | 안정성, 생태계                         |
| CLI 프레임워크  | Commander / yargs / Clack | **Commander + Clack**     | Commander(파싱) + Clack(인터랙티브 UI) |
| 빌드            | tsup / esbuild / tsc      | **tsup**                  | 번들링 + 타입 체크                     |
| HTTP 클라이언트 | fetch / axios / got       | **node fetch (built-in)** | 외부 의존성 최소화                     |
| 패키지 매니저   | npm / pnpm                | **npm**                   | 범용성                                 |
| 테스트          | Vitest / Jest             | **Vitest**                | TypeScript 네이티브, 빠른 실행         |

### 6.3 파이프라인 아키텍처

```
대본 입력
    │
    ▼
┌─────────────────┐
│  Script Parser   │  대본 → 장면[] 배열로 변환
│  (scenes split)  │  (장면 구분자: ---, ##, 빈 줄 등)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Image  │ │  TTS   │  병렬 처리
│ Gen    │ │  Gen   │  (이미지 + 음성 동시 생성)
│ (xAI)  │ │(11Labs)│
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌─────────────────┐
│ Timeline Builder │  이미지 + 음성 + 자막을 타임라인으로 조립
│ (sync & layout)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CapCut Exporter  │  draft_content.json + 미디어 파일 배치
│ (JSON assembly)  │
└────────┬────────┘
         │
         ▼
    CapCut 프로젝트 폴더에 출력
```

### 6.4 폴더 구조 (예상)

```
cutflow/
├── src/
│   ├── cli/              # CLI 진입점, 명령어 정의
│   │   └── index.ts
│   ├── parser/           # 대본 파싱 모듈
│   │   └── script-parser.ts
│   ├── generators/       # AI 생성 모듈
│   │   ├── image-generator.ts    # xAI Grok 이미지
│   │   └── tts-generator.ts      # ElevenLabs TTS
│   ├── timeline/         # 타임라인 조립
│   │   └── timeline-builder.ts
│   ├── exporters/        # 프로젝트 파일 출력
│   │   └── capcut-exporter.ts
│   ├── types/            # 타입 정의
│   │   └── index.ts
│   └── config/           # 설정 관리
│       └── config.ts
├── templates/            # CapCut JSON 템플릿
│   └── draft-content.json
├── tests/                # 테스트
├── package.json
├── tsconfig.json
└── README.md
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` 프로젝트 규칙 파일 존재
- [ ] ESLint 설정
- [ ] Prettier 설정
- [ ] TypeScript 설정

### 7.2 Conventions to Define/Verify

| Category             | Current State | To Define                       | Priority |
| -------------------- | ------------- | ------------------------------- | :------: |
| **Naming**           | missing       | camelCase 변수, kebab-case 파일 |   High   |
| **Folder structure** | missing       | 위 6.4 구조 기준                |   High   |
| **Error handling**   | missing       | Result 패턴 (성공/실패 구분)    |   High   |
| **Logging**          | missing       | 진행 상황 표시 (Clack 스피너)   |  Medium  |

### 7.3 Environment Variables Needed

| Variable              | Purpose                     | Scope                | To Be Created |
| --------------------- | --------------------------- | -------------------- | :-----------: |
| `XAI_API_KEY`         | xAI Grok 이미지 생성        | CLI 환경변수         |       ☑       |
| `ELEVENLABS_API_KEY`  | ElevenLabs TTS              | CLI 환경변수         |       ☑       |
| `ELEVENLABS_VOICE_ID` | TTS 음성 선택               | 설정파일(.cutflowrc) |       ☑       |
| `CAPCUT_PROJECT_DIR`  | CapCut 프로젝트 경로 (선택) | 설정파일             |       ☐       |

---

## 8. Next Steps

1. [ ] Design 문서 작성 (`script-to-capcut.design.md`)
2. [ ] CapCut draft_content.json 포맷 리버스 엔지니어링 (실제 파일 분석)
3. [ ] 프로젝트 초기화 (package.json, tsconfig.json, tsup 설정)
4. [ ] 구현 시작

---

## Version History

| Version | Date       | Changes       | Author |
| ------- | ---------- | ------------- | ------ |
| 0.1     | 2026-03-26 | Initial draft | Claude |
