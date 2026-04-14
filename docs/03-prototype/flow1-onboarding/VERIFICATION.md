# Flow 1 온보딩 — 검증 기록

## BUG-001: 1-6-coach-profile.html 하단 CTA 버튼 위치 오류

### 증상
- "프로필 등록 완료" 버튼이 화면 하단에 고정되지 않음
- 폼 필드가 12개로 많아 스크롤 시 버튼이 콘텐츠 맨 아래로 밀려남
- 스크롤하지 않으면 버튼이 보이지 않는 경우 발생

### 원인 분석
```
.screen (position:relative + overflow-y:auto)  ← 스크롤 컨테이너
  └── .page-pad (폼 콘텐츠, 높이 > 뷰포트)
  └── CTA div (position:absolute; bottom:0)    ← 문제 지점
```

- `position:absolute`는 가장 가까운 positioned ancestor(`.screen`)를 기준으로 배치
- `.screen`이 `overflow-y:auto`인 경우, absolute 자식은 **스크롤 콘텐츠 전체 높이 기준 bottom:0**에 위치
- 즉, 스크롤의 맨 끝에 배치되어 사용자가 끝까지 스크롤해야만 버튼이 보임
- 1-4-student-profile.html은 폼 필드가 5개로 적어 동일 패턴이지만 증상이 경미

### 해결 방법
- `position:absolute` → `position:sticky` 변경
- `sticky`는 스크롤 컨테이너의 **뷰포트 하단에 고정**되어 항상 보임

### 수정 대상
| 파일 | 수정 내용 | 상태 |
|------|-----------|------|
| 1-6-coach-profile.html | CTA를 `.screen` 밖 `.device`의 flex 자식으로 이동 (스크롤 영역 외부 배치) | ✅ 수정 완료 (v2) |
| 1-4-student-profile.html | `position:absolute` → `position:sticky` 예방적 수정 | ✅ 수정 완료 |
| common.css | 공통 `.bottom-cta-fixed` 클래스 추가 | ✅ 1-6에 적용 |

### 수정 이력
- v1 (2026-04-10): `position:absolute` → `position:sticky` — 부분 개선
- v2 (2026-04-10): CTA를 `.device` flex 자식으로 분리 — **완전 수정**
  - `.device`가 `display:flex;flex-direction:column`이므로 `.screen`에 `flex:1`을 주고 CTA는 별도 flex 자식으로 배치
  - 스크롤 영역(`.screen`)과 CTA가 완전히 분리되어 스크롤 길이와 무관하게 하단 고정

### 검증일
- 2026-04-10 (v1), 2026-04-10 (v2)

---

## BUG-002: 1-6-coach-profile.html 소개 이미지 삭제(✕) 버튼 깨짐

### 증상
- 소개 이미지 카드 우상단의 ✕ 삭제 버튼이 잘리거나 보이지 않음

### 원인 분석
```
#image-upload-list (overflow-x:auto)     ← 가로 스크롤 컨테이너
  └── 이미지 카드 (position:relative)
      └── ✕ 버튼 (position:absolute; top:-4px; right:-4px)  ← 문제 지점
```

- 삭제 버튼이 `top:-4px;right:-4px`으로 이미지 카드 **바깥(음수 좌표)** 에 배치
- 부모 스크롤 컨테이너의 `overflow-x:auto`가 카드 외부 영역을 **clip** 처리
- 결과: ✕ 버튼의 상단·우측이 잘려서 깨져 보임

### 해결 방법
1. 삭제 버튼 위치를 카드 **안쪽**으로 이동: `top:-4px;right:-4px` → `top:4px;right:4px`
2. 버튼 크기 `20px` → `22px`, `font-size:11px` → `12px` (가시성 향상)
3. `box-shadow` 추가하여 이미지 위에서도 명확히 보이도록 처리
4. `line-height:1` 추가하여 ✕ 문자 수직 정렬 보정
5. 스크롤 컨테이너 `padding:4px 0` 추가하여 카드 주변 여유 공간 확보

### 수정 대상
| 파일 | 수정 내용 | 상태 |
|------|-----------|------|
| 1-6-coach-profile.html | ✕ 버튼 위치·크기·그림자 수정, 컨테이너 패딩 추가 | ✅ 수정 완료 |

### 검증일
- 2026-04-10

---

## BUG-003: 1-4b-signup-complete.html 하단 CTA 버튼 깨짐

### 증상
- "홈으로 이동" / "코치 둘러보기" 버튼이 좌우 배열되지 않고 레이아웃 깨짐

### 원인 분석
```
div (flex-direction:row)
  ├── <button> btn-secondary    ← height 자동 (52px, common.css)
  ├── <a> btn-primary           ← height 미지정, display:flex로 콘텐츠 의존
  └── <div> 안내 문구            ← 문제: flex-row 안에 블록 텍스트가 세 번째 아이템으로 끼어듦
```

1. `<button>`과 `<a>` 태그가 혼용 → height 렌더링 불일치 (`<button>`은 common.css `height:52px` 적용, `<a>`는 명시적 height 없음)
2. 안내 문구 `<div>`가 `flex-direction:row` 컨테이너 안에 포함 → 버튼 옆에 텍스트가 끼어들어 레이아웃 붕괴

### 해결 방법
1. 두 버튼 모두 `<a>` 태그로 통일 + `height:48px` 명시
2. 안내 문구를 flex-row 컨테이너 **밖**으로 분리 (별도 `<div>`)
3. 버튼 텍스트 간결하게 조정 ("홈으로 이동" → "홈으로")

### 수정 대상
| 파일 | 수정 내용 | 상태 |
|------|-----------|------|
| 1-4b-signup-complete.html | 버튼 태그 `<a>` 통일 + height:48px 명시 + 안내 문구 분리 | ✅ 수정 완료 |

### 검증일
- 2026-04-12

---

## BUG-004: 2-2-coach-list.html 지역 필터 2depth(시·군·구) 미노출

### 증상
- 지역 필터 바텀시트에서 시·도를 선택해도 시·군·구 목록이 표시되지 않음 (서울/부산/경기 외)

### 원인 분석
```
updateFilterSigungu() 함수의 regionData 객체에
17개 시·도 중 3개만 정의 (서울, 부산, 경기)
→ 나머지 14개 시·도 선택 시 regionData[sido] = undefined → 시·군·구 옵션 생성 안 됨
```

### 해결 방법
- regionData에 대한민국 전체 17개 시·도 + 약 250개 시·군·구 데이터 추가
- 1-4-student-profile.html, 1-6-coach-profile.html과 동일한 전국 데이터 적용

### 수정 대상
| 파일 | 수정 내용 | 상태 |
|------|-----------|------|
| flow2-home/2-2-coach-list.html | regionData 3개 → 17개 시·도 전체 데이터로 교체 | ✅ 수정 완료 |

### 검증일
- 2026-04-12

---

## BUG-005: 지역 시·군·구 데이터 누락 — 전체 파일 검증

### 증상
- 여러 화면에서 시·도 선택 후 시·군·구 목록이 비어있거나 일부만 표시됨
- 서울/부산/경기 외 시·도 선택 시 시·군·구가 나오지 않음

### 원인
지역 데이터(`regionData`)가 포함된 파일마다 **복사-붙여넣기 시 누락** 발생.
동일한 데이터를 각 파일에 개별 관리하여 불일치 발생.

### 전체 검증 결과

| 파일 | 위치 | 함수명 | 수정 전 | 수정 후 | 상태 |
|------|------|--------|--------|--------|:----:|
| `flow1-onboarding/1-4-student-profile.html` | 학생 프로필 | `updateSigungu()` | 17개 전체 ✅ | — | 정상 |
| `flow1-onboarding/1-6-coach-profile.html` | 코치 프로필 | `updateCoachSigungu()` | 17개 전체 ✅ | — | 정상 |
| `flow2-home/2-1-home.html` | 홈 검색 바텀시트 | `updateSearchSigungu()` | **3개만** ❌ | 17개 전체 | ✅ 수정 |
| `flow2-home/2-2-coach-list.html` | 코치 목록 필터 | `updateFilterSigungu()` | 17개 전체 ✅ | — | 정상 (BUG-004) |

### 재발 방지 규칙

**⚠️ 지역 데이터 작성 시 반드시 확인할 체크리스트:**

1. **17개 시·도 모두 포함 확인**: 서울, 부산, 대구, 인천, 광주, 대전, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주
2. **각 시·도별 시·군·구 배열이 비어있지 않은지 확인**
3. **새 파일에 지역 셀렉트 추가 시**: 기존 전체 데이터를 가진 파일(1-4-student-profile.html)에서 복사
4. **실제 구현 시**: 지역 데이터를 별도 JSON 파일 또는 API로 분리하여 중복 관리 제거

### 근본 해결 (구현 단계)
```
현재: 각 HTML 파일에 regionData 개별 하드코딩 (4개 파일 × 250개 시·군·구)
개선: /api/regions 또는 shared/region-data.json으로 단일 소스 관리
     → 모든 화면에서 동일 데이터 참조, 불일치 원천 차단
```

### 검증일
- 2026-04-12
