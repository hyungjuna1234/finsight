# DB 어드바이저 — 2026-10-25
Supabase `finsight` (`pbflmeqypramgfyjpsby`) · ap-northeast-2 · 마이그레이션 드리프트: 없음(로컬·원격 3개 동일) · 첫 점검

## 요약
🔴 0 · 🟠 1 · 🟡 4 · ⚪ 2 · 수용됨 0

## 마이그레이션으로 고칠 수 있음
| 심각도 | lint | 대상 | 설명 |
|---|---|---|---|
| 🟡 | `unindexed_foreign_keys` | `consents.consents_user_id_fkey` (컬럼 `user_id`) | FK에 커버하는 인덱스가 없어 조회·삭제 성능이 떨어질 수 있음 |
| 🟡 | `unindexed_foreign_keys` | `transactions.transactions_card_id_fkey` (컬럼 `card_id`) | 동일. `transactions_user_occurred_on_idx`는 `(user_id, occurred_on)`만 덮어 이 FK는 안 덮음 |
| 🟡 | `unindexed_foreign_keys` | `transactions.transactions_upload_id_fkey` (컬럼 `upload_id`) | 동일 |
| 🟡 | `unindexed_foreign_keys` | `uploads.uploads_card_id_fkey` (컬럼 `card_id`) | 동일 |

## 설정으로만 고칠 수 있음 (사람이 대시보드/Management API)
| 심각도 | lint | 대상 | remediation |
|---|---|---|---|
| 🟠 | `auth_leaked_password_protection` | Auth (프로젝트 설정) | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection |

## 판단 보류
| lint | 대상 | 보류 이유 |
|---|---|---|
| `unused_index` | `transactions_user_occurred_on_idx` (`public.transactions`) | 전체 테이블 `rows = 0`(실사용 데이터 없음). "안 쓰임"이 아니라 아직 트래픽이 없어서 판단 불가 — `docs/ARCHITECTURE.md` 설계상 거래 목록 조회에 쓰이는 의도된 인덱스라 지금 삭제를 권하지 않음 |
| `unused_index` | `ai_usage_user_feature_created_at_idx` (`public.ai_usage`) | 동일(전체 테이블 `rows = 0`). 일일 상한 집계(`src/server/limits.ts`)에 쓰이는 의도된 인덱스로 보임 |

## 적용 결과
4건 전부 사용자가 선택 → `supabase/migrations/20261025000000_add_missing_fk_indexes.sql` 작성, `npm run test`(889개) · `npm run lint` 통과. 원격 반영은 아직 안 됨 — `finsight-ops/`에서 `git pull` 후 `supabase db push` 필요.

## 수용됨
(없음)

## 직전 점검 대비
첫 점검이라 생략.

## 상세

### `unindexed_foreign_keys` (성능, INFO → 🟡)
- lint 설명: "Identifies foreign key constraints without a covering index, which can impact database performance."
- `public.consents` FK `consents_user_id_fkey`: "has a foreign key ... without a covering index. This can lead to suboptimal query performance."
- `public.transactions` FK `transactions_card_id_fkey`, `transactions_upload_id_fkey`: 동일 문구.
- `public.uploads` FK `uploads_card_id_fkey`: 동일 문구.
- 분류 이유: 전부 `create index ...` 한 줄로 고칠 수 있는 구조적 지적이라 "마이그레이션으로 고칠 수 있음".
- remediation: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

### `auth_leaked_password_protection` (보안, WARN → 🟠)
- lint 설명: "Leaked password protection is currently disabled." Supabase Auth가 HaveIBeenPwned.org 대비 유출 비밀번호를 걸러주는 기능.
- 분류 이유: SQL 마이그레이션 대상이 아니라 Supabase 프로젝트의 Auth 설정이고, 이 MCP 서버엔 이를 바꿀 쓰기 도구가 없다. `docs/security/owasp-2026-10-08.md`의 AR-04 재검토 항목과 같은 lint — 당시에도 "대시보드 Authentication → Providers 확인 필요"로 안내했다.
- 사람이 할 일: Supabase 대시보드에서 Leaked Password Protection을 켜거나(Email provider를 아예 끄는 게 AR-04 전제라면 그 전제가 유지되는지 같이 확인), `ops/README.md`의 런칭 전 체크리스트에 항목으로 남긴다.

### `unused_index` (성능, INFO → ⚪ 판단 보류)
- lint 설명: "Detects if an index has never been used and may be a candidate for removal."
- 대상 2건 모두 `list_tables` 기준 테이블 `rows = 0`(아직 실사용 데이터가 없는 개발 단계 DB). 쿼리 통계가 쌓이기 전에는 "안 쓰임"과 "아직 안 써봄"을 구분할 수 없다.
- 분류 이유: 두 인덱스(`(user_id, occurred_on)`, `(user_id, feature, created_at)`) 모두 `docs/ARCHITECTURE.md`에 설계된 조회 패턴(거래 목록, 일일 AI 사용량 집계)과 정확히 일치해 삭제를 권하지 않는다. 실사용 트래픽이 쌓인 뒤 다시 점검 권장.
