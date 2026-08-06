export type NavigationId =
  | "overview"
  | "audit"
  | "subcontractors"
  | "documents"
  | "architecture";

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type DocumentStatus = "verified" | "review" | "missing" | "processing";
export type ContractorStatus = "covered" | "expiring" | "missing" | "mismatch";

export interface ClientAccount {
  id: string;
  name: string;
  initials: string;
  industry: string;
  employees: number;
  subcontractors: number;
  location: string;
}

export interface Policy {
  id: string;
  carrier: string;
  policyNumber: string;
  type: string;
  period: string;
  auditDeadline: string;
  estimatedPremium: number;
}

export interface Metric {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  level: RiskLevel;
  category: "COI" | "Payroll" | "Classification" | "Documentation";
  amount: number;
  source: string;
  sourceDetail: string;
  action: string;
  resolved: boolean;
}

export interface Subcontractor {
  id: string;
  name: string;
  trade: string;
  paid: number;
  status: ContractorStatus;
  coiNumber: string;
  coveragePeriod: string;
  lastChecked: string;
  risk: number;
}

export interface AuditDocument {
  id: string;
  name: string;
  category: string;
  status: DocumentStatus;
  updated: string;
  size: string;
  extractedFields: number;
}

export interface ReconciliationRow {
  source: string;
  amount: number;
  difference: number;
  status: "matched" | "explained" | "review";
  note: string;
}

export interface TaskItem {
  id: string;
  title: string;
  owner: string;
  due: string;
  completed: boolean;
  priority: "today" | "soon" | "normal";
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  time: string;
  type: "ai" | "person" | "system";
}
