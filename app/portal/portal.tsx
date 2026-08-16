"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Download,
  FileCheck2,
  FileSearch,
  Files,
  FolderLock,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  ScanSearch,
  Settings,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type View = "overview" | "documents" | "findings" | "packet" | "settings";
type StoredDocument = {
  id: string;
  auditId: string;
  filename: string;
  mimeType: string;
  size: number;
  category: string;
  status: string;
  statusReason: string | null;
  processedAt: number | null;
  createdAt: number;
};
type Workspace = {
  audit: {
    id: string;
    companyName: string;
    name: string;
    status: string;
    dueAt: number;
  };
  documents: StoredDocument[];
  activity: Array<{ id: string; event: string; detail: string; createdAt: number }>;
};

const requiredDocuments = [
  { category: "Payroll summary", note: "Payroll register or wage summary for the policy period" },
  { category: "Quarterly tax filings", note: "Federal 941s or state unemployment reports" },
  { category: "General ledger", note: "Account-level detail for labor and subcontractor expenses" },
  { category: "Subcontractor certificates", note: "Certificates of insurance covering work dates" },
  { category: "Policy documents", note: "Policy declarations and the carrier audit request" },
];

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "My audit", icon: LayoutDashboard },
  { id: "documents", label: "Documents", icon: Files },
  { id: "findings", label: "Gap scan", icon: ScanSearch },
  { id: "packet", label: "Audit packet", icon: PackageCheck },
  { id: "settings", label: "Data & security", icon: Settings },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "AS";
}

const documentStatusLabels: Record<string, string> = {
  uploaded: "Queued",
  scanning: "Scanning",
  extracting: "Extracting",
  ready: "Ready",
  needs_review: "Needs review",
  quarantined: "Quarantined",
  failed: "Failed",
};

export default function Portal({ initialUser }: { initialUser: { displayName: string; email: string } }) {
  const [activeView, setActiveView] = useState<View>("overview");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadWorkspace(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (!response.ok) throw new Error("Your private workspace could not be loaded.");
      const payload = await response.json() as Workspace;
      setWorkspace(payload);
      setCompanyName(payload.audit.companyName);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Your private workspace could not be loaded.");
        return response.json() as Promise<Workspace>;
      })
      .then((payload) => {
        if (!active) return;
        setWorkspace(payload);
        setCompanyName(payload.audit.companyName);
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Something went wrong.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const processing = workspace?.documents.some((document) => ["uploaded", "scanning", "extracting"].includes(document.status));
    if (!processing) return;
    const timer = window.setInterval(() => void loadWorkspace(false), 3000);
    return () => window.clearInterval(timer);
  }, [workspace?.documents]);

  const presentCategories = useMemo(
    () => new Set(workspace?.documents
      .filter((document) => !["quarantined", "failed"].includes(document.status))
      .map((document) => document.category) ?? []),
    [workspace?.documents],
  );
  const completeCount = requiredDocuments.filter((item) => presentCategories.has(item.category)).length;
  const readiness = Math.round((completeCount / requiredDocuments.length) * 80 + 12);
  const missingCount = requiredDocuments.length - completeCount;

  function navigate(view: View) {
    setActiveView(view);
    setNavOpen(false);
  }

  async function uploadFile(file: File) {
    if (!workspace) return;
    setUploading(true);
    setNotice(null);
    const form = new FormData();
    form.append("file", file);
    form.append("auditId", workspace.audit.id);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = await response.json() as { document?: StoredDocument; error?: string };
      if (!response.ok || !payload.document) throw new Error(payload.error ?? "Upload failed.");
      setWorkspace((current) => current ? {
        ...current,
        documents: [payload.document as StoredDocument, ...current.documents],
      } : current);
      setUploadOpen(false);
      setActiveView("documents");
      setNotice(`${payload.document.category} was queued for secure processing.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteDocument(document: StoredDocument) {
    if (!window.confirm(`Delete ${document.filename}? This cannot be undone.`)) return;
    const response = await fetch(`/api/uploads?id=${encodeURIComponent(document.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("That document could not be deleted.");
      return;
    }
    setWorkspace((current) => current ? {
      ...current,
      documents: current.documents.filter((item) => item.id !== document.id),
    } : current);
    setNotice("Document permanently deleted.");
  }

  async function updateCompany() {
    if (!workspace || !companyName.trim()) return;
    const response = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ auditId: workspace.audit.id, companyName }),
    });
    if (!response.ok) {
      setNotice("Business name could not be updated.");
      return;
    }
    setWorkspace((current) => current ? {
      ...current,
      audit: { ...current.audit, companyName: companyName.trim() },
    } : current);
    setNotice("Workspace details saved.");
  }

  async function deleteAllData() {
    if (!window.confirm("Permanently delete every document and audit in this account? This cannot be undone.")) return;
    const response = await fetch("/api/account-data", { method: "DELETE" });
    if (!response.ok) {
      setNotice("Your data could not be deleted.");
      return;
    }
    await loadWorkspace();
    setNotice("All prior audit data and uploaded files were permanently deleted.");
  }

  function downloadPacket() {
    if (!workspace) return;
    const packet = {
      generatedAt: new Date().toISOString(),
      status: missingCount ? "review_required" : "document_checklist_complete",
      audit: workspace.audit,
      checklist: requiredDocuments.map((item) => ({ ...item, received: presentCategories.has(item.category) })),
      documents: workspace.documents.map(({ id, filename, category, size, createdAt }) => ({ id, filename, category, size, createdAt })),
      disclaimer: "AI-assisted preparation. Review all records before insurer submission.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "auditsentry-audit-packet.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="portal-shell">
      <aside className={`portal-sidebar ${navOpen ? "portal-sidebar--open" : ""}`}>
        <Link className="brand brand--portal" href="/"><span className="brand-symbol"><ShieldCheck size={20} /></span><span>AuditSentry</span></Link>
        <div className="workspace-label"><span>PRIVATE WORKSPACE</span><strong>{workspace?.audit.companyName ?? "Loading workspace…"}</strong></div>
        <nav aria-label="Portal navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
                <Icon size={18} /><span>{item.label}</span>
                {item.id === "findings" && missingCount > 0 ? <small>{missingCount}</small> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-security"><LockKeyhole size={17} /><span><strong>Your files are private</strong><small>Access is checked on every request.</small></span></div>
        <div className="portal-user">
          <span className="user-avatar">{initials(initialUser.displayName)}</span>
          <span><strong>{initialUser.displayName}</strong><small>{initialUser.email}</small></span>
          <a href="/signout-with-chatgpt?return_to=%2F" aria-label="Sign out"><LogOut size={17} /></a>
        </div>
      </aside>

      {navOpen ? <button className="portal-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}

      <section className="portal-main">
        <header className="portal-topbar">
          <button className="icon-button portal-menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Audit workspace</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="topbar-secure"><ShieldCheck size={15} /> Signed in securely</div>
          <button className="button button--portal-primary" onClick={() => setUploadOpen(true)} disabled={!workspace}><Plus size={17} /> Add document</button>
        </header>

        <div className="privacy-banner"><FolderLock size={16} /><span><strong>Private account workspace.</strong> Only you can access these audit records.</span></div>

        <div className="portal-content">
          {notice ? <div className="notice"><CheckCircle2 size={17} /><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice(null)}><X size={15} /></button></div> : null}
          {loading ? (
            <div className="portal-loading"><LoaderCircle size={24} /><strong>Opening your private workspace</strong><span>Checking your account and audit records…</span></div>
          ) : null}

          {!loading && workspace && activeView === "overview" ? (
            <Overview
              workspace={workspace}
              readiness={readiness}
              completeCount={completeCount}
              missingCount={missingCount}
              presentCategories={presentCategories}
              onUpload={() => setUploadOpen(true)}
              onNavigate={navigate}
            />
          ) : null}
          {!loading && workspace && activeView === "documents" ? (
            <Documents documents={workspace.documents} onUpload={() => setUploadOpen(true)} onDelete={deleteDocument} />
          ) : null}
          {!loading && workspace && activeView === "findings" ? (
            <Findings presentCategories={presentCategories} onUpload={() => setUploadOpen(true)} />
          ) : null}
          {!loading && workspace && activeView === "packet" ? (
            <Packet workspace={workspace} readiness={readiness} missingCount={missingCount} onDownload={downloadPacket} onNavigate={navigate} />
          ) : null}
          {!loading && workspace && activeView === "settings" ? (
            <DataSettings
              user={initialUser}
              companyName={companyName}
              setCompanyName={setCompanyName}
              onSave={updateCompany}
              onDeleteAll={deleteAllData}
            />
          ) : null}
        </div>
      </section>

      {uploadOpen ? (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setUploadOpen(false)}>
          <div className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
            <div className="modal-top"><div><span className="modal-icon"><UploadCloud size={20} /></span><span><strong id="upload-title">Add an audit document</strong><small>It will be stored inside your private workspace.</small></span></div><button aria-label="Close" onClick={() => setUploadOpen(false)}><X size={18} /></button></div>
            <button className="dropzone" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <LoaderCircle className="spin" size={28} /> : <UploadCloud size={28} />}
              <strong>{uploading ? "Securing your upload…" : "Choose a file to upload"}</strong>
              <span>PDF, CSV, Excel, JPG, or PNG · 10 MB maximum</span>
            </button>
            <input ref={fileRef} className="sr-only" type="file" accept=".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png" onChange={(event) => event.target.files?.[0] && void uploadFile(event.target.files[0])} />
            <div className="upload-guardrails"><span><ShieldCheck size={15} /> Server-side ownership check</span><span><LockKeyhole size={15} /> Private object storage</span></div>
            <p className="upload-note"><AlertCircle size={14} /> Remove full Social Security numbers unless they are strictly required for your audit.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Overview({ workspace, readiness, completeCount, missingCount, presentCategories, onUpload, onNavigate }: {
  workspace: Workspace;
  readiness: number;
  completeCount: number;
  missingCount: number;
  presentCategories: Set<string>;
  onUpload: () => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="portal-stack">
      <section className="portal-welcome">
        <div><span className="eyebrow">Annual workers’ compensation audit</span><h1>Let’s get your audit packet ready.</h1><p>Add the requested records. AuditSentry will keep the checklist organized and show you what needs attention before submission.</p></div>
        <div className="due-card"><Clock3 size={17} /><span><small>ESTIMATED DUE DATE</small><strong>Due date on file</strong><span>{new Date(workspace.audit.dueAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></span></div>
      </section>
      <section className="portal-metrics">
        <article className="readiness-card"><div className="readiness-ring" style={{ "--readiness": `${readiness * 3.6}deg` } as React.CSSProperties}><span><strong>{readiness}</strong><small>/ 100</small></span></div><span><small>AUDIT READINESS</small><strong>{missingCount ? "Records still needed" : "Ready for human review"}</strong><p>Based on document completeness, not insurer approval.</p></span></article>
        <article><span className="metric-icon"><FileCheck2 size={19} /></span><span><small>CHECKLIST</small><strong>{completeCount} of {requiredDocuments.length}</strong><p>required categories received</p></span></article>
        <article><span className="metric-icon metric-icon--amber"><FileSearch size={19} /></span><span><small>OPEN GAPS</small><strong>{missingCount}</strong><p>items need your attention</p></span></article>
        <article><span className="metric-icon metric-icon--blue"><Files size={19} /></span><span><small>UPLOADED</small><strong>{workspace.documents.length}</strong><p>files in private storage</p></span></article>
      </section>
      <section className="portal-grid">
        <div className="portal-panel checklist-panel">
          <div className="panel-heading"><div><span className="eyebrow">Your document checklist</span><h2>What the auditor will need</h2></div><button className="text-button" onClick={() => onNavigate("documents")}>View documents <ArrowRight size={15} /></button></div>
          <div className="checklist-list">
            {requiredDocuments.map((item) => {
              const complete = presentCategories.has(item.category);
              return <div className="checklist-row" key={item.category}><span className={complete ? "check-state check-state--done" : "check-state"}>{complete ? <Check size={16} /> : <span />}</span><span><strong>{item.category}</strong><small>{item.note}</small></span><span className={complete ? "status status--ready" : "status status--missing"}>{complete ? "Received" : "Needed"}</span></div>;
            })}
          </div>
        </div>
        <div className="portal-side-stack">
          <div className="portal-panel upload-callout"><span className="upload-callout-icon"><UploadCloud size={24} /></span><h2>Add your first records</h2><p>Start with payroll and quarterly tax filings. Clear filenames help AuditSentry organize each upload.</p><button className="button button--portal-primary button--wide" onClick={onUpload}>Choose documents <ArrowRight size={16} /></button></div>
          <div className="portal-panel activity-card"><div className="panel-heading"><div><span className="eyebrow">Account activity</span><h2>Recent actions</h2></div><Activity size={18} /></div><div className="activity-list">{workspace.activity.slice(0, 4).map((item) => <div key={item.id}><span className="activity-dot" /><span><strong>{item.detail}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></span></div>)}</div></div>
        </div>
      </section>
    </div>
  );
}

function Documents({ documents, onUpload, onDelete }: { documents: StoredDocument[]; onUpload: () => void; onDelete: (document: StoredDocument) => void }) {
  return <div className="portal-stack"><div className="page-heading"><div><span className="eyebrow">Secure file room</span><h1>Your audit documents</h1><p>Every file listed here is tied to your signed-in account.</p></div><button className="button button--portal-primary" onClick={onUpload}><UploadCloud size={17} /> Add document</button></div><div className="portal-panel documents-panel">{documents.length ? <div className="document-table"><div className="document-head"><span>Document</span><span>Category</span><span>Size</span><span>Added</span><span /></div>{documents.map((document) => <div className="document-item" key={document.id}><span className="file-icon"><FileCheck2 size={18} /></span><span className="document-name"><strong>{document.filename}</strong><small>{document.mimeType}</small>{document.statusReason ? <small className="document-reason">{document.statusReason}</small> : null}</span><span className="document-category"><span>{document.category}</span><small className={`document-state document-state--${document.status}`}>{documentStatusLabels[document.status] ?? document.status}</small></span><span>{formatBytes(document.size)}</span><span>{new Date(document.createdAt).toLocaleDateString()}</span><button aria-label={`Delete ${document.filename}`} onClick={() => void onDelete(document)}><Trash2 size={16} /></button></div>)}</div> : <div className="empty-documents"><span><Files size={29} /></span><h2>No documents yet</h2><p>Your audit begins when you add the first record.</p><button className="button button--portal-primary" onClick={onUpload}><Plus size={17} /> Add your first document</button></div>}</div></div>;
}

function Findings({ presentCategories, onUpload }: { presentCategories: Set<string>; onUpload: () => void }) {
  const missing = requiredDocuments.filter((item) => !presentCategories.has(item.category));
  return <div className="portal-stack"><div className="page-heading"><div><span className="eyebrow">AI-assisted checklist review</span><h1>Gap scan</h1><p>Clear, prioritized actions based on the records currently in your workspace.</p></div><button className="button button--portal-primary" onClick={onUpload}><Plus size={17} /> Add evidence</button></div>{missing.length ? <div className="findings-list">{missing.map((item, index) => <article className="finding-row" key={item.category}><span className="finding-severity">{index === 0 ? "NEXT" : "OPEN"}</span><span className="finding-icon"><FileSearch size={19} /></span><span><strong>{item.category} is still missing</strong><p>{item.note}. Upload this record so it can be included in your final audit packet.</p><button onClick={onUpload}>Upload this evidence <ArrowRight size={14} /></button></span></article>)}</div> : <div className="portal-panel all-clear"><span><BadgeCheck size={31} /></span><h2>Your document checklist is complete</h2><p>No required document categories are missing. Review the packet before sending it to your auditor.</p></div>}<div className="analysis-disclaimer"><AlertCircle size={16} /><span><strong>About AI results</strong><p>AuditSentry helps organize and compare records. It does not provide legal, tax, or insurance advice, and every result requires human review.</p></span></div></div>;
}

function Packet({ workspace, readiness, missingCount, onDownload, onNavigate }: { workspace: Workspace; readiness: number; missingCount: number; onDownload: () => void; onNavigate: (view: View) => void }) {
  return <div className="portal-stack"><div className="page-heading"><div><span className="eyebrow">Final export</span><h1>Audit packet</h1><p>One organized index of your records and outstanding checklist items.</p></div><button className="button button--portal-primary" onClick={onDownload}><Download size={17} /> Download packet</button></div><div className="packet-layout"><div className="portal-panel packet-sheet"><div className="packet-cover"><span className="brand-symbol"><ShieldCheck size={20} /></span><span><small>AUDITSENTRY PREPARATION PACKET</small><h2>{workspace.audit.companyName}</h2><p>{workspace.audit.name}</p></span><span className={missingCount ? "packet-state packet-state--review" : "packet-state"}>{missingCount ? "REVIEW REQUIRED" : "CHECKLIST COMPLETE"}</span></div><div className="packet-score"><span><small>READINESS SCORE</small><strong>{readiness}<em>/100</em></strong></span><span><small>DOCUMENTS</small><strong>{workspace.documents.length}</strong></span><span><small>OPEN GAPS</small><strong>{missingCount}</strong></span></div><div className="packet-index"><span>PACKET INDEX</span>{requiredDocuments.map((item, index) => <div key={item.category}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.category}</strong><span className={workspace.documents.some((document) => document.category === item.category) ? "status status--ready" : "status status--missing"}>{workspace.documents.some((document) => document.category === item.category) ? "Included" : "Missing"}</span></div>)}</div></div><aside className="portal-panel packet-actions-card"><span className="packet-action-icon"><PackageCheck size={24} /></span><h2>{missingCount ? `${missingCount} gaps remain` : "Ready for final review"}</h2><p>{missingCount ? "You can export now, but the packet will clearly identify incomplete document categories." : "Review every file and total before insurer submission."}</p>{missingCount ? <button className="button button--secondary button--wide" onClick={() => onNavigate("findings")}>Review open gaps</button> : null}<button className="button button--portal-primary button--wide" onClick={onDownload}><Download size={16} /> Download index</button><small>The current export is a structured JSON packet index. PDF packaging and insurer-specific formatting are the next production integration.</small></aside></div></div>;
}

function DataSettings({ user, companyName, setCompanyName, onSave, onDeleteAll }: { user: { displayName: string; email: string }; companyName: string; setCompanyName: (value: string) => void; onSave: () => void; onDeleteAll: () => void }) {
  return <div className="portal-stack"><div className="page-heading"><div><span className="eyebrow">Account controls</span><h1>Data & security</h1><p>Manage your workspace identity, retention, and deletion controls.</p></div></div><div className="settings-grid"><div className="portal-panel settings-card"><div className="settings-title"><CircleUserRound size={20} /><span><strong>Workspace profile</strong><small>Your signed-in account owns this workspace.</small></span></div><label><span>Business name</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} maxLength={120} /></label><label><span>Account email</span><input value={user.email} disabled /></label><button className="button button--portal-primary" onClick={onSave}>Save changes</button></div><div className="portal-panel settings-card"><div className="settings-title"><ShieldCheck size={20} /><span><strong>Security controls</strong><small>Protection applied to your portal.</small></span></div><ul className="control-list"><li><CheckCircle2 size={16} /><span><strong>Authenticated access</strong><small>Sign-in is required before the portal loads.</small></span></li><li><CheckCircle2 size={16} /><span><strong>Server-side ownership</strong><small>Every read, upload, and delete verifies your user ID.</small></span></li><li><CheckCircle2 size={16} /><span><strong>Private file storage</strong><small>Uploaded objects are never assigned a public URL.</small></span></li><li><CheckCircle2 size={16} /><span><strong>Activity records</strong><small>Material workspace actions are logged.</small></span></li></ul></div><div className="portal-panel settings-card danger-card"><div className="settings-title"><Trash2 size={20} /><span><strong>Delete account data</strong><small>Permanently remove audits and uploaded files.</small></span></div><p>This action cannot be undone. A new empty workspace will be created if you return.</p><button className="button button--danger" onClick={onDeleteAll}>Delete all my audit data</button></div></div></div>;
}
