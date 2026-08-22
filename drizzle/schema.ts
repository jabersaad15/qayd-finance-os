import {
  boolean,
  date,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const createdAt = timestamp("createdAt").defaultNow().notNull();
const updatedAt = timestamp("updatedAt").defaultNow().onUpdateNow().notNull();

/** Platform identity is intentionally separate from any company-level role. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  username: varchar("username", { length: 80 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  mfaSecretEncrypted: varchar("mfaSecretEncrypted", { length: 512 }),
  mfaEnabled: boolean("mfaEnabled").default(false).notNull(),
  termsAcceptedVersion: varchar("termsAcceptedVersion", { length: 32 }),
  privacyAcceptedVersion: varchar("privacyAcceptedVersion", { length: 32 }),
  legalConsentAt: timestamp("legalConsentAt"),
  legalConsentIp: varchar("legalConsentIp", { length: 64 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt,
  updatedAt,
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  requestIp: varchar("requestIp", { length: 64 }),
  createdAt,
}, (table) => [index("password_reset_user_idx").on(table.userId, table.expiresAt), index("password_reset_expiry_idx").on(table.expiresAt)]);

export const tenantStatusValues = ["active", "suspended", "trial", "archived"] as const;
export const companyStatusValues = ["draft", "active", "suspended"] as const;
export const memberStatusValues = ["invited", "active", "disabled"] as const;
export const memberInvitationStatusValues = ["pending", "accepted", "revoked", "expired"] as const;
export const internalNotificationStatusValues = ["unread", "read"] as const;
export const documentStatusValues = ["draft", "pending_approval", "approved", "issued", "voided", "archived"] as const;
export const invoiceStatusValues = ["draft", "pending_approval", "approved", "zatca_processing", "cleared", "reported", "sent", "partially_paid", "paid", "overdue", "credit_note_issued", "rejected"] as const;
export const journalStatusValues = ["draft", "submitted", "approved", "posted", "reversed"] as const;
export const customerContractStatusValues = ["draft", "active", "expired", "terminated"] as const;
export const salesAttributionSourceValues = ["field_visit", "referral", "inbound", "partner", "existing_relationship", "other"] as const;
export const salesAttributionStatusValues = ["active", "released", "disputed"] as const;
export const salesVisitTypeValues = ["in_person", "phone", "email", "whatsapp", "meeting"] as const;
export const salesVisitStatusValues = ["planned", "completed", "cancelled"] as const;
export const salesCommissionBasisValues = ["contract_value", "invoice_paid"] as const;
export const salesCommissionStatusValues = ["pending", "approved", "paid", "cancelled"] as const;
export const customerAccountTierValues = ["standard", "large", "strategic"] as const;
export const approvalRequestStatusValues = ["pending", "approved", "rejected", "cancelled"] as const;
export const approvalCaseStatusValues = ["pending", "approved", "rejected", "returned", "information_required", "escalated", "completed", "cancelled"] as const;
export const approvalStepStatusValues = ["pending", "approved", "rejected", "returned", "information_required", "skipped"] as const;
export const approvalActionValues = ["approve", "reject", "return", "request_information", "delegate"] as const;
export const approvalWorkflowModeValues = ["sequential", "parallel"] as const;
export const approvalQuorumValues = ["any_one", "all"] as const;
export const administrativeTaskStatusValues = ["new", "in_progress", "waiting", "completed", "cancelled"] as const;
export const administrativePriorityValues = ["low", "normal", "high", "urgent"] as const;
export const administrativeMeetingStatusValues = ["planned", "held", "cancelled"] as const;
export const administrativeCorrespondenceTypeValues = ["letter", "email", "internal", "external", "circular"] as const;
export const administrativeCorrespondenceStatusValues = ["draft", "review", "approved", "sent", "closed"] as const;
export const administrativeRequestTypeValues = ["letter", "appointment", "meeting", "document", "visit", "contact", "file", "follow_up"] as const;
export const administrativeScopeValues = ["general", "department", "confidential", "executive"] as const;
export const portalTokenStatusValues = ["active", "revoked", "expired"] as const;
export const securityEventTypeValues = ["login_success", "login_failed", "logout", "password_changed", "password_reset_requested", "password_reset_completed", "mfa_enabled", "mfa_disabled", "session_revoked", "portal_access"] as const;
export const adminSupportAccessStatusValues = ["requested", "active", "expired", "revoked"] as const;
export const adminDataExportStatusValues = ["requested", "confirmed", "processing", "completed", "rejected", "cancelled"] as const;
export const onboardingStatusValues = ["active", "paused", "completed", "abandoned"] as const;
export const onboardingImportStatusValues = ["uploaded", "previewed", "validated", "imported", "failed", "cancelled"] as const;
export const zatcaEnvironmentValues = ["simulation", "production"] as const;
export const zatcaEgsStatusValues = ["draft", "onboarding", "active", "suspended", "retired"] as const;
export const zatcaSetupStatusValues = ["not_started", "pending", "issued", "failed", "expired"] as const;
export const zatcaConnectionStatusValues = ["not_configured", "connected", "degraded", "failed"] as const;
export const zatcaCredentialTypeValues = ["compliance_csid", "production_csid"] as const;
export const zatcaCredentialStatusValues = ["active", "expired", "revoked"] as const;

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  legalName: varchar("legalName", { length: 255 }).notNull(),
  status: mysqlEnum("status", tenantStatusValues).default("trial").notNull(),
  planCode: varchar("planCode", { length: 64 }).default("internal").notNull(),
  createdAt,
  updatedAt,
});

export const subscriptionPlanStatusValues = ["active", "archived"] as const;
export const subscriptionBillingCycleValues = ["monthly", "annual"] as const;
export const subscriptionStatusValues = ["trialing", "active", "past_due", "cancelled", "expired", "suspended"] as const;
export const subscriptionPlans = mysqlTable("subscriptionPlans", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  nameAr: varchar("nameAr", { length: 128 }).notNull(),
  nameEn: varchar("nameEn", { length: 128 }),
  descriptionAr: text("descriptionAr"),
  monthlyPrice: decimal("monthlyPrice", { precision: 18, scale: 2 }).default("0").notNull(),
  annualPrice: decimal("annualPrice", { precision: 18, scale: 2 }).default("0").notNull(),
  maxUsers: int("maxUsers"),
  maxInvoicesPerMonth: int("maxInvoicesPerMonth"),
  maxStorageMb: int("maxStorageMb"),
  trialDays: int("trialDays").default(14).notNull(),
  status: mysqlEnum("status", subscriptionPlanStatusValues).default("active").notNull(),
  createdAt,
  updatedAt,
});
export const subscriptionPlanEntitlements = mysqlTable("subscriptionPlanEntitlements", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => subscriptionPlans.id),
  featureCode: varchar("featureCode", { length: 120 }).notNull(),
  limitValue: int("limitValue"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("subscription_plan_feature_unique").on(table.planId, table.featureCode)]);
export const tenantSubscriptions = mysqlTable("tenantSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  planId: int("planId").notNull().references(() => subscriptionPlans.id),
  billingCycle: mysqlEnum("billingCycle", subscriptionBillingCycleValues).default("monthly").notNull(),
  status: mysqlEnum("status", subscriptionStatusValues).default("trialing").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  currentPeriodStartsAt: timestamp("currentPeriodStartsAt"),
  currentPeriodEndsAt: timestamp("currentPeriodEndsAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt,
  updatedAt,
}, (table) => [index("tenant_subscription_lookup_idx").on(table.tenantId, table.status), index("tenant_subscription_period_idx").on(table.tenantId, table.currentPeriodEndsAt)]);
export const tenantFeatureEntitlements = mysqlTable("tenantFeatureEntitlements", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  featureCode: varchar("featureCode", { length: 120 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  limitValue: int("limitValue"),
  source: varchar("source", { length: 32 }).default("plan").notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("tenant_feature_unique").on(table.tenantId, table.featureCode)]);
export const tenantUsageCounters = mysqlTable("tenantUsageCounters", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  featureCode: varchar("featureCode", { length: 120 }).notNull(),
  periodKey: varchar("periodKey", { length: 16 }).notNull(),
  usageValue: int("usageValue").default(0).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("tenant_usage_period_unique").on(table.tenantId, table.featureCode, table.periodKey)]);

export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  legalNameAr: varchar("legalNameAr", { length: 255 }).notNull(),
  legalNameEn: varchar("legalNameEn", { length: 255 }),
  commercialRegistration: varchar("commercialRegistration", { length: 64 }),
  unifiedNumber: varchar("unifiedNumber", { length: 64 }),
  vatNumber: varchar("vatNumber", { length: 32 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  countryCode: varchar("countryCode", { length: 2 }).default("SA").notNull(),
  city: varchar("city", { length: 128 }),
  nationalAddress: text("nationalAddress"),
  baseCurrency: varchar("baseCurrency", { length: 3 }).default("SAR").notNull(),
  fiscalYearStartMonth: int("fiscalYearStartMonth").default(1).notNull(),
  status: mysqlEnum("status", companyStatusValues).default("draft").notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("companies_tenant_idx").on(table.tenantId)]);

export const onboardingSessions = mysqlTable("onboardingSessions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  userId: int("userId").notNull().references(() => users.id),
  currentStep: varchar("currentStep", { length: 64 }).default("welcome").notNull(),
  status: mysqlEnum("status", onboardingStatusValues).default("active").notNull(),
  percent: int("percent").default(0).notNull(),
  answers: json("answers"),
  completedAt: timestamp("completedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("onboarding_session_scope_uq").on(table.tenantId, table.companyId), index("onboarding_session_user_idx").on(table.userId, table.status)]);

export const onboardingImportBatches = mysqlTable("onboardingImportBatches", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  userId: int("userId").notNull().references(() => users.id),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  sourceType: varchar("sourceType", { length: 32 }).notNull(),
  filename: varchar("filename", { length: 255 }),
  status: mysqlEnum("status", onboardingImportStatusValues).default("uploaded").notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  validRows: int("validRows").default(0).notNull(),
  errorCount: int("errorCount").default(0).notNull(),
  errorSummary: text("errorSummary"),
  payload: text("payload"),
  createdAt,
  updatedAt,
}, (table) => [index("onboarding_import_scope_idx").on(table.tenantId, table.companyId, table.status), index("onboarding_import_user_idx").on(table.userId, table.createdAt)]);

export const companyBranding = mysqlTable("companyBranding", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  displayNameAr: varchar("displayNameAr", { length: 255 }),
  displayNameEn: varchar("displayNameEn", { length: 255 }),
  logoUrl: text("logoUrl"),
  faviconUrl: text("faviconUrl"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#0B3D3A").notNull(),
  accentColor: varchar("accentColor", { length: 7 }).default("#4A82C4").notNull(),
  surfaceColor: varchar("surfaceColor", { length: 7 }).default("#F6F7F4").notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("company_branding_scope_uq").on(table.tenantId, table.companyId)]);

export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  code: varchar("code", { length: 32 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  vatNumber: varchar("vatNumber", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("branch_code_unique").on(table.tenantId, table.companyId, table.code)]);

export const appRoles = mysqlTable("appRoles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").references(() => tenants.id),
  code: varchar("code", { length: 64 }).notNull(),
  nameAr: varchar("nameAr", { length: 128 }).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("role_tenant_code_unique").on(table.tenantId, table.code)]);

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 120 }).notNull().unique(),
  module: varchar("module", { length: 64 }).notNull(),
  descriptionAr: varchar("descriptionAr", { length: 255 }).notNull(),
  createdAt,
  updatedAt,
});

export const rolePermissions = mysqlTable("rolePermissions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  roleId: int("roleId").notNull().references(() => appRoles.id),
  permissionId: int("permissionId").notNull().references(() => permissions.id),
  createdAt,
}, (table) => [uniqueIndex("role_permission_unique").on(table.tenantId, table.roleId, table.permissionId)]);

export const tenantUsers = mysqlTable("tenantUsers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  userId: int("userId").notNull().references(() => users.id),
  companyId: int("companyId").references(() => companies.id),
  roleId: int("roleId").references(() => appRoles.id),
  status: mysqlEnum("status", memberStatusValues).default("invited").notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("tenant_user_unique").on(table.tenantId, table.userId), index("tenant_users_user_idx").on(table.userId)]);

export const companyMemberInvitations = mysqlTable("companyMemberInvitations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  email: varchar("email", { length: 320 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  roleId: int("roleId").notNull().references(() => appRoles.id),
  status: mysqlEnum("status", memberInvitationStatusValues).default("pending").notNull(),
  invitedByUserId: int("invitedByUserId").notNull().references(() => users.id),
  acceptedByUserId: int("acceptedByUserId").references(() => users.id),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("company_member_invitation_unique").on(table.tenantId, table.companyId, table.email), index("company_member_invitation_status_idx").on(table.companyId, table.status)]);

export const administrativeTasks = mysqlTable("administrativeTasks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", administrativeTaskStatusValues).default("new").notNull(),
  priority: mysqlEnum("priority", administrativePriorityValues).default("normal").notNull(),
  dueDate: date("dueDate"),
  assignedToUserId: int("assignedToUserId").notNull().references(() => users.id),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  relatedEntityType: varchar("relatedEntityType", { length: 64 }),
  relatedEntityId: int("relatedEntityId"),
  notes: text("notes"),
  createdAt,
  updatedAt,
}, (table) => [index("admin_tasks_scope_idx").on(table.tenantId, table.companyId, table.assignedToUserId, table.status, table.dueDate)]);

export const administrativeMeetings = mysqlTable("administrativeMeetings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  meetingDate: date("meetingDate").notNull(),
  startTime: varchar("startTime", { length: 8 }),
  endTime: varchar("endTime", { length: 8 }),
  location: varchar("location", { length: 512 }),
  agenda: text("agenda"),
  minutes: text("minutes"),
  status: mysqlEnum("status", administrativeMeetingStatusValues).default("planned").notNull(),
  organizerUserId: int("organizerUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("admin_meetings_scope_idx").on(table.tenantId, table.companyId, table.meetingDate, table.status)]);

export const administrativeCorrespondence = mysqlTable("administrativeCorrespondence", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  counterparty: varchar("counterparty", { length: 255 }),
  contactName: varchar("contactName", { length: 255 }),
  correspondenceType: mysqlEnum("correspondenceType", administrativeCorrespondenceTypeValues).default("internal").notNull(),
  status: mysqlEnum("status", administrativeCorrespondenceStatusValues).default("draft").notNull(),
  assignedToUserId: int("assignedToUserId").notNull().references(() => users.id),
  followUpDate: date("followUpDate"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("admin_correspondence_scope_idx").on(table.tenantId, table.companyId, table.status, table.followUpDate, table.assignedToUserId)]);

export const administrativeRequests = mysqlTable("administrativeRequests", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  requestType: mysqlEnum("requestType", administrativeRequestTypeValues).notNull(),
  description: text("description").notNull(),
  priority: mysqlEnum("priority", administrativePriorityValues).default("normal").notNull(),
  deadline: date("deadline"),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id),
  assignedToUserId: int("assignedToUserId").references(() => users.id),
  status: mysqlEnum("status", administrativeTaskStatusValues).default("new").notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("admin_requests_scope_idx").on(table.tenantId, table.companyId, table.status, table.deadline, table.assignedToUserId)]);

export const operationalPriorityValues = ["low", "normal", "high", "critical"] as const;
export const operationalTaskStatusValues = ["new", "assigned", "in_progress", "waiting", "blocked", "escalated", "completed", "cancelled"] as const;
export const operationalIssueStatusValues = ["new", "assigned", "investigation", "action_required", "resolved", "closed"] as const;
export const operationalSeverityValues = ["low", "medium", "high", "critical"] as const;
export const operationalRequestStatusValues = ["request", "review", "assigned", "in_progress", "completed", "cancelled"] as const;

export const operationalTasks = mysqlTable("operationalTasks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", operationalTaskStatusValues).default("new").notNull(),
  priority: mysqlEnum("priority", operationalPriorityValues).default("normal").notNull(),
  department: varchar("department", { length: 128 }),
  branchId: int("branchId").references(() => branches.id),
  assignedToUserId: int("assignedToUserId").references(() => users.id),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  dueAt: timestamp("dueAt"),
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().notNull(),
  escalationReason: text("escalationReason"),
  instructions: text("instructions"),
  createdAt,
  updatedAt,
}, (table) => [index("operational_tasks_scope_idx").on(table.tenantId, table.companyId, table.status, table.priority, table.department, table.branchId, table.dueAt)]);

export const operationalIssues = mysqlTable("operationalIssues", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", operationalIssueStatusValues).default("new").notNull(),
  severity: mysqlEnum("severity", operationalSeverityValues).default("medium").notNull(),
  department: varchar("department", { length: 128 }),
  branchId: int("branchId").references(() => branches.id),
  assignedToUserId: int("assignedToUserId").references(() => users.id),
  discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
  resolutionDueAt: timestamp("resolutionDueAt"),
  rootCause: text("rootCause"),
  immediateAction: text("immediateAction"),
  correctiveAction: text("correctiveAction"),
  preventiveAction: text("preventiveAction"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("operational_issues_scope_idx").on(table.tenantId, table.companyId, table.status, table.severity, table.department, table.branchId, table.resolutionDueAt)]);

export const operationalCorrectiveActions = mysqlTable("operationalCorrectiveActions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  issueId: int("issueId").notNull().references(() => operationalIssues.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assignedToUserId: int("assignedToUserId").references(() => users.id),
  dueAt: timestamp("dueAt"),
  status: mysqlEnum("status", ["open", "in_progress", "completed", "verified"] as const).default("open").notNull(),
  verifiedByUserId: int("verifiedByUserId").references(() => users.id),
  verifiedAt: timestamp("verifiedAt"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("operational_corrective_actions_scope_idx").on(table.tenantId, table.companyId, table.issueId, table.status, table.dueAt)]);

export const operationalRequests = mysqlTable("operationalRequests", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  requestType: varchar("requestType", { length: 64 }).notNull(),
  description: text("description").notNull(),
  priority: mysqlEnum("priority", operationalPriorityValues).default("normal").notNull(),
  status: mysqlEnum("status", operationalRequestStatusValues).default("request").notNull(),
  department: varchar("department", { length: 128 }),
  branchId: int("branchId").references(() => branches.id),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id),
  assignedToUserId: int("assignedToUserId").references(() => users.id),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  approvedByUserId: int("approvedByUserId").references(() => users.id),
  dueAt: timestamp("dueAt"),
  createdAt,
  updatedAt,
}, (table) => [index("operational_requests_scope_idx").on(table.tenantId, table.companyId, table.status, table.priority, table.department, table.branchId, table.dueAt)]);

export const operationalKpis = mysqlTable("operationalKpis", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  code: varchar("code", { length: 64 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  targetValue: decimal("targetValue", { precision: 18, scale: 6 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("operational_kpi_scope_code_unique").on(table.tenantId, table.companyId, table.code)]);

export const operationalSlaPolicies = mysqlTable("operationalSlaPolicies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  priority: mysqlEnum("priority", operationalPriorityValues).notNull(),
  responseMinutes: int("responseMinutes").notNull(),
  resolutionMinutes: int("resolutionMinutes").notNull(),
  department: varchar("department", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("operational_sla_scope_unique").on(table.tenantId, table.companyId, table.priority, table.department)]);

export const administrativeDocuments = mysqlTable("administrativeDocuments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  documentId: int("documentId").notNull().references(() => documents.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  accessScope: mysqlEnum("accessScope", administrativeScopeValues).default("general").notNull(),
  department: varchar("department", { length: 128 }),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("admin_documents_scope_idx").on(table.tenantId, table.companyId, table.accessScope, table.department, table.createdAt), uniqueIndex("admin_documents_document_unique").on(table.documentId)]);

export const administrativeReminders = mysqlTable("administrativeReminders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  priority: mysqlEnum("priority", administrativePriorityValues).default("normal").notNull(),
  assignedToUserId: int("assignedToUserId").notNull().references(() => users.id),
  relatedEntityType: varchar("relatedEntityType", { length: 64 }),
  relatedEntityId: int("relatedEntityId"),
  status: mysqlEnum("status", ["open", "completed", "cancelled"] as const).default("open").notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("admin_reminders_scope_idx").on(table.tenantId, table.companyId, table.assignedToUserId, table.status, table.dueAt)]);

export const administrativeActivityTimeline = mysqlTable("administrativeActivityTimeline", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  description: text("description").notNull(),
  actorUserId: int("actorUserId").notNull().references(() => users.id),
  createdAt,
}, (table) => [index("admin_timeline_entity_idx").on(table.tenantId, table.companyId, table.entityType, table.entityId, table.createdAt)]);

export const internalNotifications = mysqlTable("internalNotifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  recipientUserId: int("recipientUserId").references(() => users.id),
  eventType: varchar("eventType", { length: 120 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }).notNull(),
  bodyAr: text("bodyAr").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  status: mysqlEnum("status", internalNotificationStatusValues).default("unread").notNull(),
  readAt: timestamp("readAt"),
  createdAt,
  updatedAt,
}, (table) => [index("internal_notification_company_status_idx").on(table.companyId, table.status), index("internal_notification_recipient_status_idx").on(table.recipientUserId, table.status)]);

export const approvalPolicies = mysqlTable("approvalPolicies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  documentType: varchar("documentType", { length: 64 }).notNull(),
  minAmount: decimal("minAmount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  requiredPermission: varchar("requiredPermission", { length: 120 }).notNull(),
  preventSelfApproval: boolean("preventSelfApproval").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("approval_policy_scope_idx").on(table.tenantId, table.companyId, table.documentType)]);

export const approvalRequests = mysqlTable("approvalRequests", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  documentType: varchar("documentType", { length: 64 }).notNull(),
  documentId: int("documentId").notNull(),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id),
  decidedByUserId: int("decidedByUserId").references(() => users.id),
  status: mysqlEnum("status", approvalRequestStatusValues).default("pending").notNull(),
  amount: decimal("amount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  reason: text("reason"),
  decisionNote: text("decisionNote"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  decidedAt: timestamp("decidedAt"),
  createdAt,
  updatedAt,
}, (table) => [index("approval_request_scope_idx").on(table.tenantId, table.companyId, table.documentType, table.documentId, table.status)]);

export const approvalCases = mysqlTable("approvalCases", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  requestType: varchar("requestType", { length: 96 }).notNull(),
  module: varchar("module", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 96 }).notNull(),
  entityId: int("entityId"),
  requestNumber: varchar("requestNumber", { length: 64 }).notNull(),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id),
  department: varchar("department", { length: 128 }),
  branchId: int("branchId").references(() => branches.id),
  amount: decimal("amount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  reason: text("reason").notNull(),
  priority: mysqlEnum("priority", administrativePriorityValues).default("normal").notNull(),
  deadline: date("deadline"),
  dueAt: timestamp("dueAt"),
  riskLevel: varchar("riskLevel", { length: 32 }),
  workflowMode: mysqlEnum("workflowMode", approvalWorkflowModeValues).default("sequential").notNull(),
  quorum: mysqlEnum("quorum", approvalQuorumValues).default("all").notNull(),
  currentStep: int("currentStep").default(1).notNull(),
  status: mysqlEnum("status", approvalCaseStatusValues).default("pending").notNull(),
  metadata: json("metadata"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("approval_case_number_unique").on(table.tenantId, table.companyId, table.requestNumber), index("approval_case_scope_idx").on(table.tenantId, table.companyId, table.status, table.requestedByUserId, table.module)]);

export const approvalCaseSteps = mysqlTable("approvalCaseSteps", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().references(() => approvalCases.id),
  sequence: int("sequence").notNull(),
  stageKey: varchar("stageKey", { length: 64 }).notNull(),
  roleCode: varchar("roleCode", { length: 64 }),
  assignedUserId: int("assignedUserId").references(() => users.id),
  status: mysqlEnum("status", approvalStepStatusValues).default("pending").notNull(),
  requiredApprovals: int("requiredApprovals").default(1).notNull(),
  approvedCount: int("approvedCount").default(0).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("approval_case_step_unique").on(table.caseId, table.sequence), index("approval_case_step_actor_idx").on(table.assignedUserId, table.status)]);

export const approvalCaseActions = mysqlTable("approvalCaseActions", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().references(() => approvalCases.id),
  stepId: int("stepId").references(() => approvalCaseSteps.id),
  actorUserId: int("actorUserId").notNull().references(() => users.id),
  action: mysqlEnum("action", approvalActionValues).notNull(),
  note: text("note"),
  createdAt,
}, (table) => [index("approval_case_action_scope_idx").on(table.caseId, table.createdAt, table.actorUserId)]);

export const approvalCaseAttachments = mysqlTable("approvalCaseAttachments", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().references(() => approvalCases.id),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  uploadedByUserId: int("uploadedByUserId").notNull().references(() => users.id),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  fileSize: int("fileSize").notNull(),
  createdAt,
}, (table) => [index("approval_attachment_scope_idx").on(table.caseId, table.tenantId, table.companyId), index("approval_attachment_uploader_idx").on(table.uploadedByUserId, table.createdAt)]);

export const centralApprovalPolicies = mysqlTable("centralApprovalPolicies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  requestType: varchar("requestType", { length: 96 }).notNull(),
  module: varchar("module", { length: 64 }).notNull(),
  minAmount: decimal("minAmount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  maxAmount: decimal("maxAmount", { precision: 18, scale: 6 }),
  department: varchar("department", { length: 128 }),
  branchId: int("branchId").references(() => branches.id),
  roleCode: varchar("roleCode", { length: 64 }),
  riskLevel: varchar("riskLevel", { length: 32 }),
  workflowMode: mysqlEnum("workflowMode", approvalWorkflowModeValues).default("sequential").notNull(),
  quorum: mysqlEnum("quorum", approvalQuorumValues).default("all").notNull(),
  steps: json("steps").notNull(),
  requiresStepUp: boolean("requiresStepUp").default(false).notNull(),
  slaHours: int("slaHours"),
  escalationAfterHours: int("escalationAfterHours"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("central_approval_policy_scope_idx").on(table.tenantId, table.companyId, table.requestType, table.module, table.isActive)]);

export const approvalDelegations = mysqlTable("approvalDelegations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  delegatorUserId: int("delegatorUserId").notNull().references(() => users.id),
  delegateeUserId: int("delegateeUserId").notNull().references(() => users.id),
  requestTypes: json("requestTypes").notNull(),
  maxAmount: decimal("maxAmount", { precision: 18, scale: 6 }),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  reason: text("reason"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("approval_delegation_scope_idx").on(table.tenantId, table.companyId, table.delegatorUserId, table.delegateeUserId, table.startsAt, table.endsAt)]);

export const customerPortalTokens = mysqlTable("customerPortalTokens", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", portalTokenStatusValues).default("active").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("customer_portal_scope_idx").on(table.tenantId, table.companyId, table.customerId, table.status)]);

export const customerPortalEvents = mysqlTable("customerPortalEvents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  tokenId: int("tokenId").notNull().references(() => customerPortalTokens.id),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: int("entityId"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt,
}, (table) => [index("customer_portal_events_scope_idx").on(table.tenantId, table.companyId, table.customerId, table.createdAt)]);

export const adminSupportAccessGrants = mysqlTable("adminSupportAccessGrants", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  grantedByUserId: int("grantedByUserId").notNull().references(() => users.id),
  supportUserId: int("supportUserId").references(() => users.id),
  scopeCode: varchar("scopeCode", { length: 120 }).notNull(),
  reason: text("reason").notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  status: mysqlEnum("status", adminSupportAccessStatusValues).default("requested").notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt,
  updatedAt,
}, (table) => [index("admin_support_scope_idx").on(table.tenantId, table.companyId, table.status), index("admin_support_expiry_idx").on(table.endsAt)]);

export const adminDataExportRequests = mysqlTable("adminDataExportRequests", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id),
  scopeCode: varchar("scopeCode", { length: 120 }).notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", adminDataExportStatusValues).default("requested").notNull(),
  confirmedAt: timestamp("confirmedAt"),
  completedAt: timestamp("completedAt"),
  resultReference: text("resultReference"),
  createdAt,
  updatedAt,
}, (table) => [index("admin_export_scope_idx").on(table.tenantId, table.companyId, table.status)]);

export const securityEvents = mysqlTable("securityEvents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").references(() => tenants.id),
  companyId: int("companyId").references(() => companies.id),
  userId: int("userId").references(() => users.id),
  eventType: mysqlEnum("eventType", securityEventTypeValues).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 512 }),
  metadata: json("metadata"),
  createdAt,
}, (table) => [index("security_events_user_idx").on(table.userId, table.createdAt), index("security_events_scope_idx").on(table.tenantId, table.companyId, table.createdAt)]);

export const fiscalPeriods = mysqlTable("fiscalPeriods", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  name: varchar("name", { length: 64 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  status: mysqlEnum("status", ["open", "soft_locked", "hard_locked"]).default("open").notNull(),
  lockedByUserId: int("lockedByUserId").references(() => users.id),
  lockedAt: timestamp("lockedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("period_tenant_company_name_unique").on(table.tenantId, table.companyId, table.name)]);

export const documentNumberingRules = mysqlTable("documentNumberingRules", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  branchId: int("branchId").references(() => branches.id),
  documentType: mysqlEnum("documentType", ["invoice", "quotation", "credit_note", "debit_note", "journal", "payment"]).notNull(),
  prefix: varchar("prefix", { length: 24 }).notNull(),
  nextNumber: int("nextNumber").default(1).notNull(),
  padding: int("padding").default(6).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("numbering_rule_scope_unique").on(table.tenantId, table.companyId, table.branchId, table.documentType)]);

export const taxProfiles = mysqlTable("taxProfiles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  taxType: mysqlEnum("taxType", ["vat", "zakat"]).notNull(),
  registrationNumber: varchar("registrationNumber", { length: 64 }),
  defaultRateBps: int("defaultRateBps").default(1500).notNull(),
  filingFrequency: mysqlEnum("filingFrequency", ["monthly", "quarterly", "annual"]).default("quarterly").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("tax_profile_scope_unique").on(table.tenantId, table.companyId, table.taxType)]);

export const taxPeriods = mysqlTable("taxPeriods", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  taxProfileId: int("taxProfileId").notNull().references(() => taxProfiles.id),
  name: varchar("name", { length: 64 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  status: mysqlEnum("status", ["open", "prepared", "filed", "locked"]).default("open").notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("tax_period_scope_unique").on(table.tenantId, table.companyId, table.taxProfileId, table.name)]);

export const vatReturnPreparations = mysqlTable("vatReturnPreparations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  taxPeriodId: int("taxPeriodId").notNull().references(() => taxPeriods.id),
  status: mysqlEnum("status", ["draft", "under_review", "reviewed"]).default("draft").notNull(),
  taxableSales: decimal("taxableSales", { precision: 18, scale: 6 }).default("0").notNull(),
  outputVat: decimal("outputVat", { precision: 18, scale: 6 }).default("0").notNull(),
  inputVat: decimal("inputVat", { precision: 18, scale: 6 }).default("0").notNull(),
  netVatDue: decimal("netVatDue", { precision: 18, scale: 6 }).default("0").notNull(),
  reviewNotes: text("reviewNotes"),
  preparedByUserId: int("preparedByUserId").notNull().references(() => users.id),
  reviewedByUserId: int("reviewedByUserId").references(() => users.id),
  reviewedAt: timestamp("reviewedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("vat_return_period_unique").on(table.tenantId, table.companyId, table.taxPeriodId), index("vat_return_status_idx").on(table.tenantId, table.companyId, table.status)]);

export const invoicingPreferences = mysqlTable("invoicingPreferences", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  defaultPaymentTermsDays: int("defaultPaymentTermsDays").default(30).notNull(),
  defaultInvoiceType: mysqlEnum("defaultInvoiceType", ["standard", "simplified"]).default("standard").notNull(),
  footerNoteAr: text("footerNoteAr"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("invoicing_preferences_company_unique").on(table.tenantId, table.companyId)]);

export const costCenters = mysqlTable("costCenters", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  parentId: int("parentId"),
  code: varchar("code", { length: 32 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("cost_center_code_unique").on(table.tenantId, table.companyId, table.code)]);

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  code: varchar("code", { length: 48 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["active", "on_hold", "closed"]).default("active").notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("project_code_unique").on(table.tenantId, table.companyId, table.code)]);

export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  parentId: int("parentId"),
  code: varchar("code", { length: 32 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  accountType: mysqlEnum("accountType", ["asset", "liability", "equity", "revenue", "cost_of_revenue", "expense", "other_income", "other_expense"]).notNull(),
  normalBalance: mysqlEnum("normalBalance", ["debit", "credit"]).notNull(),
  isPosting: boolean("isPosting").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("account_code_unique").on(table.tenantId, table.companyId, table.code)]);

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  customerType: mysqlEnum("customerType", ["individual", "company", "government"]).default("company").notNull(),
  businessModel: mysqlEnum("businessModel", ["b2b", "b2c", "b2g"]).default("b2b").notNull(),
  accountTier: mysqlEnum("accountTier", customerAccountTierValues).default("standard").notNull(),
  commercialRegistration: varchar("commercialRegistration", { length: 64 }),
  unifiedNumber: varchar("unifiedNumber", { length: 64 }),
  vatNumber: varchar("vatNumber", { length: 32 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  primaryContactName: varchar("primaryContactName", { length: 255 }),
  primaryContactTitle: varchar("primaryContactTitle", { length: 255 }),
  primaryContactEmail: varchar("primaryContactEmail", { length: 320 }),
  primaryContactPhone: varchar("primaryContactPhone", { length: 32 }),
  salesOwnerUserId: int("salesOwnerUserId").references(() => users.id),
  creditLimit: decimal("creditLimit", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  paymentTermsDays: int("paymentTermsDays").default(30).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("customers_lookup_idx").on(table.tenantId, table.companyId, table.name)]);

export const customerContacts = mysqlTable("customerContacts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  name: varchar("name", { length: 255 }).notNull(),
  jobTitle: varchar("jobTitle", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("customer_contacts_lookup_idx").on(table.tenantId, table.companyId, table.customerId)]);

export const salesOpportunities = mysqlTable("salesOpportunities", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  contactId: int("contactId").references(() => customerContacts.id),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  stage: mysqlEnum("stage", ["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"]).default("new_lead").notNull(),
  probability: int("probability").default(10).notNull(),
  expectedValue: decimal("expectedValue", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  expectedCloseDate: date("expectedCloseDate"),
  source: varchar("source", { length: 128 }),
  serviceInterest: varchar("serviceInterest", { length: 255 }),
  nextAction: varchar("nextAction", { length: 500 }),
  nextActionDate: date("nextActionDate"),
  lostReason: varchar("lostReason", { length: 500 }),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("sales_opportunities_pipeline_idx").on(table.tenantId, table.companyId, table.stage, table.ownerUserId), index("sales_opportunities_customer_idx").on(table.tenantId, table.companyId, table.customerId)]);

export const salesOpportunityStageHistory = mysqlTable("salesOpportunityStageHistory", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  opportunityId: int("opportunityId").notNull().references(() => salesOpportunities.id),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id),
  fromStage: mysqlEnum("fromStage", ["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"]),
  toStage: mysqlEnum("toStage", ["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"]).notNull(),
  changedByUserId: int("changedByUserId").notNull().references(() => users.id),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => [index("sales_opportunity_history_idx").on(table.tenantId, table.companyId, table.changedAt, table.toStage), index("sales_opportunity_history_owner_idx").on(table.tenantId, table.companyId, table.ownerUserId, table.changedAt)]);

export const salesCustomerAttributions = mysqlTable("salesCustomerAttributions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  contactId: int("contactId").references(() => customerContacts.id),
  salesRepUserId: int("salesRepUserId").notNull().references(() => users.id),
  source: mysqlEnum("source", salesAttributionSourceValues).default("field_visit").notNull(),
  status: mysqlEnum("status", salesAttributionStatusValues).default("active").notNull(),
  firstContactAt: timestamp("firstContactAt").notNull(),
  lastContactAt: timestamp("lastContactAt"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("sales_customer_attribution_lookup_idx").on(table.tenantId, table.companyId, table.customerId, table.status), index("sales_customer_attribution_rep_idx").on(table.tenantId, table.companyId, table.salesRepUserId, table.status)]);

export const salesVisits = mysqlTable("salesVisits", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  contactId: int("contactId").references(() => customerContacts.id),
  opportunityId: int("opportunityId").references(() => salesOpportunities.id),
  salesRepUserId: int("salesRepUserId").notNull().references(() => users.id),
  visitType: mysqlEnum("visitType", salesVisitTypeValues).notNull(),
  status: mysqlEnum("status", salesVisitStatusValues).default("completed").notNull(),
  visitedAt: timestamp("visitedAt").notNull(),
  location: varchar("location", { length: 255 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  outcome: varchar("outcome", { length: 500 }),
  nextFollowUpDate: date("nextFollowUpDate"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("sales_visits_customer_idx").on(table.tenantId, table.companyId, table.customerId, table.visitedAt), index("sales_visits_rep_idx").on(table.tenantId, table.companyId, table.salesRepUserId, table.visitedAt)]);

export const salesCommissionRules = mysqlTable("salesCommissionRules", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  basis: mysqlEnum("basis", salesCommissionBasisValues).default("contract_value").notNull(),
  rateBps: int("rateBps").notNull(),
  effectiveFrom: date("effectiveFrom").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("sales_commission_rules_lookup_idx").on(table.tenantId, table.companyId, table.basis, table.isActive)]);

export const salesCommissionEntries = mysqlTable("salesCommissionEntries", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  ruleId: int("ruleId").references(() => salesCommissionRules.id),
  salesRepUserId: int("salesRepUserId").notNull().references(() => users.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  opportunityId: int("opportunityId").references(() => salesOpportunities.id),
  contractId: int("contractId"),
  invoiceId: int("invoiceId"),
  basis: mysqlEnum("basis", salesCommissionBasisValues).notNull(),
  basisAmount: decimal("basisAmount", { precision: 18, scale: 6 }).notNull(),
  rateBps: int("rateBps").notNull(),
  commissionAmount: decimal("commissionAmount", { precision: 18, scale: 6 }).notNull(),
  status: mysqlEnum("status", salesCommissionStatusValues).default("pending").notNull(),
  approvedByUserId: int("approvedByUserId").references(() => users.id),
  approvedAt: timestamp("approvedAt"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("sales_commission_entries_rep_idx").on(table.tenantId, table.companyId, table.salesRepUserId, table.status), index("sales_commission_entries_contract_idx").on(table.tenantId, table.companyId, table.contractId), index("sales_commission_entries_invoice_idx").on(table.tenantId, table.companyId, table.invoiceId)]);

export const salesActivities = mysqlTable("salesActivities", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  opportunityId: int("opportunityId").references(() => salesOpportunities.id),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id),
  activityType: mysqlEnum("activityType", ["call", "meeting", "email", "task", "note"]).notNull(),
  status: mysqlEnum("status", ["open", "completed", "cancelled"]).default("open").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  notes: text("notes"),
  dueDate: date("dueDate"),
  completedAt: timestamp("completedAt"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("sales_activities_worklist_idx").on(table.tenantId, table.companyId, table.status, table.dueDate, table.ownerUserId), index("sales_activities_customer_idx").on(table.tenantId, table.companyId, table.customerId)]);

export const kpiDefinitions = mysqlTable("kpiDefinitions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  nameAr: varchar("nameAr", { length: 160 }).notNull(),
  metricCode: mysqlEnum("metricCode", ["activities_completed", "opportunities_won", "completed_visits", "weighted_pipeline", "invoices_issued", "overdue_collection"]).notNull(),
  targetValue: decimal("targetValue", { precision: 18, scale: 6 }).notNull(),
  period: mysqlEnum("period", ["daily", "weekly", "monthly", "quarterly"]).default("monthly").notNull(),
  roleCode: varchar("roleCode", { length: 64 }),
  assignedUserId: int("assignedUserId").references(() => users.id),
  isActive: boolean("isActive").default(true).notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("kpi_definitions_scope_idx").on(table.tenantId, table.companyId, table.roleCode, table.assignedUserId, table.isActive)]);

/** Commercial contracts belong to one customer and may reference an archived contract document. */
export const customerContracts = mysqlTable("customerContracts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  documentId: int("documentId").references(() => documents.id),
  contractNumber: varchar("contractNumber", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", customerContractStatusValues).default("draft").notNull(),
  startDate: date("startDate"),
  endDate: date("endDate"),
  contractValue: decimal("contractValue", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("customer_contract_number_unique").on(table.tenantId, table.companyId, table.contractNumber),
  index("customer_contracts_lookup_idx").on(table.tenantId, table.companyId, table.customerId, table.status),
]);

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  vatNumber: varchar("vatNumber", { length: 32 }),
  commercialRegistration: varchar("commercialRegistration", { length: 64 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("suppliers_lookup_idx").on(table.tenantId, table.companyId, table.name)]);

export const supplierInvoices = mysqlTable("supplierInvoices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  supplierId: int("supplierId").notNull().references(() => suppliers.id),
  sourceDocumentId: int("sourceDocumentId").references(() => documents.id),
  supplierInvoiceNumber: varchar("supplierInvoiceNumber", { length: 128 }).notNull(),
  invoiceDate: date("invoiceDate").notNull(),
  dueDate: date("dueDate"),
  subtotal: decimal("subtotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  taxTotal: decimal("taxTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  grandTotal: decimal("grandTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  status: mysqlEnum("status", ["draft", "pending_review", "approved", "posted", "voided"]).default("draft").notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  approvedByUserId: int("approvedByUserId").references(() => users.id),
  approvedAt: timestamp("approvedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("supplier_invoice_unique").on(table.tenantId, table.companyId, table.supplierId, table.supplierInvoiceNumber), index("supplier_invoice_status_idx").on(table.tenantId, table.companyId, table.status)]);

export const supplierInvoiceLines = mysqlTable("supplierInvoiceLines", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  supplierInvoiceId: int("supplierInvoiceId").notNull().references(() => supplierInvoices.id),
  expenseAccountId: int("expenseAccountId").references(() => accounts.id),
  costCenterId: int("costCenterId").references(() => costCenters.id),
  projectId: int("projectId").references(() => projects.id),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  taxRate: decimal("taxRate", { precision: 8, scale: 4 }).default("0.0000").notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  lineTotal: decimal("lineTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt,
});

export const productsServices = mysqlTable("productsServices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  kind: mysqlEnum("kind", ["product", "service"]).default("service").notNull(),
  sku: varchar("sku", { length: 64 }),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  unit: varchar("unit", { length: 32 }).default("وحدة").notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  revenueAccountId: int("revenueAccountId").references(() => accounts.id),
  defaultCostCenterId: int("defaultCostCenterId").references(() => costCenters.id),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("product_sku_unique").on(table.tenantId, table.companyId, table.sku)]);

export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  branchId: int("branchId").references(() => branches.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  customerContactId: int("customerContactId").references(() => customerContacts.id),
  salesOwnerUserId: int("salesOwnerUserId").references(() => users.id),
  quoteNumber: varchar("quoteNumber", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected", "expired", "converted"]).default("draft").notNull(),
  customerResponseNote: text("customerResponseNote"),
  customerRespondedAt: timestamp("customerRespondedAt"),
  issueDate: date("issueDate").notNull(),
  expiryDate: date("expiryDate"),
  scopeOfWork: text("scopeOfWork"),
  paymentTerms: text("paymentTerms"),
  subtotal: decimal("subtotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  taxTotal: decimal("taxTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  grandTotal: decimal("grandTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  version: int("version").default(1).notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("quote_number_unique").on(table.tenantId, table.companyId, table.quoteNumber)]);

export const quotationLines = mysqlTable("quotationLines", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  quotationId: int("quotationId").notNull().references(() => quotations.id),
  productServiceId: int("productServiceId").references(() => productsServices.id),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 6 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  taxRate: decimal("taxRate", { precision: 7, scale: 4 }).default("0.0000").notNull(),
  lineTotal: decimal("lineTotal", { precision: 18, scale: 6 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt,
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  branchId: int("branchId").references(() => branches.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  quotationId: int("quotationId").references(() => quotations.id),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull(),
  invoiceType: mysqlEnum("invoiceType", ["standard", "simplified", "credit_note", "debit_note"]).notNull(),
  status: mysqlEnum("status", invoiceStatusValues).default("draft").notNull(),
  issueDate: date("issueDate").notNull(),
  dueDate: date("dueDate"),
  scopeOfWork: text("scopeOfWork"),
  paymentTerms: text("paymentTerms"),
  currencyCode: varchar("currencyCode", { length: 3 }).default("SAR").notNull(),
  subtotal: decimal("subtotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  discountTotal: decimal("discountTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  taxTotal: decimal("taxTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  grandTotal: decimal("grandTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  paidTotal: decimal("paidTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  uuid: varchar("uuid", { length: 64 }),
  originalInvoiceId: int("originalInvoiceId"),
  complianceCheckId: int("complianceCheckId"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  issuedAt: timestamp("issuedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("invoice_number_unique").on(table.tenantId, table.companyId, table.invoiceNumber), index("invoice_list_idx").on(table.tenantId, table.companyId, table.status, table.issueDate)]);

export const invoiceLines = mysqlTable("invoiceLines", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  invoiceId: int("invoiceId").notNull().references(() => invoices.id),
  productServiceId: int("productServiceId").references(() => productsServices.id),
  revenueAccountId: int("revenueAccountId").references(() => accounts.id),
  costCenterId: int("costCenterId").references(() => costCenters.id),
  projectId: int("projectId").references(() => projects.id),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 6 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  taxableAmount: decimal("taxableAmount", { precision: 18, scale: 6 }).notNull(),
  taxRate: decimal("taxRate", { precision: 7, scale: 4 }).default("0.0000").notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  lineTotal: decimal("lineTotal", { precision: 18, scale: 6 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt,
});

export const bankAccounts = mysqlTable("bankAccounts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  accountId: int("accountId").notNull().references(() => accounts.id),
  bankName: varchar("bankName", { length: 255 }).notNull(),
  iban: varchar("iban", { length: 64 }),
  currencyCode: varchar("currencyCode", { length: 3 }).default("SAR").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt,
  updatedAt,
});

export const bankStatementLines = mysqlTable("bankStatementLines", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  bankAccountId: int("bankAccountId").notNull().references(() => bankAccounts.id),
  transactionDate: date("transactionDate").notNull(),
  reference: varchar("reference", { length: 128 }),
  description: varchar("description", { length: 500 }),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  direction: mysqlEnum("direction", ["inflow", "outflow"]).notNull(),
  reconciliationStatus: mysqlEnum("reconciliationStatus", ["unmatched", "matched", "excluded"]).default("unmatched").notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("bank_statement_reconciliation_idx").on(table.tenantId, table.bankAccountId, table.reconciliationStatus)]);

export const bankReconciliationMatches = mysqlTable("bankReconciliationMatches", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  statementLineId: int("statementLineId").notNull().references(() => bankStatementLines.id),
  paymentId: int("paymentId").references(() => payments.id),
  matchedAmount: decimal("matchedAmount", { precision: 18, scale: 6 }).notNull(),
  matchedByUserId: int("matchedByUserId").notNull().references(() => users.id),
  createdAt,
}, (table) => [uniqueIndex("reconciliation_statement_unique").on(table.tenantId, table.statementLineId)]);

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  invoiceId: int("invoiceId"),
  customerId: int("customerId").references(() => customers.id),
  bankAccountId: int("bankAccountId").references(() => bankAccounts.id),
  paymentNumber: varchar("paymentNumber", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["receipt", "payment"]).notNull(),
  method: mysqlEnum("method", ["cash", "bank_transfer", "card", "cheque", "other"]).notNull(),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  paymentDate: date("paymentDate").notNull(),
  reference: varchar("reference", { length: 128 }),
  status: mysqlEnum("status", ["draft", "posted", "reversed"]).default("draft").notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("payment_number_unique").on(table.tenantId, table.companyId, table.paymentNumber)]);

export const journalEntries = mysqlTable("journalEntries", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  branchId: int("branchId").references(() => branches.id),
  fiscalPeriodId: int("fiscalPeriodId").notNull().references(() => fiscalPeriods.id),
  entryNumber: varchar("entryNumber", { length: 64 }).notNull(),
  entryDate: date("entryDate").notNull(),
  status: mysqlEnum("status", journalStatusValues).default("draft").notNull(),
  sourceType: varchar("sourceType", { length: 64 }).notNull(),
  sourceId: int("sourceId"),
  originalEntryId: int("originalEntryId"),
  description: text("description"),
  debitTotal: decimal("debitTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  creditTotal: decimal("creditTotal", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  postedByUserId: int("postedByUserId").references(() => users.id),
  postedAt: timestamp("postedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("journal_entry_number_unique").on(table.tenantId, table.companyId, table.entryNumber), index("journal_period_idx").on(table.tenantId, table.companyId, table.fiscalPeriodId, table.status)]);

export const journalLines = mysqlTable("journalLines", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  journalEntryId: int("journalEntryId").notNull().references(() => journalEntries.id),
  accountId: int("accountId").notNull().references(() => accounts.id),
  customerId: int("customerId").references(() => customers.id),
  supplierId: int("supplierId").references(() => suppliers.id),
  costCenterId: int("costCenterId").references(() => costCenters.id),
  projectId: int("projectId").references(() => projects.id),
  debit: decimal("debit", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  credit: decimal("credit", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  description: varchar("description", { length: 500 }),
  lineOrder: int("lineOrder").default(0).notNull(),
  createdAt,
}, (table) => [index("journal_lines_account_idx").on(table.tenantId, table.accountId)]);

export const zatcaEgsUnits = mysqlTable("zatcaEgsUnits", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  branchId: int("branchId").references(() => branches.id),
  environment: mysqlEnum("environment", zatcaEnvironmentValues).default("simulation").notNull(),
  deviceName: varchar("deviceName", { length: 255 }).notNull(),
  serialNumber: varchar("serialNumber", { length: 128 }).notNull(),
  invoiceType: mysqlEnum("invoiceType", ["standard", "simplified", "both"] as const).default("both").notNull(),
  status: mysqlEnum("status", zatcaEgsStatusValues).default("draft").notNull(),
  csrStatus: mysqlEnum("csrStatus", zatcaSetupStatusValues).default("not_started").notNull(),
  complianceCsidStatus: mysqlEnum("complianceCsidStatus", zatcaSetupStatusValues).default("not_started").notNull(),
  complianceCheckStatus: mysqlEnum("complianceCheckStatus", zatcaSetupStatusValues).default("not_started").notNull(),
  productionCsidStatus: mysqlEnum("productionCsidStatus", zatcaSetupStatusValues).default("not_started").notNull(),
  connectionStatus: mysqlEnum("connectionStatus", zatcaConnectionStatusValues).default("not_configured").notNull(),
  csrPemEncrypted: text("csrPemEncrypted"),
  privateKeyEncrypted: text("privateKeyEncrypted"),
  certificateExpiresAt: timestamp("certificateExpiresAt"),
  lastSuccessfulConnection: timestamp("lastSuccessfulConnection"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("zatca_egs_company_env_serial_unique").on(table.tenantId, table.companyId, table.environment, table.serialNumber), index("zatca_egs_scope_idx").on(table.tenantId, table.companyId, table.environment, table.status)]);

export const zatcaCredentials = mysqlTable("zatcaCredentials", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  egsId: int("egsId").notNull().references(() => zatcaEgsUnits.id),
  environment: mysqlEnum("environment", zatcaEnvironmentValues).notNull(),
  credentialType: mysqlEnum("credentialType", zatcaCredentialTypeValues).notNull(),
  requestId: varchar("requestId", { length: 128 }),
  encryptedBinarySecurityToken: text("encryptedBinarySecurityToken"),
  encryptedSecret: text("encryptedSecret"),
  issuedAt: timestamp("issuedAt"),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", zatcaCredentialStatusValues).default("active").notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("zatca_credentials_scope_idx").on(table.tenantId, table.companyId, table.egsId, table.environment, table.status)]);

export const complianceRulesets = mysqlTable("complianceRulesets", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").references(() => tenants.id),
  code: varchar("code", { length: 64 }).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  effectiveFrom: date("effectiveFrom").notNull(),
  effectiveTo: date("effectiveTo"),
  status: mysqlEnum("status", ["draft", "active", "retired"]).default("draft").notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("ruleset_version_unique").on(table.tenantId, table.code, table.version)]);

export const complianceChecks = mysqlTable("complianceChecks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  invoiceId: int("invoiceId"),
  rulesetId: int("rulesetId").notNull().references(() => complianceRulesets.id),
  score: int("score").notNull(),
  hasCriticalErrors: boolean("hasCriticalErrors").default(false).notNull(),
  resultJson: json("resultJson").notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
}, (table) => [index("compliance_invoice_idx").on(table.tenantId, table.invoiceId)]);

export const zatcaSubmissions = mysqlTable("zatcaSubmissions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  invoiceId: int("invoiceId").notNull().references(() => invoices.id),
  rulesetId: int("rulesetId").references(() => complianceRulesets.id),
  operation: mysqlEnum("operation", ["onboarding", "clearance", "reporting"]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "succeeded", "failed", "retrying"]).default("queued").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  correlationId: varchar("correlationId", { length: 128 }),
  responseCode: varchar("responseCode", { length: 64 }),
  responseSummary: text("responseSummary"),
  attemptCount: int("attemptCount").default(0).notNull(),
  lastAttemptAt: timestamp("lastAttemptAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("zatca_idempotency_unique").on(table.tenantId, table.idempotencyKey), index("zatca_submission_idx").on(table.tenantId, table.status)]);

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  classification: mysqlEnum("classification", ["zatca", "vat", "zakat", "bank", "audit", "supplier", "customer", "contract", "financial_statement", "miscellaneous"]).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  uploadedByUserId: int("uploadedByUserId").notNull().references(() => users.id),
  retentionPolicyId: int("retentionPolicyId"),
  retentionStatus: mysqlEnum("retentionStatus", ["active", "archived", "hold", "expired"]).default("active").notNull(),
  retentionUntil: date("retentionUntil"),
  archivedAt: timestamp("archivedAt"),
  isLegalHold: boolean("isLegalHold").default(false).notNull(),
  createdAt,
});

export const documentRetentionPolicies = mysqlTable("documentRetentionPolicies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  classification: mysqlEnum("classification", ["zatca", "vat", "zakat", "bank", "audit", "supplier", "customer", "contract", "financial_statement", "miscellaneous"]).notNull(),
  retentionYears: int("retentionYears").notNull(),
  preventDeletion: boolean("preventDeletion").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("document_retention_policy_unique").on(table.tenantId, table.companyId, table.classification)]);

export const documentLinks = mysqlTable("documentLinks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  documentId: int("documentId").notNull().references(() => documents.id),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  createdAt,
}, (table) => [index("document_link_entity_idx").on(table.tenantId, table.entityType, table.entityId)]);

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").references(() => companies.id),
  actorUserId: int("actorUserId").references(() => users.id),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  previousValue: json("previousValue"),
  newValue: json("newValue"),
  reason: varchar("reason", { length: 500 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt,
}, (table) => [index("audit_entity_idx").on(table.tenantId, table.entityType, table.entityId), index("audit_actor_idx").on(table.tenantId, table.actorUserId, table.createdAt)]);

export const auditEngagements = mysqlTable("auditEngagements", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  fiscalPeriodId: int("fiscalPeriodId").notNull().references(() => fiscalPeriods.id),
  auditorUserId: int("auditorUserId").notNull().references(() => users.id),
  engagementName: varchar("engagementName", { length: 255 }).notNull(),
  auditFirm: varchar("auditFirm", { length: 255 }),
  accessStart: date("accessStart").notNull(),
  accessExpiry: date("accessExpiry").notNull(),
  status: mysqlEnum("status", ["pending_independence", "active", "closed", "suspended"]).default("pending_independence").notNull(),
  isIndependenceDeclared: boolean("isIndependenceDeclared").default(false).notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("audit_engagement_scope_unique").on(table.tenantId, table.companyId, table.fiscalPeriodId, table.auditorUserId), index("audit_engagement_auditor_idx").on(table.tenantId, table.auditorUserId, table.status)]);

export const auditIndependenceDeclarations = mysqlTable("auditIndependenceDeclarations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  engagementId: int("engagementId").notNull().references(() => auditEngagements.id),
  auditorUserId: int("auditorUserId").notNull().references(() => users.id),
  auditFirm: varchar("auditFirm", { length: 255 }),
  independenceConfirmed: boolean("independenceConfirmed").notNull(),
  hasPotentialConflict: boolean("hasPotentialConflict").default(false).notNull(),
  potentialRelationships: text("potentialRelationships"),
  declarationStatus: mysqlEnum("declarationStatus", ["declared", "updated", "conflict_disclosed"]).default("declared").notNull(),
  declaredAt: timestamp("declaredAt").notNull(),
  createdAt,
  updatedAt,
}, (table) => [index("audit_independence_engagement_idx").on(table.engagementId, table.declaredAt)]);

export const auditClosingNotes = mysqlTable("auditClosingNotes", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  engagementId: int("engagementId").notNull().references(() => auditEngagements.id),
  fiscalPeriodId: int("fiscalPeriodId").notNull().references(() => fiscalPeriods.id),
  authorUserId: int("authorUserId").notNull().references(() => users.id),
  note: text("note").notNull(),
  createdAt,
}, (table) => [index("audit_closing_note_period_idx").on(table.tenantId, table.fiscalPeriodId, table.createdAt)]);

export const auditReopenRequests = mysqlTable("auditReopenRequests", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  engagementId: int("engagementId").notNull().references(() => auditEngagements.id),
  fiscalPeriodId: int("fiscalPeriodId").notNull().references(() => fiscalPeriods.id),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedByUserId: int("reviewedByUserId").references(() => users.id),
  reviewedAt: timestamp("reviewedAt"),
  decisionNote: text("decisionNote"),
  createdAt,
  updatedAt,
}, (table) => [index("audit_reopen_period_idx").on(table.tenantId, table.companyId, table.fiscalPeriodId, table.status)]);

export const auditFinalReports = mysqlTable("auditFinalReports", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  engagementId: int("engagementId").notNull().references(() => auditEngagements.id),
  fiscalPeriodId: int("fiscalPeriodId").notNull().references(() => fiscalPeriods.id),
  summaryOfFindings: text("summaryOfFindings"),
  materialMisstatements: text("materialMisstatements"),
  adjustmentsProposed: text("adjustmentsProposed"),
  adjustmentsAcceptedRejected: text("adjustmentsAcceptedRejected"),
  complianceStatus: text("complianceStatus"),
  vatReviewSummary: text("vatReviewSummary"),
  zakatReviewSummary: text("zakatReviewSummary"),
  financialStatementOpinionDraft: text("financialStatementOpinionDraft"),
  managementResponses: text("managementResponses"),
  opinionStatus: mysqlEnum("opinionStatus", ["draft", "final", "qualified", "disclaimer", "adverse"]).default("draft").notNull(),
  isLocked: boolean("isLocked").default(false).notNull(),
  lockedAt: timestamp("lockedAt"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("audit_final_report_engagement_unique").on(table.engagementId)]);

export const auditSignOffs = mysqlTable("auditSignOffs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  reportId: int("reportId").notNull().references(() => auditFinalReports.id),
  fiscalPeriodId: int("fiscalPeriodId").notNull().references(() => fiscalPeriods.id),
  auditorUserId: int("auditorUserId").notNull().references(() => users.id),
  auditorName: varchar("auditorName", { length: 255 }).notNull(),
  professionalLicenseNumber: varchar("professionalLicenseNumber", { length: 128 }).notNull(),
  auditFirm: varchar("auditFirm", { length: 255 }).notNull(),
  auditScope: text("auditScope").notNull(),
  opinionStatus: mysqlEnum("opinionStatus", ["draft", "final", "qualified", "disclaimer", "adverse"]).default("draft").notNull(),
  signedAt: timestamp("signedAt").notNull(),
  createdAt,
}, (table) => [uniqueIndex("audit_signoff_report_unique").on(table.reportId)]);

export const outboxEvents = mysqlTable("outboxEvents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  aggregateType: varchar("aggregateType", { length: 64 }).notNull(),
  aggregateId: int("aggregateId").notNull(),
  payload: json("payload").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  attempts: int("attempts").default(0).notNull(),
  processedAt: timestamp("processedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("outbox_idempotency_unique").on(table.tenantId, table.idempotencyKey), index("outbox_status_idx").on(table.status, table.createdAt)]);

export const financialReminderSchedules = mysqlTable("financialReminderSchedules", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  reminderType: mysqlEnum("reminderType", ["vat_due", "financial_digest", "approval_pending", "customer_payment_due"]).notNull(),
  cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("financial_reminder_unique").on(table.tenantId, table.companyId, table.reminderType), index("financial_reminder_task_idx").on(table.scheduleCronTaskUid)]);

/** One row per invoice, calendar day, and reminder class ensures retries cannot duplicate alerts. */
export const customerPaymentReminderEvents = mysqlTable("customerPaymentReminderEvents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  invoiceId: int("invoiceId").notNull().references(() => invoices.id),
  reminderDate: date("reminderDate").notNull(),
  reminderKind: mysqlEnum("reminderKind", ["upcoming", "overdue"]).notNull(),
  createdAt,
}, (table) => [
  uniqueIndex("customer_payment_reminder_unique").on(table.tenantId, table.companyId, table.invoiceId, table.reminderDate, table.reminderKind),
  index("customer_payment_reminder_lookup_idx").on(table.tenantId, table.companyId, table.customerId, table.reminderDate),
]);

export const executiveAssignments = mysqlTable("executiveAssignments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assignedToUserId: int("assignedToUserId").notNull().references(() => users.id),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  dueDate: date("dueDate").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  status: mysqlEnum("status", ["planned", "in_progress", "blocked", "completed", "cancelled"]).default("planned").notNull(),
  latestUpdate: text("latestUpdate"),
  completedAt: timestamp("completedAt"),
  createdAt,
  updatedAt,
}, (table) => [index("executive_assignment_scope_idx").on(table.tenantId, table.companyId, table.status, table.dueDate), index("executive_assignment_owner_idx").on(table.tenantId, table.assignedToUserId, table.status)]);

export const executiveWeeklyReports = mysqlTable("executiveWeeklyReports", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  weekStart: date("weekStart").notNull(),
  weekEnd: date("weekEnd").notNull(),
  submittedByUserId: int("submittedByUserId").notNull().references(() => users.id),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed"]).default("draft").notNull(),
  summary: text("summary").notNull(),
  achievements: text("achievements"),
  blockers: text("blockers"),
  decisionsNeeded: text("decisionsNeeded"),
  nextWeekPlan: text("nextWeekPlan"),
  reviewedByUserId: int("reviewedByUserId").references(() => users.id),
  reviewedAt: timestamp("reviewedAt"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("executive_weekly_report_unique").on(table.tenantId, table.companyId, table.weekStart, table.submittedByUserId), index("executive_weekly_report_scope_idx").on(table.tenantId, table.companyId, table.status, table.weekStart)]);

export const executiveDecisionStatusValues = ["issued", "assigned", "in_progress", "waiting", "completed", "closed"] as const;
export const executiveRequestStatusValues = ["new", "in_review", "assigned", "in_progress", "completed", "cancelled"] as const;
export const executiveRequestTypeValues = ["schedule_meeting", "follow_up_task", "request_report", "prepare_document", "reminder", "contact_manager", "prepare_minutes", "request_update"] as const;
export const executiveAccessScopeValues = ["general", "executive", "confidential", "ceo_only"] as const;
export const executiveDelegationPermissionValues = ["can_schedule_on_behalf_of_ceo", "can_request_reports_on_behalf_of_ceo", "can_follow_up_on_behalf_of_ceo", "can_send_internal_reminder_on_behalf_of_ceo"] as const;

export const executiveDecisions = mysqlTable("executiveDecisions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  decisionDate: date("decisionDate").notNull(),
  responsibleDepartment: varchar("responsibleDepartment", { length: 128 }),
  responsibleUserId: int("responsibleUserId").references(() => users.id),
  requirement: text("requirement").notNull(),
  dueDate: date("dueDate"),
  status: mysqlEnum("status", executiveDecisionStatusValues).default("issued").notNull(),
  completionPercent: int("completionPercent").default(0).notNull(),
  latestUpdate: text("latestUpdate"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("executive_decision_scope_idx").on(table.tenantId, table.companyId, table.status, table.dueDate, table.responsibleDepartment)]);

export const executiveRequests = mysqlTable("executiveRequests", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  requestType: mysqlEnum("requestType", executiveRequestTypeValues).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"] as const).default("normal").notNull(),
  status: mysqlEnum("status", executiveRequestStatusValues).default("new").notNull(),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id),
  assignedToUserId: int("assignedToUserId").references(() => users.id),
  dueDate: date("dueDate"),
  completedAt: timestamp("completedAt"),
  createdAt,
  updatedAt,
}, (table) => [index("executive_request_scope_idx").on(table.tenantId, table.companyId, table.status, table.priority, table.dueDate)]);

export const executiveMeetings = mysqlTable("executiveMeetings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt"),
  meetingLink: varchar("meetingLink", { length: 500 }),
  participants: text("participants"),
  agenda: text("agenda"),
  brief: text("brief"),
  minutes: text("minutes"),
  actionItems: text("actionItems"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("executive_meeting_scope_idx").on(table.tenantId, table.companyId, table.startAt)]);

export const executiveDelegations = mysqlTable("executiveDelegations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  assistantUserId: int("assistantUserId").notNull().references(() => users.id),
  permission: mysqlEnum("permission", executiveDelegationPermissionValues).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  grantedByUserId: int("grantedByUserId").notNull().references(() => users.id),
  revokedAt: timestamp("revokedAt"),
  createdAt,
  updatedAt,
}, (table) => [index("executive_delegation_scope_idx").on(table.tenantId, table.companyId, table.assistantUserId, table.permission, table.startsAt, table.endsAt)]);

export const executiveDocuments = mysqlTable("executiveDocuments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  documentId: int("documentId").notNull().references(() => documents.id),
  title: varchar("title", { length: 255 }).notNull(),
  accessScope: mysqlEnum("accessScope", executiveAccessScopeValues).default("executive").notNull(),
  sharedWithUserId: int("sharedWithUserId").references(() => users.id),
  sharedByUserId: int("sharedByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("executive_document_share_unique").on(table.tenantId, table.companyId, table.documentId, table.sharedWithUserId), index("executive_document_scope_idx").on(table.tenantId, table.companyId, table.accessScope, table.sharedWithUserId)]);

export const executiveInboxItems = mysqlTable("executiveInboxItems", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  itemType: mysqlEnum("itemType", ["approval_request", "report", "decision_request", "escalation", "critical_issue", "contract_review", "important_document"] as const).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"] as const).default("normal").notNull(),
  status: mysqlEnum("status", ["open", "snoozed", "completed", "dismissed"] as const).default("open").notNull(),
  dueAt: timestamp("dueAt"),
  note: text("note"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("executive_inbox_scope_idx").on(table.tenantId, table.companyId, table.status, table.priority, table.dueAt)]);

export const salesWeeklyRepNotes = mysqlTable("salesWeeklyRepNotes", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  salesRepUserId: int("salesRepUserId").notNull().references(() => users.id),
  authorUserId: int("authorUserId").notNull().references(() => users.id),
  weekStart: date("weekStart").notNull(),
  weekEnd: date("weekEnd").notNull(),
  note: text("note").notNull(),
  updatedAt,
  createdAt,
}, (table) => [uniqueIndex("sales_weekly_rep_note_unique").on(table.tenantId, table.companyId, table.salesRepUserId, table.weekStart), index("sales_weekly_rep_note_scope_idx").on(table.tenantId, table.companyId, table.weekStart)]);

export const executiveRiskSeverityValues = ["low", "medium", "high", "critical"] as const;
export const executiveRegisterStatusValues = ["open", "mitigating", "accepted", "closed"] as const;
export const executiveOpportunityTypeValues = ["sales_growth", "cost_reduction", "collections", "operations", "data_insight"] as const;
export const executiveApprovalActionValues = ["approve", "reject", "request_information"] as const;

export const executiveRisks = mysqlTable("executiveRisks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sourceModule: varchar("sourceModule", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", executiveRiskSeverityValues).default("medium").notNull(),
  impact: text("impact"),
  ownerUserId: int("ownerUserId").references(() => users.id),
  recommendedAction: text("recommendedAction"),
  status: mysqlEnum("status", executiveRegisterStatusValues).default("open").notNull(),
  dueDate: date("dueDate"),
  sourceEntityType: varchar("sourceEntityType", { length: 64 }),
  sourceEntityId: int("sourceEntityId"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("executive_risk_scope_idx").on(table.tenantId, table.companyId, table.status, table.severity, table.dueDate)]);

export const executiveOpportunities = mysqlTable("executiveOpportunities", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  opportunityType: mysqlEnum("opportunityType", executiveOpportunityTypeValues).notNull(),
  estimatedValue: decimal("estimatedValue", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  confidencePercent: int("confidencePercent").default(0).notNull(),
  ownerUserId: int("ownerUserId").references(() => users.id),
  evidence: text("evidence"),
  recommendedAction: text("recommendedAction"),
  status: mysqlEnum("status", executiveRegisterStatusValues).default("open").notNull(),
  sourceEntityType: varchar("sourceEntityType", { length: 64 }),
  sourceEntityId: int("sourceEntityId"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [index("executive_opportunity_scope_idx").on(table.tenantId, table.companyId, table.status, table.opportunityType)]);

export const executiveApprovalPolicies = mysqlTable("executiveApprovalPolicies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  documentType: varchar("documentType", { length: 64 }).notNull(),
  roleCode: varchar("roleCode", { length: 64 }).notNull(),
  minAmount: decimal("minAmount", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  maxAmount: decimal("maxAmount", { precision: 18, scale: 6 }),
  requiresCeo: boolean("requiresCeo").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("executive_approval_policy_unique").on(table.tenantId, table.companyId, table.documentType, table.roleCode, table.minAmount), index("executive_approval_policy_scope_idx").on(table.tenantId, table.companyId, table.documentType, table.active)]);

export const executiveApprovalActions = mysqlTable("executiveApprovalActions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  companyId: int("companyId").notNull().references(() => companies.id),
  approvalRequestId: int("approvalRequestId").notNull().references(() => approvalRequests.id),
  action: mysqlEnum("action", executiveApprovalActionValues).notNull(),
  note: text("note"),
  actorUserId: int("actorUserId").notNull().references(() => users.id),
  createdAt,
}, (table) => [index("executive_approval_action_scope_idx").on(table.tenantId, table.companyId, table.approvalRequestId, table.createdAt)]);

export const scheduledExecutionLocks = mysqlTable("scheduledExecutionLocks", {
  id: int("id").autoincrement().primaryKey(),
  taskUid: varchar("taskUid", { length: 65 }).notNull(),
  executionBucket: varchar("executionBucket", { length: 32 }).notNull(),
  createdAt,
}, (table) => [uniqueIndex("scheduled_execution_unique").on(table.taskUid, table.executionBucket)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalLine = typeof journalLines.$inferSelect;
