# UI 디자인 가이드

## 디자인 원칙
1. 도구처럼 보여야 한다. 마케팅 페이지가 아니라 매달 여는 가계 대시보드다.
2. 숫자가 주인공이다. 금액은 크고 또렷하게, 설명은 짧게. 모든 숫자는 `tabular-nums`.
3. 신뢰가 먼저다. 무엇을 저장하고 무엇을 AI로 보내는지 화면에서 짧게 밝힌다. 과장된 문구와 장식은 쓰지 않는다.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |
| 이모지 섹션 아이콘, ✨ 반짝이 | 장식일 뿐 정보가 없다 |

## 색상 (토큰은 `src/app/globals.css`, Tailwind 클래스 이름은 괄호)
라이트 고정. 무채색 + 포인트 1색(딥 그린).

### 배경·선
| 용도 | 값 |
|------|------|
| 페이지 | `#F6F7F5` (`bg-bg`) |
| 카드·패널 | `#FFFFFF` (`bg-surface`) |
| 경계선 | `#E1E5E2` (`border-line`) |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 텍스트·숫자 | `#18201C` (`text-ink`) |
| 본문 | `#3B4540` (`text-body`) |
| 보조 | `#66716B` (`text-muted`) |
| 비활성 | `#9AA39E` (`text-disabled`) |

### 포인트·시맨틱
| 용도 | 값 |
|------|------|
| 포인트(주 버튼, 선택, 링크) | `#0E6B55` (`bg-accent`/`text-accent`), hover `#0B5745`, 옅은 배경 `#E4F1EC` (`bg-accent-soft`) |
| 지출 증가(전월 대비 +) | `#D03B2F` (`text-spend-up`) |
| 지출 감소(전월 대비 −) | `#2563EB` (`text-spend-down`) |
| 경고(추정 금액, 분류 실패) | `#B45309` (`text-warning`) |
- 포인트 색은 한 화면에 한 역할(주 행동)만. 차트 카테고리 색은 포인트 색과 별도 팔레트(채도 낮은 8색)를 쓰고, 9번째부터는 "기타"로 묶는다.
- 색만으로 의미를 전달하지 않는다. 증감에는 `+`/`−` 기호를 함께 쓴다.

## 컴포넌트
### 카드
```
rounded-md bg-surface border border-line p-5
```
요약 숫자 타일만 카드로 감싼다. 목록·표는 카드 없이 구분선으로 나눈다.

### 버튼
```
Primary: rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:bg-disabled
Secondary: rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:bg-bg
Text: text-sm text-muted hover:text-ink underline-offset-4 hover:underline
```

### 입력 필드
```
rounded-md bg-surface border border-line px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30
```

### 금액
- `formatKRW()`만 쓴다: `₩1,234,000`. 요약 타일은 `text-3xl font-semibold tabular-nums`.
- 차트 축·범례는 만원 단위로 줄인다: `12만`, `1,234만`. 툴팁에는 원 단위 전체 금액.
- 추정 금액(해외 매입 전)에는 `추정` 배지(`text-warning`).

### 잠긴 Pro 영역
- 실제 결과 일부를 보여 주고 나머지는 흐리게(`opacity-40` + `select-none`) 처리한 뒤, 가운데가 아닌 **왼쪽 정렬** 문구 한 줄과 버튼 하나: "Pro에서 전체 목록을 볼 수 있어요 [Pro 시작하기]".

## 레이아웃
- 전체 너비: `max-w-5xl`, 좌우 여백 `px-4`(모바일 16px).
- 정렬: 좌측 정렬 기본. 히어로 포함 중앙 정렬 금지.
- 간격: 요소 사이 `gap-3`~`gap-4`, 섹션 사이 `space-y-8`.
- 앱 화면: 상단 바(로고 · 월 선택 · 설정), 본문 1열. 데스크톱에서 요약 타일 3열, 모바일 1열.

## 타이포그래피 (Pretendard)
| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | `text-2xl font-semibold text-ink` (랜딩 히어로만 `text-4xl`) |
| 섹션 제목 | `text-base font-semibold text-ink` |
| 카드 라벨 | `text-sm font-medium text-muted` |
| 본문 | `text-sm text-body leading-relaxed` |
| 숫자 | `tabular-nums`, 요약은 `text-3xl font-semibold` |

## 문구
- 해요체. 짧고 구체적으로. 사과·과장 없이 무엇이 문제이고 어떻게 하면 되는지.
- 버튼은 결과를 말한다: "업로드", "다시 분류", "Pro 시작하기". 완료 후 토스트: "업로드했어요".
- 에러 예: "암호가 걸린 파일이에요. 엑셀에서 열어 다른 이름으로 저장한 뒤 올려 주세요."
- AI 결과 아래에는 항상 한 줄: "지출 정리를 돕는 요약이에요. 투자·세무 조언이 아니에요."

## 애니메이션
- 허용: 상태 변화 fade(150ms), 진행 표시(스피너·단계 표시), 차트 최초 렌더 1회.
- `prefers-reduced-motion`이면 모두 끈다. 그 외 모든 애니메이션 금지.

## 아이콘
- 인라인 SVG, `strokeWidth 1.5`, 크기 16/20px. 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다.
