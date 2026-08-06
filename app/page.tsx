import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileCheck2,
  FileSearch,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";

const documents = [
  "Payroll summary",
  "Quarterly tax filings",
  "General ledger",
  "Subcontractor certificates",
];

export default function Home() {
  return (
    <main className="marketing-shell">
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="AuditSentry home">
          <span className="brand-symbol"><ShieldCheck size={20} /></span>
          <span>AuditSentry</span>
        </Link>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
        </div>
        <Link className="button button--nav" href="/portal">
          Sign in <ArrowRight size={16} />
        </Link>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="trust-kicker"><Sparkles size={15} /> AI-assisted audit preparation</div>
          <h1>Turn your audit paperwork into one ready-to-send packet.</h1>
          <p>
            Securely upload your payroll, tax, and subcontractor records. AuditSentry
            finds what is missing, flags mismatches, and organizes the packet your
            workers&apos; compensation auditor expects.
          </p>
          <div className="hero-actions">
            <Link className="button button--primary" href="/portal">
              Start my audit <ArrowRight size={18} />
            </Link>
            <a className="button button--secondary" href="#how-it-works">See how it works</a>
          </div>
          <div className="hero-proof">
            <span><Check size={15} /> Private by default</span>
            <span><Check size={15} /> No spreadsheets to build</span>
            <span><Check size={15} /> Human review stays in control</span>
          </div>
        </div>

        <div className="packet-preview" aria-label="Audit packet preview">
          <div className="preview-topbar">
            <span><span className="pulse-dot" /> Audit workspace</span>
            <span className="secure-chip"><LockKeyhole size={13} /> Private</span>
          </div>
          <div className="preview-heading">
            <div>
              <small>HARBORVIEW ELECTRIC LLC</small>
              <h2>2025–2026 annual audit</h2>
            </div>
            <span className="score-badge"><strong>72</strong><small>ready</small></span>
          </div>
          <div className="progress-label"><span>Packet completeness</span><strong>7 of 10</strong></div>
          <div className="progress-track"><span /></div>
          <div className="preview-docs">
            {documents.map((document, index) => (
              <div className="preview-doc" key={document}>
                <span className={index < 3 ? "doc-icon doc-icon--done" : "doc-icon doc-icon--missing"}>
                  {index < 3 ? <FileCheck2 size={16} /> : <FileSearch size={16} />}
                </span>
                <span><strong>{document}</strong><small>{index < 3 ? "Verified and organized" : "Action needed"}</small></span>
                <span className={index < 3 ? "status status--ready" : "status status--missing"}>
                  {index < 3 ? "Ready" : "Missing"}
                </span>
              </div>
            ))}
          </div>
          <div className="preview-insight">
            <ScanSearch size={19} />
            <span><strong>1 mismatch found</strong><small>Quarterly wages differ from the payroll summary by $2,840.</small></span>
          </div>
        </div>
      </section>

      <section className="value-strip" aria-label="Product outcomes">
        <div><strong>10 min</strong><span>to start an audit</span></div>
        <div><strong>One place</strong><span>for every required record</span></div>
        <div><strong>Clear gaps</strong><span>before the auditor finds them</span></div>
        <div><strong>One packet</strong><span>ready to review and send</span></div>
      </section>

      <section className="process-section" id="how-it-works">
        <div className="section-intro">
          <span className="eyebrow">From scattered files to audit-ready</span>
          <h2>Three steps. No insurance expertise required.</h2>
          <p>AuditSentry translates a complicated document request into a guided checklist.</p>
        </div>
        <div className="step-grid">
          <article>
            <span className="step-number">01</span>
            <span className="step-icon"><UploadCloud size={22} /></span>
            <h3>Upload your records</h3>
            <p>Add payroll reports, tax filings, ledgers, and certificates to your private workspace.</p>
          </article>
          <article>
            <span className="step-number">02</span>
            <span className="step-icon"><ScanSearch size={22} /></span>
            <h3>See every gap</h3>
            <p>AI organizes the files, checks totals, and explains missing or inconsistent evidence.</p>
          </article>
          <article>
            <span className="step-number">03</span>
            <span className="step-icon"><FileCheck2 size={22} /></span>
            <h3>Download your packet</h3>
            <p>Review the results and export a clean, indexed package for your auditor.</p>
          </article>
        </div>
      </section>

      <section className="security-section" id="security">
        <div className="security-card">
          <div className="security-copy">
            <span className="eyebrow eyebrow--light">Your records stay yours</span>
            <h2>Built for documents that should never be emailed around.</h2>
            <p>
              Every audit lives behind sign-in, inside a user-owned workspace. File access is checked
              on the server, uploads are kept in private storage, and you control when records are deleted.
            </p>
            <div className="security-points">
              <span><BadgeCheck size={17} /> User-level access controls</span>
              <span><BadgeCheck size={17} /> Private file storage</span>
              <span><BadgeCheck size={17} /> Recorded account activity</span>
              <span><BadgeCheck size={17} /> Delete your data anytime</span>
            </div>
          </div>
          <div className="security-vault" aria-hidden="true">
            <div className="vault-ring vault-ring--outer" />
            <div className="vault-ring vault-ring--inner" />
            <div className="vault-lock"><LockKeyhole size={34} /></div>
            <span className="vault-label vault-label--one">Encrypted</span>
            <span className="vault-label vault-label--two">Private</span>
            <span className="vault-label vault-label--three">User-owned</span>
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div>
          <span className="eyebrow">Simple launch pricing</span>
          <h2>Pay for the audit you need to finish.</h2>
          <p>No annual contract. Your workspace remains free until you are ready to generate the final packet.</p>
        </div>
        <div className="price-card">
          <span>Audit packet</span>
          <strong>$129</strong>
          <small>per completed audit</small>
          <ul>
            <li><Check size={15} /> Secure document workspace</li>
            <li><Check size={15} /> AI gap and mismatch scan</li>
            <li><Check size={15} /> Indexed packet export</li>
          </ul>
          <Link className="button button--primary button--wide" href="/portal">Start securely <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer>
        <Link className="brand" href="/"><span className="brand-symbol"><ShieldCheck size={20} /></span><span>AuditSentry</span></Link>
        <p>AI-assisted preparation. Human review required before insurer submission.</p>
        <div><a href="#security">Security</a><a href="mailto:hello@auditsentry.com">Contact</a></div>
      </footer>
    </main>
  );
}
