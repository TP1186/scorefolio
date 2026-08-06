"use client";

import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CloudUpload,
  Database,
  Download,
  FileCheck2,
  FileSearch,
  Files,
  Filter,
  Info,
  Layers3,
  LayoutDashboard,
  Menu,
  Network,
  PackageCheck,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  activities,
  client,
  dataEntities,
  initialDocuments,
  initialFindings,
  initialTasks,
  metrics,
  policy,
  reconciliationRows,
  stackLayers,
  subcontractors,
} from "@/lib/demo-data";
import type {
  AuditDocument,
  ContractorStatus,
  DocumentStatus,
  Finding,
  NavigationId,
  RiskLevel,
} from "@/lib/types";

const navItems: Array<{
  id: NavigationId;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Command center", icon: LayoutDashboard },
  { id: "audit", label: "Audit workspace", icon: FileSearch },
  { id: "subcontractors", label: "Subcontractors", icon: Users },
  { id: "documents", label: "Documents", icon: Files },
  { id: "architecture", label: "Stack & data", icon: Layers3 },
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const levelLabel: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const contractorLabel: Record<ContractorStatus, string> = {
  covered: "Covered",
  expiring: "Coverage gap",
  missing: "Missing COI",
  mismatch: "Name mismatch",
};

const documentLabel: Record<DocumentStatus, string> = {
  verified: "Verified",
  review: "Needs review",
  missing: "Missing",
  processing: "Processing",
};

function ScoreRing({ score }: { score: number }) {
  const degrees = Math.round((score / 100) * 360);
  return (
    <div
      className="score-ring"
      style={{ "--score-degrees": `${degrees}deg` } as React.CSSProperties}
      aria-label={`Audit readiness score ${score} out of 100`}
    >
      <div className="score-ring__inner">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>
      {action ? <div className="section-heading__action">{action}</div> : null}
    </div>
  );
}

function FindingCard({
  finding,
  onSelect,
}: {
  finding: Finding;
  onSelect: (finding: Finding) => void;
}) {
  return (
    <button className="finding-card" onClick={() => onSelect(finding)}>
      <span className={`risk-marker risk-marker--${finding.level}`} aria-hidden="true" />
      <span className="finding-card__body">
        <span className="finding-card__meta">
          <StatusPill tone={finding.level}>{levelLabel[finding.level]}</StatusPill>
          <span>{finding.category}</span>
        </span>
        <strong>{finding.title}</strong>
        <span>{finding.sourceDetail}</span>
      </span>
      <span className="finding-card__amount">
        <strong>{money.format(finding.amount)}</strong>
        <small>potential</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="empty-state">
      <Search size={24} />
      <strong>No matches found</strong>
      <span>Nothing in this view matches “{query}”.</span>
    </div>
  );
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState<NavigationId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [findings, setFindings] = useState(initialFindings);
  const [documents, setDocuments] = useState(initialDocuments);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [packetOpen, setPacketOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState(
    "Evidence graph refreshed 12 minutes ago",
  );
  const uploadRef = useRef<HTMLInputElement>(null);

  const openFindings = findings.filter((finding) => !finding.resolved);
  const resolvedCount = findings.length - openFindings.length;
  const exposure = openFindings.reduce((sum, finding) => sum + finding.amount, 0);
  const score = Math.min(96, 72 + resolvedCount * 6);
  const completeness = Math.round(
    (documents.filter((document) => document.status === "verified").length /
      documents.length) *
      100,
  );

  const filteredFindings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return openFindings;
    return openFindings.filter((finding) =>
      `${finding.title} ${finding.description} ${finding.category} ${finding.source}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [openFindings, query]);

  const filteredSubs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return subcontractors;
    return subcontractors.filter((sub) =>
      `${sub.name} ${sub.trade} ${sub.status}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return documents;
    return documents.filter((document) =>
      `${document.name} ${document.category} ${document.status}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [documents, query]);

  function navigate(id: NavigationId) {
    setActiveView(id);
    setMobileNavOpen(false);
    setQuery("");
  }

  function resolveFinding(id: string) {
    setFindings((current) =>
      current.map((finding) =>
        finding.id === id ? { ...finding, resolved: true } : finding,
      ),
    );
    setSelectedFinding(null);
  }

  function toggleTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  function runReview() {
    setAnalyzing(true);
    setAnalysisMessage("Checking 1,791 extracted fields across 7 source documents…");
    window.setTimeout(() => {
      setAnalyzing(false);
      setAnalysisMessage("Review complete · no new material findings");
    }, 1500);
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const uploaded: AuditDocument = {
      id: `doc_uploaded_${Date.now()}`,
      name: file.name,
      category: "New upload",
      status: "processing",
      updated: "Just now",
      size: file.size > 1000000 ? `${(file.size / 1000000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB`,
      extractedFields: 0,
    };
    setDocuments((current) => [uploaded, ...current]);
    setActiveView("documents");
    window.setTimeout(() => {
      setDocuments((current) =>
        current.map((document) =>
          document.id === uploaded.id
            ? { ...document, status: "review", extractedFields: 12 }
            : document,
        ),
      );
    }, 1800);
    event.target.value = "";
  }

  function downloadPacket() {
    const packet = {
      generatedAt: new Date().toISOString(),
      prototypeNotice:
        "Synthetic proof-of-concept data. Human review is required before any insurer submission.",
      client,
      policy,
      readiness: { score, completeness, openFindings: openFindings.length, exposure },
      findings,
      subcontractors,
      documents,
      reconciliationRows,
    };
    const blob = new Blob([JSON.stringify(packet, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "summit-ridge-audit-packet-demo.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setPacketOpen(false);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar--open" : ""}`}>
        <div className="brand-lockup">
          <span className="brand-mark"><ShieldCheck size={20} /></span>
          <span><strong>AuditSentry</strong><small>Premium audit intelligence</small></span>
        </div>

        <div className="workspace-switcher">
          <span className="avatar avatar--agency">MC</span>
          <span><strong>Meridian Coverage</strong><small>Commercial lines team</small></span>
          <ChevronDown size={15} />
        </div>

        <nav aria-label="Primary navigation">
          <p>Workspace</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "audit" && openFindings.length ? (
                  <small className="nav-count">{openFindings.length}</small>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-insight">
          <Sparkles size={16} />
          <p><strong>Portfolio signal</strong><span>3 client audits are due within 30 days.</span></p>
          <ArrowRight size={15} />
        </div>

        <div className="sidebar-user">
          <span className="avatar">MC</span>
          <span><strong>Maya Chen</strong><small>Senior account manager</small></span>
          <ChevronDown size={15} />
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="client-identity">
              <span className="avatar avatar--client">{client.initials}</span>
              <span><strong>{client.name}</strong><small>{client.industry} · {client.location}</small></span>
              <ChevronDown size={15} />
            </div>
          </div>
          <div className="topbar__actions">
            <label className="search-box">
              <Search size={17} />
              <span className="sr-only">Search this workspace</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search records"
              />
              <kbd>⌘ K</kbd>
            </label>
            <input
              ref={uploadRef}
              type="file"
              className="sr-only"
              onChange={handleUpload}
              accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
            />
            <button className="button button--secondary" onClick={() => uploadRef.current?.click()}>
              <CloudUpload size={17} /> Upload
            </button>
            <button className="button button--primary" onClick={() => setPacketOpen(true)}>
              <PackageCheck size={17} /> Prepare packet
            </button>
          </div>
        </header>

        <div className="demo-banner">
          <Info size={15} />
          <span><strong>Interactive proof of concept.</strong> All company, policy and financial records are synthetic.</span>
        </div>

        <div className="content-area">
          {activeView === "overview" ? (
            <OverviewView
              score={score}
              exposure={exposure}
              findings={filteredFindings}
              tasks={tasks}
              query={query}
              onSelectFinding={setSelectedFinding}
              onToggleTask={toggleTask}
              onOpenAudit={() => navigate("audit")}
              onPreparePacket={() => setPacketOpen(true)}
            />
          ) : null}
          {activeView === "audit" ? (
            <AuditView
              score={score}
              completeness={completeness}
              exposure={exposure}
              findings={filteredFindings}
              query={query}
              analyzing={analyzing}
              analysisMessage={analysisMessage}
              onRunReview={runReview}
              onSelectFinding={setSelectedFinding}
              onPreparePacket={() => setPacketOpen(true)}
            />
          ) : null}
          {activeView === "subcontractors" ? (
            <SubcontractorsView contractors={filteredSubs} query={query} />
          ) : null}
          {activeView === "documents" ? (
            <DocumentsView
              documents={filteredDocuments}
              query={query}
              onUpload={() => uploadRef.current?.click()}
            />
          ) : null}
          {activeView === "architecture" ? <ArchitectureView /> : null}
        </div>
      </section>

      {selectedFinding ? (
        <FindingDrawer
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          onResolve={() => resolveFinding(selectedFinding.id)}
        />
      ) : null}

      {packetOpen ? (
        <PacketModal
          score={score}
          exposure={exposure}
          openFindings={openFindings.length}
          onClose={() => setPacketOpen(false)}
          onDownload={downloadPacket}
        />
      ) : null}
    </main>
  );
}

function OverviewView({
  score,
  exposure,
  findings,
  tasks,
  query,
  onSelectFinding,
  onToggleTask,
  onOpenAudit,
  onPreparePacket,
}: {
  score: number;
  exposure: number;
  findings: Finding[];
  tasks: typeof initialTasks;
  query: string;
  onSelectFinding: (finding: Finding) => void;
  onToggleTask: (id: string) => void;
  onOpenAudit: () => void;
  onPreparePacket: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="audit-hero">
        <div className="audit-hero__copy">
          <p className="eyebrow">Annual premium audit · {policy.type}</p>
          <h1>Know the exposure before the auditor does.</h1>
          <p>
            AuditSentry has reconciled the books, mapped subcontractor evidence and
            isolated the four items that need a human decision.
          </p>
          <div className="hero-actions">
            <button className="button button--primary" onClick={onOpenAudit}>
              Review open findings <ArrowRight size={17} />
            </button>
            <button className="button button--quiet" onClick={onPreparePacket}>
              Preview audit packet
            </button>
          </div>
        </div>
        <div className="audit-hero__deadline">
          <div className="deadline-topline">
            <span><CalendarDays size={16} /> Submission deadline</span>
            <StatusPill tone="warning">22 days</StatusPill>
          </div>
          <strong>{policy.auditDeadline}</strong>
          <span>{policy.carrier} · {policy.policyNumber}</span>
          <div className="deadline-track"><span style={{ width: "71%" }} /></div>
          <small>71% of the evidence package is submission-ready</small>
        </div>
      </section>

      <section className="signal-grid">
        <article className="score-card panel">
          <div>
            <p className="eyebrow">Audit readiness</p>
            <h2>{score >= 85 ? "Ready for final review" : "Material gaps remain"}</h2>
            <p>Resolving the two certificate issues has the largest effect on this score.</p>
          </div>
          <ScoreRing score={score} />
        </article>
        {metrics.map((metric, index) => (
          <article className="metric-card panel" key={metric.label}>
            <span className={`metric-icon metric-icon--${metric.tone}`}>
              {index === 0 ? <CheckCircle2 size={18} /> : index === 1 ? <Users size={18} /> : <ShieldAlert size={18} />}
            </span>
            <p>{metric.label}</p>
            <strong>{index === 2 ? money.format(exposure) : metric.value}</strong>
            <span>{index === 2 ? `${findings.length} findings require review` : metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="overview-columns">
        <div className="panel panel--padded risk-panel">
          <SectionHeading
            eyebrow="AI review queue"
            title="Open findings"
            detail="Every result is linked to its source evidence."
            action={<button className="text-button" onClick={onOpenAudit}>See workspace <ArrowRight size={15} /></button>}
          />
          <div className="finding-list">
            {findings.length ? findings.slice(0, 4).map((finding) => (
              <FindingCard key={finding.id} finding={finding} onSelect={onSelectFinding} />
            )) : <EmptyState query={query} />}
          </div>
        </div>

        <div className="side-stack">
          <div className="panel panel--padded task-panel">
            <SectionHeading title="Next actions" detail={`${tasks.filter((task) => !task.completed).length} remaining`} />
            <div className="task-list">
              {tasks.map((task) => (
                <label className={`task-row ${task.completed ? "task-row--done" : ""}`} key={task.id}>
                  <input type="checkbox" checked={task.completed} onChange={() => onToggleTask(task.id)} />
                  <span className="custom-check"><Check size={13} /></span>
                  <span><strong>{task.title}</strong><small>{task.owner} · {task.due}</small></span>
                </label>
              ))}
            </div>
          </div>

          <div className="panel panel--padded activity-panel">
            <SectionHeading title="Recent activity" />
            <div className="activity-list">
              {activities.slice(0, 3).map((item) => (
                <div className="activity-row" key={item.id}>
                  <span className={`activity-icon activity-icon--${item.type}`}>
                    {item.type === "ai" ? <Sparkles size={14} /> : item.type === "person" ? item.actor.split(" ").map((part) => part[0]).join("") : <Activity size={14} />}
                  </span>
                  <p><strong>{item.actor}</strong> {item.action}<small>{item.time}</small></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuditView({
  score,
  completeness,
  exposure,
  findings,
  query,
  analyzing,
  analysisMessage,
  onRunReview,
  onSelectFinding,
  onPreparePacket,
}: {
  score: number;
  completeness: number;
  exposure: number;
  findings: Finding[];
  query: string;
  analyzing: boolean;
  analysisMessage: string;
  onRunReview: () => void;
  onSelectFinding: (finding: Finding) => void;
  onPreparePacket: () => void;
}) {
  return (
    <div className="view-stack">
      <SectionHeading
        eyebrow="Policy period · Jul 2025–Jun 2026"
        title="Audit workspace"
        detail="Reconcile source totals, review exceptions and assemble the submission record."
        action={
          <button className="button button--primary" onClick={onPreparePacket}>
            <PackageCheck size={17} /> Prepare packet
          </button>
        }
      />

      <section className="audit-status-strip panel">
        <div><ScoreRing score={score} /><span><strong>Readiness</strong><small>Human-reviewed score</small></span></div>
        <div><strong>{completeness}%</strong><span><b>Evidence complete</b><small>5 of 7 required groups verified</small></span></div>
        <div><strong>{money.format(exposure)}</strong><span><b>Potential exposure</b><small>Illustrative, not a premium quote</small></span></div>
        <div><strong>{policy.auditDeadline}</strong><span><b>Submission deadline</b><small>22 calendar days remaining</small></span></div>
      </section>

      <section className="audit-grid">
        <div className="panel panel--padded reconciliation-panel">
          <SectionHeading
            eyebrow="Control total"
            title="Payroll reconciliation"
            detail="Sources are compared against the payroll register baseline."
          />
          <div className="reconciliation-table" role="table" aria-label="Payroll reconciliation">
            <div className="table-head" role="row">
              <span>Source</span><span>Total</span><span>Difference</span><span>Status</span>
            </div>
            {reconciliationRows.map((row) => (
              <div className="table-row" role="row" key={row.source}>
                <span><strong>{row.source}</strong><small>{row.note}</small></span>
                <span>{money.format(row.amount)}</span>
                <span className={row.difference ? "negative-number" : "muted-number"}>
                  {row.difference > 0 ? "+" : ""}{money.format(row.difference)}
                </span>
                <span><StatusPill tone={row.status}>{row.status === "matched" ? "Matched" : row.status === "explained" ? "Explained" : "Review"}</StatusPill></span>
              </div>
            ))}
          </div>
        </div>

        <div className={`panel panel--padded ai-control ${analyzing ? "ai-control--running" : ""}`}>
          <div className="ai-control__icon"><WandSparkles size={24} /></div>
          <p className="eyebrow">Evidence engine</p>
          <h2>{analyzing ? "Reviewing source evidence" : "AI review is current"}</h2>
          <p>{analysisMessage}</p>
          <div className="ai-checks">
            <span><CheckCircle2 size={15} /> Payroll cross-footed</span>
            <span><CheckCircle2 size={15} /> Vendor payments linked</span>
            <span><CheckCircle2 size={15} /> Coverage dates compared</span>
          </div>
          <button className="button button--secondary button--full" onClick={onRunReview} disabled={analyzing}>
            {analyzing ? <><span className="spinner" /> Running review…</> : <><Sparkles size={16} /> Run review again</>}
          </button>
        </div>
      </section>

      <section className="panel panel--padded">
        <SectionHeading
          eyebrow="Exception queue"
          title={`${findings.length} open findings`}
          detail="Exposure values are scenario estimates using demo assumptions."
          action={<button className="filter-button"><Filter size={15} /> All severities <ChevronDown size={14} /></button>}
        />
        <div className="finding-list finding-list--wide">
          {findings.length ? findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} onSelect={onSelectFinding} />
          )) : <EmptyState query={query} />}
        </div>
      </section>
    </div>
  );
}

function SubcontractorsView({
  contractors,
  query,
}: {
  contractors: typeof subcontractors;
  query: string;
}) {
  const covered = subcontractors.filter((sub) => sub.status === "covered").length;
  return (
    <div className="view-stack">
      <SectionHeading
        eyebrow="Vendor evidence"
        title="Subcontractor coverage"
        detail="Payments are matched to certificates covering the dates work was performed."
        action={<button className="button button--secondary"><Download size={16} /> Export register</button>}
      />

      <section className="compact-metrics">
        <article className="panel"><span><Users size={18} /></span><p>Total reviewed<strong>23</strong><small>$284,650 paid</small></p></article>
        <article className="panel"><span className="positive"><ShieldCheck size={18} /></span><p>Evidence matched<strong>{covered}/23</strong><small>91% coverage rate</small></p></article>
        <article className="panel"><span className="warning"><ShieldAlert size={18} /></span><p>Needs attention<strong>3</strong><small>$15,910 potential</small></p></article>
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar">
          <div><strong>Certificate register</strong><span>Last refreshed Aug 5, 2026 at 4:18 PM</span></div>
          <button className="filter-button"><Filter size={15} /> Filter <ChevronDown size={14} /></button>
        </div>
        {contractors.length ? (
          <div className="data-table" role="table" aria-label="Subcontractor coverage register">
            <div className="data-table__head" role="row">
              <span>Subcontractor</span><span>Paid in term</span><span>Certificate</span><span>Coverage period</span><span>Audit status</span><span />
            </div>
            {contractors.map((sub) => (
              <div className="data-table__row" role="row" key={sub.id}>
                <span className="entity-cell"><span className="entity-mark">{sub.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{sub.name}</strong><small>{sub.trade}</small></span></span>
                <span><strong>{money.format(sub.paid)}</strong><small>GL matched</small></span>
                <span><strong>{sub.coiNumber}</strong><small>Checked {sub.lastChecked}</small></span>
                <span>{sub.coveragePeriod}</span>
                <span><StatusPill tone={sub.status}>{contractorLabel[sub.status]}</StatusPill></span>
                <button className="icon-button" aria-label={`Open ${sub.name}`}><ChevronRight size={17} /></button>
              </div>
            ))}
          </div>
        ) : <EmptyState query={query} />}
      </section>
    </div>
  );
}

function DocumentsView({
  documents,
  query,
  onUpload,
}: {
  documents: AuditDocument[];
  query: string;
  onUpload: () => void;
}) {
  return (
    <div className="view-stack">
      <SectionHeading
        eyebrow="Source evidence"
        title="Document room"
        detail="Upload once; extract fields, preserve sources and reuse evidence across the audit."
        action={<button className="button button--primary" onClick={onUpload}><CloudUpload size={17} /> Upload document</button>}
      />

      <button className="upload-zone" onClick={onUpload}>
        <span><CloudUpload size={23} /></span>
        <strong>Drop audit documents here or browse</strong>
        <small>PDF, CSV, Excel, Word and image files · prototype processes locally</small>
      </button>

      <section className="panel data-panel">
        <div className="data-toolbar">
          <div><strong>Audit evidence</strong><span>{documents.length} records in this view</span></div>
          <button className="filter-button"><Filter size={15} /> Category <ChevronDown size={14} /></button>
        </div>
        {documents.length ? (
          <div className="document-list">
            {documents.map((document) => (
              <div className="document-row" key={document.id}>
                <span className="file-icon"><Files size={19} /></span>
                <span className="document-row__name"><strong>{document.name}</strong><small>{document.category} · {document.size}</small></span>
                <span className="document-row__fields"><strong>{document.extractedFields}</strong><small>fields extracted</small></span>
                <span><StatusPill tone={document.status}>{documentLabel[document.status]}</StatusPill></span>
                <span className="document-row__date">{document.updated}</span>
                <button className="icon-button" aria-label={`Open ${document.name}`}><ChevronRight size={17} /></button>
              </div>
            ))}
          </div>
        ) : <EmptyState query={query} />}
      </section>
    </div>
  );
}

function ArchitectureView() {
  return (
    <div className="view-stack architecture-view">
      <SectionHeading
        eyebrow="Implementation blueprint"
        title="Tech stack and product data"
        detail="The prototype uses seeded records; these are the production-ready boundaries for durable data and document storage."
      />

      <section className="architecture-hero panel panel--padded">
        <div>
          <span className="architecture-icon"><Network size={25} /></span>
          <p className="eyebrow">System principle</p>
          <h2>Evidence first. AI second. Human approval always.</h2>
          <p>
            Deterministic reconciliation and coverage-date checks create the evidence
            graph. AI explains exceptions and drafts follow-up actions, while the broker
            owns every classification and submission decision.
          </p>
        </div>
        <div className="pipeline" aria-label="Processing pipeline">
          <span><CloudUpload size={17} /> Source files</span><ArrowRight size={17} />
          <span><TableProperties size={17} /> Structured facts</span><ArrowRight size={17} />
          <span><Bot size={17} /> AI findings</span><ArrowRight size={17} />
          <span><FileCheck2 size={17} /> Reviewed packet</span>
        </div>
      </section>

      <section className="architecture-grid">
        <div className="panel panel--padded">
          <SectionHeading title="Recommended stack" detail="POC choices and production path" />
          <div className="stack-list">
            {stackLayers.map((item, index) => (
              <div className="stack-row" key={item.layer}>
                <span className="stack-number">{String(index + 1).padStart(2, "0")}</span>
                <span><small>{item.layer}</small><strong>{item.choice}</strong><p>{item.reason}</p></span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel panel--padded">
          <SectionHeading title="Core entities" detail="Relational records required for the first release" />
          <div className="entity-list">
            {dataEntities.map((item) => (
              <div className="entity-row" key={item.entity}>
                <span className="database-icon"><Database size={16} /></span>
                <span><strong>{item.entity}</strong><p>{item.purpose}</p></span>
                <code>{item.key}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel panel--padded governance-panel">
        <SectionHeading title="Data governance built into the model" />
        <div className="governance-grid">
          <article><ShieldCheck size={19} /><strong>Tenant isolation</strong><p>Every query is scoped through agency and client ownership.</p></article>
          <article><Archive size={19} /><strong>Immutable sources</strong><p>Original files remain intact; extractions are versioned separately.</p></article>
          <article><FileSearch size={19} /><strong>Evidence citations</strong><p>Every finding stores source document, page, field and rule provenance.</p></article>
          <article><Users size={19} /><strong>Human approvals</strong><p>Classifications and carrier-facing submissions require named reviewers.</p></article>
        </div>
      </section>
    </div>
  );
}

function FindingDrawer({
  finding,
  onClose,
  onResolve,
}: {
  finding: Finding;
  onClose: () => void;
  onResolve: () => void;
}) {
  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="finding-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finding-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div><StatusPill tone={finding.level}>{levelLabel[finding.level]} risk</StatusPill><span>{finding.category}</span></div>
          <button className="icon-button" aria-label="Close finding" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="drawer-body">
          <span className={`drawer-risk-icon drawer-risk-icon--${finding.level}`}><AlertTriangle size={23} /></span>
          <p className="eyebrow">Finding details</p>
          <h2 id="finding-title">{finding.title}</h2>
          <p className="drawer-description">{finding.description}</p>

          <div className="exposure-block">
            <span><CircleDollarSign size={18} /> Illustrative exposure</span>
            <strong>{money.format(finding.amount)}</strong>
            <small>Scenario estimate only · carrier calculation controls</small>
          </div>

          <div className="evidence-block">
            <p className="eyebrow">Evidence trail</p>
            <div><FileSearch size={17} /><span><strong>{finding.source}</strong><small>{finding.sourceDetail}</small></span></div>
          </div>

          <div className="recommended-action">
            <p className="eyebrow">Recommended next action</p>
            <p>{finding.action}</p>
          </div>

          <div className="ai-disclaimer">
            <Bot size={17} />
            <p><strong>Human review required.</strong> This POC organizes evidence and surfaces discrepancies; it does not provide legal, tax or binding insurance classification advice.</p>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="button button--secondary" onClick={onClose}>Keep open</button>
          <button className="button button--primary" onClick={onResolve}><Check size={17} /> Mark resolved</button>
        </div>
      </aside>
    </div>
  );
}

function PacketModal({
  score,
  exposure,
  openFindings,
  onClose,
  onDownload,
}: {
  score: number;
  exposure: number;
  openFindings: number;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="modal-layer modal-layer--center" role="presentation" onMouseDown={onClose}>
      <section
        className="packet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="packet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="packet-modal__top">
          <span className="packet-icon"><PackageCheck size={24} /></span>
          <button className="icon-button" aria-label="Close packet preview" onClick={onClose}><X size={19} /></button>
        </div>
        <p className="eyebrow">Submission preview</p>
        <h2 id="packet-title">Audit packet manifest</h2>
        <p>Review the current evidence state before generating the demonstration export.</p>

        <div className="packet-summary">
          <div><span>Readiness score</span><strong>{score}/100</strong></div>
          <div><span>Open findings</span><strong>{openFindings}</strong></div>
          <div><span>Potential exposure</span><strong>{money.format(exposure)}</strong></div>
        </div>

        <div className="packet-checklist">
          <p><CheckCircle2 size={17} /> Payroll and tax reconciliation</p>
          <p><CheckCircle2 size={17} /> Subcontractor payment register</p>
          <p><CheckCircle2 size={17} /> Certificate evidence index</p>
          <p><AlertTriangle size={17} /> Open-findings schedule included</p>
        </div>

        <div className="packet-warning"><Info size={16} />The download is a JSON prototype manifest using synthetic data, not an insurer-ready filing.</div>

        <div className="packet-actions">
          <button className="button button--secondary" onClick={onClose}>Continue reviewing</button>
          <button className="button button--primary" onClick={onDownload}><Download size={17} /> Download demo packet</button>
        </div>
      </section>
    </div>
  );
}
