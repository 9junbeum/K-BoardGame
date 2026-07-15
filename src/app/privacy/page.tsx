import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 — KBG",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="font-plex text-xs text-mud underline-offset-4 transition hover:text-ink hover:underline"
        >
          ← 로비로
        </Link>
        <span className="font-plex text-[10px] uppercase tracking-widest text-mud">
          privacy policy
        </span>
      </header>

      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-2 font-plex text-xs text-mud">시행일자: 2026년 7월 13일</p>

      <div className="prose-section mt-8 space-y-8 text-sm leading-relaxed text-ink-soft">
        <Section title="1. 수집하는 개인정보 항목">
          <p>KBG(이하 &ldquo;서비스&rdquo;)는 다음과 같은 정보를 수집합니다.</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ink">익명 이용자</strong> — 별도의 개인정보를 수집하지 않습니다.
              브라우저에 무작위로 생성되어 저장되는 식별자(player_id)와, 대국 시 직접 입력한
              닉네임만 사용되며, 이는 특정 개인을 식별할 수 없습니다.
            </li>
            <li>
              <strong className="text-ink">구글 로그인 이용자</strong> — 구글 계정의 이메일 주소를
              수집합니다. (비밀번호는 수집하지 않으며, 로그인은 Supabase Auth를 통해 Google이
              직접 인증합니다.)
            </li>
            <li>
              <strong className="text-ink">서비스 이용 기록</strong> — 대국 결과, 상대 닉네임, 착수
              기록, 대국 일시. 로그인 이용자는 서버에, 익명 이용자는 이용 중인 브라우저에만
              저장됩니다.
            </li>
            <li>
              <strong className="text-ink">자동 수집 정보</strong> — 접속 로그, 기기·브라우저 정보
              등이 서비스 운영 및 광고 게재 과정에서 인프라(Vercel, Supabase, 광고 네트워크)에
              의해 자동으로 수집될 수 있습니다.
            </li>
          </ul>
        </Section>

        <Section title="2. 개인정보의 수집 및 이용 목적">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>실시간 대국 진행 및 상대와의 매칭</li>
            <li>대국 기록 저장·조회 서비스 제공</li>
            <li>구글 로그인을 통한 회원 식별 및 서비스 제공</li>
            <li>광고 게재를 통한 서비스 운영 재원 마련</li>
            <li>부정 이용 방지 및 서비스 품질 개선</li>
          </ul>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              익명 이용자의 정보는 이용자의 브라우저에만 저장되며, 이용자가 브라우저 캐시·저장소를
              삭제하면 함께 삭제됩니다. 서비스 운영자는 이 정보를 서버에 보관하지 않습니다.
            </li>
            <li>
              구글 로그인 이용자의 정보는 회원 탈퇴 또는 삭제 요청 시까지 보관하며, 요청이 접수되면
              지체 없이 파기합니다.
            </li>
          </ul>
        </Section>

        <Section title="4. 개인정보 처리 위탁">
          <p>서비스는 아래 외부 사업자에게 개인정보 처리 업무를 위탁하고 있습니다.</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ink">Supabase, Inc.</strong> — 데이터베이스 저장, 회원 인증,
              실시간 통신 인프라 제공
            </li>
            <li>
              <strong className="text-ink">Google LLC</strong> — 구글 로그인(OAuth) 인증 제공
            </li>
            <li>
              <strong className="text-ink">Vercel Inc.</strong> — 웹사이트 호스팅
            </li>
          </ul>
        </Section>

        <Section title="5. 쿠키 및 광고에 관한 사항">
          <p>
            서비스는 카카오 애드핏(Kakao AdFit) 등 광고 네트워크를 통해 광고를 게재하며, 이 과정에서
            쿠키 및 광고 식별자가 사용될 수 있습니다. 광고 네트워크는 이용자의 관심사에 맞는 광고를
            보여주기 위해 방문 정보를 수집·활용할 수 있으며, 이는 개인을 특정하지 않는 방식으로
            처리됩니다.
          </p>
          <p className="mt-2">
            이용자는 브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있습니다. 다만 쿠키 저장을
            거부할 경우 일부 서비스 이용에 어려움이 있을 수 있습니다.
          </p>
        </Section>

        <Section title="6. 이용자의 권리">
          <p>
            이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제를 요청할 수 있습니다. 아래
            연락처로 문의해 주시면 지체 없이 조치하겠습니다.
          </p>
        </Section>

        <Section title="7. 개인정보의 파기 절차 및 방법">
          <p>
            수집 목적이 달성되거나 보유 기간이 종료된 개인정보는 지체 없이 파기합니다. 전자적 파일
            형태의 정보는 복구할 수 없는 방법으로 영구 삭제합니다.
          </p>
        </Section>

        <Section title="8. 개인정보 보호책임자 및 문의처">
          <p>
            서비스 운영자: 준범
            <br />
            이메일: 9junbeum@gmail.com
          </p>
        </Section>

        <Section title="9. 고지의 의무">
          <p>
            이 개인정보처리방침은 법령·정책 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시 이
            페이지를 통해 공지합니다.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
