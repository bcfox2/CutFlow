# Script-to-CapCut Gap Analysis Report

> **Feature**: script-to-capcut
> **Date**: 2026-03-26
> **Design**: docs/02-design/features/script-to-capcut.design.md
> **Match Rate**: 72%

---

## Overall Scores

| Category               |  Score  | Status |
| ---------------------- | :-----: | :----: |
| Data Model Match       |   93%   |   W    |
| Module Interface Match |   88%   |   W    |
| CapCut Schema Match    |   95%   |   O    |
| CLI Feature Match      |   50%   |   X    |
| Error Handling Match   |   83%   |   W    |
| Test Coverage          |   0%    |   X    |
| Convention Compliance  |   95%   |   O    |
| **Overall**            | **72%** | **W**  |

---

## [RED] Missing Features (Design O, Implementation X)

| #   | Item              | Design Location     | Description                                       |
| --- | ----------------- | ------------------- | ------------------------------------------------- |
| 1   | `cutflow init`    | design 6.1          | 설정 파일 인터랙티브 생성 명령어 미구현           |
| 2   | `cutflow config`  | design 6.1          | 설정값 변경 명령어 미구현                         |
| 3   | `--dry-run`       | design 6.1          | JSON 구조만 출력 옵션 미구현                      |
| 4   | `--verbose`       | design 6.1          | 상세 로그 옵션 미구현                             |
| 5   | Clack UI          | design 6.2          | 진행률 표시 미구현 (console.log 사용 중)          |
| 6   | E006 에러         | design 7.1          | 파일 쓰기 실패 에러 미구현                        |
| 7   | 테스트 전체       | design 8.x, 9.1 #10 | tests/\*.test.ts 0개 (9개 케이스 미작성)          |
| 8   | CapCut 타입 정의  | design 4.1-4.3      | DraftContent, Track, Segment 등 인터페이스 미정의 |
| 9   | `draft_cover.jpg` | design 4.5          | 커버 이미지 파일 미생성                           |

## [BLUE] Changed Features (Design != Implementation)

| #   | Item                      | Design                   | Implementation       | Impact                |
| --- | ------------------------- | ------------------------ | -------------------- | --------------------- |
| 1   | buildTimeline 시그니처    | (scenes, assets, config) | (assets, canvas)     | Medium                |
| 2   | VideoMaterial.type        | "video"                  | "photo"              | Medium (photo가 맞음) |
| 3   | Audio extra_material_refs | 7개 보조 Material        | 3개만                | **High**              |
| 4   | Text extra_material_refs  | 보조 Material 포함       | 빈 배열              | **High**              |
| 5   | exportCapCut 반환         | Result 패턴              | 직접 Promise (throw) | Medium                |

## Implementation Order 완료 현황

| #   | File             |  Status  |
| --- | ---------------- | :------: |
| 1-9 | src/ 전체 모듈   | O (완료) |
| 10  | tests/\*.test.ts | X (미완) |

---

## 권장 조치 (우선순위)

### P0 - CapCut 호환성

1. 오디오 세그먼트 extra_material_refs 7개로 확장
2. 텍스트 세그먼트 extra_material_refs 보조 Material 추가
3. exportCapCut에 Result 패턴 적용 + E006 에러

### P1 - 품질

4. Vitest 테스트 작성 (대본 파서, 타임라인 빌더 우선)

### P2 - 기능 완성도

5. --dry-run, --verbose 옵션
6. cutflow init / config 명령어

### Design 업데이트

7. buildTimeline 시그니처 변경 반영
8. VideoMaterial.type을 "photo"로 정정

---

## Version History

| Version | Date       | Changes              | Author       |
| ------- | ---------- | -------------------- | ------------ |
| 0.1     | 2026-03-26 | Initial gap analysis | gap-detector |
