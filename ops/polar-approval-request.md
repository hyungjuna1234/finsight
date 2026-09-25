# Polar 사전 승인 문의 (초안)

보내는 곳: Polar support (support@polar.sh 또는 대시보드 채팅)
보내는 사람: 사용자가 직접 보낸다. 아래 영문 본문의 `[ ]` 부분을 채운 뒤 보낸다.

확인하려는 것:
1. FinSight가 Acceptable Use Policy 19조(Trading and Financial Services, "insights platforms", "financial advice … wealth management")에 해당하지 않는다는 서면 확인
2. 한국 거주 개인(또는 개인사업자)이 payout을 받을 수 있는지
3. KRW 가격 표시, 고객당 구독 1개 제한, 공개 checkout 링크 비활성화가 가능한지

답을 받으면 `plan.md` 11장(리스크)에 결과를 적고, 거절되면 4-billing 전에 결제 업체를 다시 정한다.

---

**Subject:** Pre-approval request: personal spending analytics SaaS (South Korea)

Hi Polar team,

I'm building FinSight, a SaaS for individual users in South Korea, and I'd like to confirm it is acceptable under your Acceptable Use Policy before integrating Polar as our Merchant of Record.

**What the product does**
- Users upload their own credit card usage history files (CSV/Excel exported from their card issuer's website).
- We categorize past transactions (e.g. food, transport, subscriptions), show monthly charts, detect recurring payments, and generate a plain-language summary of the user's own past spending using an LLM.
- Pro users can also ask questions about their own past transactions (e.g. "How much did I spend on delivery last month?").

**What the product does NOT do**
- No investment advice, trading, brokerage, signals, or portfolio management.
- No tax advice, lending, credit scoring, insurance, or recommendations of financial products.
- No money movement: we never hold funds, initiate payments, or connect to bank accounts. Users only upload files they downloaded themselves.
- The product shows a clear notice that it is not financial, investment, or tax advice, and the assistant declines such requests.

**Pricing**
- Free plan and one Pro subscription: ₩6,900/month (USD $4.99 as the default-currency price).

**Questions**
1. Does this use case comply with section 19 of your Acceptable Use Policy? Could you confirm in writing?
2. Can an individual [or sole proprietor] resident in South Korea receive payouts through Polar? If not, what would be required?
3. Can we (a) show KRW prices to customers in Korea, (b) limit each customer to one active subscription, and (c) disable public checkout links so that checkouts are only created from our server?

Business details:
- Name: [이름 / 상호]
- Country: South Korea
- Website: [도메인 또는 준비 중]
- Expected launch: [예: 2026년 12월]

Thank you,
[이름]
[이메일]
