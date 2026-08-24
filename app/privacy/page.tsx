import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const h2: React.CSSProperties = { fontFamily: 'var(--font-cinzel)', fontSize: '18px', fontWeight: 500, color: '#fff', marginTop: '38px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '0.5px solid rgba(212,175,110,0.2)' }
const p: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '14.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: '14px' }
const li: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '14.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: '8px' }
const strong: React.CSSProperties = { color: 'rgba(255,255,255,0.85)', fontWeight: 600 }
const th: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--gold)', textAlign: 'left', padding: '10px 14px', borderBottom: '0.5px solid rgba(212,175,110,0.25)' }
const td: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(255,255,255,0.6)', padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', lineHeight: 1.6 }

export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px 100px' }}>

          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.28em', color: 'var(--gold)', marginBottom: '14px' }}>GREEN EMBLEM</div>
            <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Privacy Policy</h1>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
              Effective August 10, 2026
            </p>
          </div>

          <p style={p}>
            This Privacy Policy explains how Green Emblem LLC (&ldquo;Green Emblem,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and protects information when you use our website and related services (the &ldquo;Services&rdquo;). We do not sell your personal information.
          </p>

          <h2 style={h2}>1. Information We Collect</h2>
          <p style={p}>We collect information in three ways: what you give us directly, what we receive automatically, and what third-party services you connect provide to us.</p>

          <div style={{ overflowX: 'auto', marginBottom: '18px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Category</th><th style={th}>Examples</th><th style={th}>Why</th></tr></thead>
              <tbody>
                <tr><td style={td}>Account info</td><td style={td}>Name, email, phone, mailing address</td><td style={td}>Create your account, ship orders, contact you</td></tr>
                <tr><td style={td}>Sign-in data</td><td style={td}>Google or Apple account name/email/photo, provided when you sign in with those services</td><td style={td}>Authenticate your account</td></tr>
                <tr><td style={td}>Location</td><td style={td}>Device geolocation (Prayer/Qibla tab); masjid searches (Google Places)</td><td style={td}>Calculate accurate prayer times and Qibla direction; find nearby masjids</td></tr>
                <tr><td style={td}>Campaign &amp; giving data</td><td style={td}>Honouree names, event details, campaign design choices</td><td style={td}>Build and host your Baab As-Sadaqah campaign page</td></tr>
                <tr><td style={td}>Community preferences</td><td style={td}>Followed masjid, GreenTV/GreenWorld+ subscriptions</td><td style={td}>Show relevant content, send update notifications</td></tr>
                <tr><td style={td}>Order &amp; payment data</td><td style={td}>Shipping address, order contents. Card details are handled entirely by Stripe — we never see or store your full card number.</td><td style={td}>Fulfill shop orders</td></tr>
                <tr><td style={td}>Communications</td><td style={td}>Messages you send us, newsletter opt-in status</td><td style={td}>Respond to you, send updates you asked for</td></tr>
                <tr><td style={td}>Usage data</td><td style={td}>Pages visited, device/browser type, general diagnostics</td><td style={td}>Keep the Services working and improve them</td></tr>
              </tbody>
            </table>
          </div>

          <h2 style={h2}>2. How We Use Information</h2>
          <ul style={{ paddingLeft: '20px', marginBottom: '14px' }}>
            <li style={li}>To operate the Services — accounts, campaigns, orders, prayer times, masjid directory, and content feeds.</li>
            <li style={li}>To send transactional communications (order confirmations, campaign updates, event notifications for masjids you follow).</li>
            <li style={li}>To send newsletter or marketing emails, only if you&rsquo;ve opted in — you can unsubscribe at any time.</li>
            <li style={li}>To maintain security, prevent abuse, and comply with legal obligations.</li>
          </ul>

          <h2 style={h2}>3. Third-Party Services We Use</h2>
          <p style={p}>We rely on the following processors to operate the Services. Each has its own privacy practices governing the data it processes on our behalf:</p>
          <ul style={{ paddingLeft: '20px', marginBottom: '14px' }}>
            <li style={li}><strong style={strong}>Supabase</strong> — database hosting and authentication</li>
            <li style={li}><strong style={strong}>Stripe</strong> — payment processing for shop orders</li>
            <li style={li}><strong style={strong}>Resend</strong> — transactional and newsletter email delivery</li>
            <li style={li}><strong style={strong}>Cloudinary</strong> — image hosting</li>
            <li style={li}><strong style={strong}>Google Maps / Places</strong> — masjid search, location display, and Qibla calculation</li>
            <li style={li}><strong style={strong}>Vercel</strong> — application hosting</li>
          </ul>
          <p style={p}>GreenTV content is sourced from our own Telegram channel and does not involve sharing your personal data with Telegram. Our AI-assisted event listings for GreenWorld+ process public masjid website content, not your personal information.</p>

          <h2 style={h2}>4. Location Data</h2>
          <p style={p}>Prayer times and the Qibla compass use your device&rsquo;s location, requested through your browser and used to calculate results on your device. We cache your last known location locally on your device to avoid repeated permission prompts. Masjid location searches are sent to Google&rsquo;s Places API to return matching results.</p>

          <h2 style={h2}>5. Cookies &amp; Similar Technologies</h2>
          <p style={p}>We use essential cookies to keep you signed in and remember your session. We do not use third-party advertising trackers.</p>

          <h2 style={h2}>6. Data Retention</h2>
          <p style={p}>We retain account information for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us (Section 10) — some information may be retained where required for legal, tax, or fraud-prevention purposes.</p>

          <h2 style={h2}>7. Your Rights</h2>
          <p style={p}>Depending on where you live, you may have rights to access, correct, delete, or receive a copy of your personal information, and to opt out of marketing communications. To exercise any of these rights, contact us using the details in Section 10.</p>

          <h2 style={h2}>8. Children&rsquo;s Privacy</h2>
          <p style={p}>The Services are not directed to, and we do not knowingly collect personal information from, anyone under 18, consistent with the eligibility requirement in our Terms and Conditions.</p>

          <h2 style={h2}>9. Security</h2>
          <p style={p}>We use reasonable technical and organizational measures to protect your information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security, particularly given the Beta status of the Services described in our Terms and Conditions.</p>

          <h2 style={h2}>10. Contact Us</h2>
          <p style={{ ...p, marginBottom: 0 }}>
            Questions about this Privacy Policy, or requests regarding your personal information, can be sent to <strong style={strong}>privacy@green-emblem.com</strong> or through our <a href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Contact page</a>.
          </p>

          <h2 style={h2}>11. Changes to This Policy</h2>
          <p style={{ ...p, marginBottom: 0 }}>We may update this Privacy Policy from time to time. Material changes will be indicated by a new effective date above.</p>

        </div>
      </main>
      <Footer />
    </>
  )
}
