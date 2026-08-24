import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const h2: React.CSSProperties = { fontFamily: 'var(--font-cinzel)', fontSize: '18px', fontWeight: 500, color: '#fff', marginTop: '38px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '0.5px solid rgba(212,175,110,0.2)' }
const p: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '14.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: '14px' }
const li: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '14.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: '8px' }
const strong: React.CSSProperties = { color: 'rgba(255,255,255,0.85)', fontWeight: 600 }

export const metadata = { title: 'Terms and Conditions' }

export default function TermsPage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px 100px' }}>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.28em', color: 'var(--gold)', marginBottom: '14px' }}>GREEN EMBLEM</div>
            <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Terms and Conditions</h1>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
              Version 0.3 (Beta) · Effective August 24, 2026
            </p>
          </div>

          <div style={{ background: 'rgba(212,175,110,0.06)', border: '0.5px solid rgba(212,175,110,0.3)', borderRadius: '12px', padding: '20px 22px', marginBottom: '30px' }}>
            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: '#e8b923', marginBottom: '8px' }}>IMPORTANT — READ BEFORE USING GREEN EMBLEM</div>
            <p style={{ ...p, marginBottom: 0, color: 'rgba(255,255,255,0.6)' }}>
              Green Emblem is currently in active development (<span style={strong}>&ldquo;Beta&rdquo;</span>). The Services are provided on an experimental, incomplete, and &ldquo;AS IS&rdquo; basis. Features may not work as intended, may change or be removed without notice, and may contain errors affecting donations, orders, payments, or account data. By using the Services during the Beta period, you acknowledge this status and agree to the terms below, including the limitations of liability and release of claims in Sections 13&ndash;15.
            </p>
          </div>

          <h2 style={h2}>1. Acceptance of Terms</h2>
          <p style={p}>These Terms and Conditions (&ldquo;Terms&rdquo;) form a binding agreement between you (&ldquo;you,&rdquo; &ldquo;User&rdquo;) and <strong style={strong}>Green Emblem LLC</strong>, a limited liability company (&ldquo;Green Emblem,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), governing your access to and use of the Green Emblem website, mobile experience, and related services, including Baab As-Sadaqah, GreenWorld+, GreenTV (including fitness content and our linked community Discord), Quran and Prayer &amp; Qibla tools, and the Islamic shop (collectively, the &ldquo;Services&rdquo;).</p>
          <p style={p}>By accessing or using the Services in any way — including browsing, creating an account, submitting a campaign request, placing an order, following a masjid, or subscribing to a channel — you accept these Terms in full. If you do not agree, you must not use the Services.</p>

          <h2 style={h2}>2. Beta / Pre-Release Status</h2>
          <p style={p}>Green Emblem is currently offered as a Beta product. This section applies in addition to, and does not limit, the disclaimers and limitations set out elsewhere in these Terms.</p>
          <ul style={{ paddingLeft: '20px', marginBottom: '14px' }}>
            <li style={li}>The Services are incomplete, under active development, and may be modified, suspended, or discontinued (in whole or in part) at any time without notice or liability.</li>
            <li style={li}>Features, pricing, availability, and functionality described on the site may not reflect what is actually delivered, and may change without prior notice.</li>
            <li style={li}>The Services may contain bugs, errors, or data-handling issues that could result in incorrect charges, failed or duplicated donations, lost account data, incorrect campaign pages, or other malfunctions.</li>
            <li style={li}>We do not guarantee uptime, data retention, or that any content, campaign, order, or account will be preserved, backed up, or recoverable.</li>
          </ul>
          <p style={p}>These Beta Terms remain in effect until Green Emblem publishes a revised or successor version of these Terms (a &ldquo;Terms Update&rdquo;), posted here with a new effective date. Continued use of the Services after a Terms Update takes effect constitutes your acceptance of the revised Terms.</p>

          <h2 style={h2}>3. Eligibility</h2>
          <p style={p}>You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account, place an order, or submit a campaign. By using the Services you represent that you meet this requirement.</p>

          <h2 style={h2}>4. Description of Services</h2>
          <p style={p}>Green Emblem is an events, giving, and community platform. Not all features may be available, complete, or fully functional at any given time during the Beta period.</p>

          <h2 style={h2}>5. Accounts and Registration</h2>
          <ul style={{ paddingLeft: '20px', marginBottom: '14px' }}>
            <li style={li}>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.</li>
            <li style={li}>You agree to provide accurate, current information and to update it as needed.</li>
            <li style={li}>We may suspend or terminate any account at our discretion, at any time, with or without notice.</li>
          </ul>

          <h2 style={h2}>6. Baab As-Sadaqah — Charitable Giving</h2>
          <ul style={{ paddingLeft: '20px', marginBottom: '14px' }}>
            <li style={li}>Green Emblem is not a charity, does not solicit donations on its own behalf, and does not receive, hold, or control any donated funds at any point.</li>
            <li style={li}>Any donation occurs directly with, and is processed entirely by, the third-party charity&rsquo;s own website, subject to that charity&rsquo;s own terms and receipt practices.</li>
            <li style={li}>Green Emblem does not guarantee that any donation will be completed, received, or applied as intended, and is not responsible for a charity&rsquo;s use of donated funds.</li>
            <li style={li}>Green Emblem makes no representation regarding tax-deductibility of any donation. Consult your own tax advisor.</li>
            <li style={li}>Campaign pages, QR codes, and donation statistics are estimates and may be inaccurate during the Beta period.</li>
          </ul>

          <h2 style={h2}>7. GreenWorld+ — Masjid Directory &amp; Events</h2>
          <p style={p}>Masjid and event listings on GreenWorld+ are provided for informational purposes and may be sourced from admin curation or automated extraction from a masjid&rsquo;s own public website. We do our best to ensure accuracy but do not guarantee that any listed masjid, event, date, or time is current or correct. Always confirm directly with the masjid before attending an event.</p>

          <h2 style={h2}>8. GreenTV — News, Fitness Content &amp; Community</h2>
          <p style={p}>GreenTV news content is curated and forwarded by our team from sources we consider credible. Green Emblem does not independently verify every underlying fact reported by a third-party source and is not responsible for the accuracy of third-party news content.</p>
          <p style={p}>Fitness and coaching content on GreenTV is for general informational and educational purposes only and is <strong style={strong}>not medical advice</strong>. Consult a physician before beginning any exercise program. You assume all risk of injury from following any fitness content on the Services.</p>
          <p style={p}>GreenTV includes a link to our community Discord server, operated on a third-party platform (Discord Inc.) subject to Discord&rsquo;s own terms of service. Green Emblem does not control, and is not responsible for, the conduct of other users, moderation decisions, or content posted on Discord. If we record or stream Discord discussions to GreenTV, participants will be notified before a session begins.</p>

          <h2 style={h2}>9. Quran Content</h2>
          <p style={p}>Arabic text, translations, and tafsir (commentary) displayed in the Quran feature are retrieved from third-party data sources and providers, not authored or verified by Green Emblem. While we select sources we consider reputable, translations and commentary inherently involve interpretation, and availability of any specific translation, script (including Indo-Pak), or tafsir may vary or change without notice. This feature is offered as a convenience for reading and reflection and is not a substitute for guidance from a qualified scholar on matters of interpretation or jurisprudence.</p>

          <h2 style={h2}>10. Shop Orders and Payments</h2>
          <ul style={{ paddingLeft: '20px', marginBottom: '14px' }}>
            <li style={li}>All prices, availability, and delivery estimates are subject to change without notice.</li>
            <li style={li}>We reserve the right to cancel, delay, or modify any order at our discretion.</li>
            <li style={li}>Payments are processed by a third-party payment processor (Stripe). Green Emblem is not responsible for errors or failures caused by that processor.</li>
            <li style={li}>Refunds, if any, are provided at Green Emblem&rsquo;s discretion unless otherwise required by law.</li>
          </ul>

          <h2 style={h2}>11. User Content and Conduct</h2>
          <p style={p}>You are solely responsible for content you submit through the Services, including campaign details, honouree names, and messages. By submitting content, you grant Green Emblem a non-exclusive, worldwide, royalty-free license to host and display it in connection with operating the Services. We may remove any content at our discretion.</p>

          <h2 style={h2}>12. Intellectual Property</h2>
          <p style={p}>All trademarks, logos, and content on the Services, other than user content and third-party marks, are owned by Green Emblem or its licensors. No rights are granted to you beyond the limited license needed to use the Services as intended.</p>

          <h2 style={h2}>13. Disclaimer of Warranties</h2>
          <p style={{ ...p, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. GREEN EMBLEM DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, PARTICULARLY DURING THE BETA PERIOD DESCRIBED IN SECTION 2.</p>
          <p style={p}>Some jurisdictions do not allow the exclusion of certain implied warranties, so some exclusions may not apply to you in full.</p>

          <h2 style={h2}>14. Limitation of Liability; Release of Claims</h2>
          <p style={{ ...p, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>TO THE MAXIMUM EXTENT PERMITTED BY LAW: GREEN EMBLEM SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICES. GREEN EMBLEM&rsquo;S TOTAL AGGREGATE LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID DIRECTLY TO GREEN EMBLEM IN THE SIX MONTHS PRECEDING THE CLAIM, OR (B) FIFTY U.S. DOLLARS ($50).</p>
          <p style={p}>To the maximum extent permitted by law, you voluntarily release Green Emblem from claims arising out of your use of the Services during the Beta period, including claims relating to platform errors, data loss, or donation-processing issues. This release does not apply to claims arising from fraud, gross negligence, or willful misconduct, which cannot be waived under applicable law.</p>

          <h2 style={h2}>15. Indemnification</h2>
          <p style={p}>You agree to indemnify and hold harmless Green Emblem from claims arising out of your use of the Services, your content, or your violation of these Terms or applicable law.</p>

          <h2 style={h2}>16. Privacy</h2>
          <p style={p}>Our collection and use of personal information is described in our <a href="/privacy" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Privacy Policy</a>. By using the Services, you consent to that collection and use.</p>

          <h2 style={h2}>17. Modifications</h2>
          <p style={p}>We may modify or discontinue any part of the Services, or revise these Terms, at any time. Material changes will be indicated by a new effective date above. Continued use after a revision takes effect constitutes acceptance.</p>

          <h2 style={h2}>18. Termination</h2>
          <p style={p}>We may suspend or terminate your access to the Services at any time, for any reason, with or without notice. Sections 6&ndash;16 and 18&ndash;20 survive termination.</p>

          <h2 style={h2}>19. Governing Law &amp; Dispute Resolution</h2>
          <p style={p}>These Terms are governed by the laws of the State of <strong style={strong}>New York</strong>, without regard to conflict-of-laws principles. Any dispute shall be resolved by binding, individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, except that either party may bring an individual claim in small-claims court if it qualifies. You and Green Emblem each waive any right to a jury trial and to participate in a class action.</p>

          <h2 style={h2}>20. Severability; Entire Agreement</h2>
          <p style={p}>If any provision is found unenforceable, the remaining provisions remain in full force. These Terms, together with our Privacy Policy, constitute the entire agreement between you and Green Emblem regarding the Services.</p>

          <h2 style={h2}>21. Contact</h2>
          <p style={{ ...p, marginBottom: 0 }}>Questions about these Terms can be directed to <strong style={strong}>legal@green-emblem.com</strong> or through our <a href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Contact page</a>.</p>

        </div>
      </main>
      <Footer />
    </>
  )
}
