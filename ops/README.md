# 운영 작업 가이드 (사람 전용)

이 레포(`finsight/`)는 **harness 전용 작업 복사본**이다. harness는 `codex exec --sandbox workspace-write`로 무인 실행되고 `git add -A`로 커밋하므로, 이 폴더에는 운영 자격증명과 실데이터를 두지 않는다.

## 폴더 구성
| 위치 | 용도 | 들어가는 것 |
|---|---|---|
| `finsight/` (이 레포) | harness 실행, 코드 작성 | 코드, 테스트, 합성 fixture. **실제 키·link·실데이터 없음** |
| `finsight-ops/` (별도 clone) | 사람이 하는 운영 작업 | `supabase link`, `db push`, `gen types`, `.env.local`, Vercel 연결·배포, 실제 파일 대조 |
| `~/finsight-private/` (레포 밖) | 실제 카드 명세서 보관 | 본인 카드 이용내역 파일. 절대 레포 안으로 복사하지 않는다 |

## 처음 한 번
```bash
# 1) 운영용 clone (이 레포와 나란히)
cd ~/Desktop/ai_project
git clone ./finsight finsight-ops

# 2) 실제 명세서 보관 폴더
mkdir -p ~/finsight-private && chmod 700 ~/finsight-private

# 3) gitleaks 설치 (pre-commit이 사용)
brew install gitleaks
```

## 작업별 위치
| 작업 | 어디서 |
|---|---|
| `python3 scripts/execute.py <phase>` | `finsight/` |
| Supabase 프로젝트 연결, 마이그레이션 적용, 타입 생성 | `finsight-ops/` (`git pull` 후) |
| `.env.local` 작성, `npm run dev`로 실제 서비스 확인 | `finsight-ops/` |
| 실제 명세서로 파서 대조 | `finsight-ops/`에서 `~/finsight-private/` 파일을 읽어서 |
| Vercel 연결·배포, 환경변수 등록 | `finsight-ops/` 또는 Vercel 대시보드 |

`finsight-ops/`에서 만든 코드 변경(예: 생성된 `src/types/database.ts`)은 커밋·push 후 `finsight/`에서 pull한다.

## 사람이 직접 할 준비 (plan.md 10장)
- [ ] Polar 사전 승인 문의 보내기 → `ops/polar-approval-request.md`
- [ ] 0-foundation 이후: Supabase dev·prod(서울) 생성, `link` → `db push` → `gen types`, 카카오("Allow users without an email", 이메일 자동 연결 확인)·구글 OAuth, 운영자 MFA
- [ ] 1-ingest 이후: Anthropic 키 + 월 지출 한도, 실제 파일 대조
- [ ] 4-billing 전: Polar sandbox 상품(₩6,900 / $4.99), 공개 checkout 링크 끄기, 고객당 구독 1개, 유예 7일, 웹훅 secret
- [ ] 5-launch 이후: 가이드 문구 확인, 업타임 모니터
- [ ] 런칭 전: Polar KYC, Vercel Pro, preview/production env 분리, 도메인, 법률 검토
