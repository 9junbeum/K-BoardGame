# KBG — 링크 하나로 어디서든 친구와 보드게임!

가입 없이 **링크 하나로** 친구와 다양한 보드게임을 즐기는 웹 서비스.
수를 두면 상대 화면에 즉시 반영됩니다.

## 스택

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase — Realtime(실시간 동기화) / Postgres(게임·기록) / Auth(구글 로그인)
- 배포(예정): Cloudflare Pages + Supabase

## 실행법

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 오목 로직 유닛 테스트
```

Supabase 없이 실행하면 **같은 화면 대국(로컬 모드)** 만 동작합니다.
실시간 대전을 켜려면 아래 Supabase 설정을 완료하세요.

## Supabase 설정 (실시간 대전 활성화)

1. https://supabase.com → 무료 프로젝트 생성 (리전: Northeast Asia 권장)
2. **SQL Editor** 에서 `supabase/migrations/0001_init.sql` 내용 전체 실행
3. **Project Settings > API** 에서 `Project URL` 과 `anon public` 키 복사
4. `.env.local.example` 을 `.env.local` 로 복사하고 값 채우기
5. `npm run dev` 재시작

### 구글 로그인 (선택 — 기록 영구 보관)

1. Google Cloud Console → OAuth 클라이언트 ID 생성 (웹 애플리케이션)
2. Supabase 대시보드 → Authentication > Providers > Google 활성화, 클라이언트 ID/시크릿 입력
3. Authentication > URL Configuration 에서 Site URL / Redirect URL 에 `http://localhost:3000` 추가

## 구조

```
src/
  app/
    page.tsx              # 로비 (시작 버튼, 최근 기록, 로그인)
    room/local/page.tsx   # 같은 화면 대국 (로컬 모드)
    room/[roomId]/page.tsx# 온라인 대국 (공유 링크 = 방 주소)
  components/             # Board, NicknameModal, HistoryList
  games/omok/logic.ts     # 순수 게임 로직 (+ logic.test.ts)
  lib/                    # supabase 클라이언트, 익명 플레이어 ID, 기록 저장
supabase/migrations/      # DB 스키마 + RLS + Realtime 설정
```

## 기록 저장 정책

- **익명**: `localStorage` — 캐시 삭제/시크릿 모드/다른 기기에서는 소실 (UI에 안내 노출)
- **구글 로그인**: Supabase `game_history` 테이블에 영구 저장 (RLS로 본인만 조회)
