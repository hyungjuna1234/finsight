# 사용자 흐름

MVP 범위의 사용자 흐름 4개와 예외 처리. 화면 문구는 한국어 해요체.

## ① 첫 방문 → 첫 대시보드
```
랜딩 / ─"예시 보기"─▶ /demo (샘플 데이터, Free+Pro 화면) ─"내 데이터로 시작"─┐
   └─"무료로 시작"──────────────────────────────────────────────────────┤
                                                                      ▼
                /login [카카오][구글] → GET /auth/login?provider (서버 OAuth, PKCE)
                · 인앱 브라우저(카톡·인스타)에서 구글 → "기본 브라우저로 열기" 안내
                · 취소·실패 → /login?error=…
                                                                      ▼
                ◇ 동의 완료? ◇─아니오─▶ /onboarding/consent
                      │ 예                  필수 4개 개별 체크: 개인정보 수집·이용, 국외이전, 이용약관, 만 14세 이상
                      │                     거부 → 로그아웃 + "동의해야 이용할 수 있어요"
                      ▼ ◀───────────────────┘
                ◇ 거래 있음? ◇─아니오─▶ /upload (빈 상태: [파일은 어디서 받나요?] → /guide)
                      │ 예                  ▼
                /dashboard?month=최신 데이터 월 ◀── ② 업로드
```

## ② 업로드 (카드 이용내역)
```
/upload 파일 선택 (여러 개면 하나씩 차례로)
  ├ 클라이언트 검증 실패(csv·xls·xlsx·pdf 아님, 10MB 초과) → 안내
  ▼
POST /api/uploads → 브라우저가 signed URL로 PUT → POST /api/uploads/:id/analyze
  ├ 같은 파일 ────────────────▶ "이미 올린 파일이에요 [보기]"
  ├ 암호 PDF ─────────────────▶ "비밀번호 필요": PDF 비밀번호 입력 → 같은 업로드로 analyze 다시(틀리면 "비밀번호가 맞지 않아요", 다시 입력)
  ├ 글자 없는(스캔) PDF ────────▶ "PDF에서 이용내역을 찾지 못했어요 … 엑셀로 받아 올려 주세요 [가이드]"
  ├ 암호 · 1만 행 초과 · 깨진 파일 ─▶ 원인별 안내 ("엑셀에서 열어 다른 이름으로 저장한 뒤 올려 주세요" 등)
  ├ 청구서 · 은행 파일 ─────────▶ "카드사 홈페이지에서 '이용내역'을 받아 주세요 [가이드]"
  ▼
autoConfirm? (헤더 캐시 적중 + 샘플 검증 통과)
  │ 아니오 → /upload/[id] 매핑 확인: 헤더 행, 날짜·가맹점·금액 열 선택, 미리보기 5행, 카드 이름(기존 선택 또는 새로 입력)
  ▼
POST /api/uploads/:id/confirm (파싱 · 중복 제외 · 분류, 진행 표시)
  ▼
결과: "7~9월 · 132건 추가 · 이미 있던 12건 · 분류 실패 5건 [다시 분류]" → /dashboard
```

## ③ 대시보드 → Pro → 결제
```
/dashboard?month=YYYY-MM (Free도 월 선택 가능, 한 번에 한 달)
 · 요약(총지출·환불·건수) · 카테고리 차트 · TOP5 가맹점 · 거래 목록 → 카테고리 수정 [이번 건만][같은 가맹점 모두]
 · 배너: 최신 데이터가 지난달보다 오래됐으면 "9월 내역을 올릴 차례예요"
 · Pro 티저: 정기결제 "5건 · 월 ₩47,600"(목록 잠금) · 전월 비교 잠금 카드 · 흐리게 처리한 추이 · 첫 리포트 1회 무료 · 채팅 예시 질문
        ▼
/pricing "₩6,900/월 · 해외결제 가능한 카드(VISA·Mastercard) 필요 · 언제든 해지"
 · 이미 구독 중 → Polar 고객 포털
 · POST /api/billing/checkout (서버가 사용자 ID·successUrl 설정) → Polar 결제(KRW)
     성공 → /billing/success?checkout_id=… → POST /api/billing/confirm → Pro 열림
     거절·취소 → /pricing?checkout=failed "국내전용 카드는 결제가 안 돼요. 해외결제 가능한 카드로 시도해 주세요"
```

## ④ 구독 · 데이터 · 탈퇴
```
구독 상태: Free → (결제) → Pro → (포털에서 해지) → 기간 끝까지 Pro → Free
           Pro → (갱신 실패, past_due) → 7일 유예 동안 Pro → Free
           Free가 돼도 데이터는 그대로, Pro 화면만 잠긴다.
/settings: 구독 관리(Polar 포털) · 업로드 목록 [삭제] · [전체 데이터 삭제] · [탈퇴]
           탈퇴 = "탈퇴" 입력 → 구독 해지 → 원본 파일 삭제 → 계정 삭제(데이터 cascade) → /
           구독 해지 실패 → 탈퇴 중단 + "잠시 후 다시 시도해 주세요"
```

## 예외·오류 처리
**인증**
- 카카오 이메일 없음 → 가입 허용. 세션 만료 → 로그인 후 원래 경로(`safeRedirect`)로.
- 필수 동의 없음 → 모든 앱 API가 `CONSENT_REQUIRED`(403) → 동의 화면.

**파일**
- 거부: 이미지·기타 형식(`UNSUPPORTED_FORMAT`), 암호 엑셀(`ENCRYPTED_FILE`), 스캔 PDF(`PDF_NO_TRANSACTIONS`), 빈 파일(`EMPTY_FILE`), 청구서(`BILLING_STATEMENT`), 은행(`BANK_STATEMENT`), 1만 행 초과(`TOO_MANY_ROWS`), 시트 20개 초과·셀 과다(`FILE_TOO_COMPLEX`), 10MB 초과(`FILE_TOO_LARGE`).
- 암호 PDF: 비밀번호를 물어 같은 업로드를 이어 간다(`PDF_PASSWORD_REQUIRED`·`PDF_PASSWORD_WRONG`, 실패로 기록하지 않음). 비밀번호는 저장하지 않으므로 `/upload/[id]`로 돌아오면 다시 묻는다.
- PDF 명세서: 날짜로 시작하는 줄만 거래로 읽고 합계 줄에서 멈춘다. 금액은 이용금액 열(할부는 총액), 연도 없는 날짜는 명세서의 이용기간으로 채운다. 처음엔 매핑 확인 화면을 거친다.
- 정규화: HTML·XML 형식 xls, CP949·UTF-16·NFD 한글, 제목행·합계행, 시트 여러 개(행이 가장 많은 표), 연도 없는 날짜(파일 기간으로 추정).
- 건너뜀: 합계·빈 행, 0원, 날짜 이상(2000년 이전, 오늘+31일 이후), 금액 이상.
- 중복: 같은 파일(sha256) 거부, 기간 겹침은 `identity_key`로 제외, 같은 날 같은 가맹점·금액 2건은 승인번호나 순번으로 둘 다 보존.

**거래 해석**
- 취소 표시 → `cancelled`(지출 제외). 음수 금액 → `refund`. 할부 → 이용일에 총액 + 개월 수.
- 해외 결제: 원화 환산액, 매입 전이면 `pending`("추정" 표시). 확정 파일이 오면 같은 키로 갱신.
- 포인트 차감 행은 건너뛴다(MVP).

**AI**
- 매핑 실패 → 매핑 없이 반환, 수동 매핑 화면. 분류 실패 → `기타` + `pending`, [다시 분류].
- 인사이트에 숫자가 섞이면 1회 재생성, 그래도 실패하면 `AI_UNAVAILABLE`.
- 채팅: 도구 호출 5회까지, 범위 밖·투자·세무 질문은 거절, 일일 상한 초과 → `RATE_LIMITED`.
- 가맹점명 prompt injection → 출력은 enum·zod로 검증, 마크다운 요소 제한으로 무력화.

**결제**
- 국내전용 카드는 가격 페이지에서 먼저 안내. 웹훅이 늦으면 성공 페이지의 confirm이 동기화.
- 웹훅 유실 → `requirePro`가 `period_end + 7일`을 직접 확인해 자동으로 Free.

**기기·네트워크**
- 모바일은 `accept` MIME으로 파일 선택. 네트워크 끊김 → 재시도(모든 쓰기는 멱등).

## 화면
| 영역 | 경로 |
|---|---|
| 공개 | `/` · `/demo` · `/pricing` · `/guide` · `/privacy` · `/terms` · `/refund` |
| 인증 | `/login` · `/onboarding/consent` · `/auth/login` · `/auth/callback` |
| 앱 | `/dashboard` · `/transactions` · `/upload` · `/upload/[id]` · `/trends` · `/recurring` · `/insights` · `/chat` · `/settings` · `/billing/success` |
| 공통 | `not-found` · `error` |
모든 화면은 빈 상태, 로딩, 에러 코드별 안내를 가진다.
