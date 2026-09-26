import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

const unixNow = () => sql`(cast(strftime('%s','now') as int))`;

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  permissions: text("permissions", { mode: "json" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at").default(unixNow()),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  roleId: text("role_id").notNull().references(() => roles.id),
  status: text("status").default("ACTIVE"),
  lastLoginAt: integer("last_login_at"),
  createdAt: integer("created_at").default(unixNow()),
  deletedAt: integer("deleted_at"),
});

export const staffProfiles = sqliteTable("staff_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  documentNumber: text("document_number").notNull(),
  specialization: text("specialization"),
  licenseNumber: text("license_number"),
  signatureUrl: text("signature_url"),
  hasSctr: integer("has_sctr", { mode: "boolean" }).default(false),
  sctrExpiryDate: integer("sctr_expiry_date"),
  baseSalary: real("base_salary"),
  currentLatitude: real("current_latitude"),
  currentLongitude: real("current_longitude"),
  lastLocationUpdate: integer("last_location_update"),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  taxId: text("tax_id").unique(),
  taxIdType: text("tax_id_type").default("RUC"),
  billingAddress: text("billing_address"),
  billingEmail: text("billing_email"),
  logoUrl: text("logo_url"),
  status: text("status").default("ACTIVE"),
  createdAt: integer("created_at").default(unixNow()),
  deletedAt: integer("deleted_at"),
});

export const ubigeos = sqliteTable(
  "ubigeos",
  {
    id: text("id").primaryKey(),
    departamento: text("departamento").notNull(),
    provincia: text("provincia").notNull(),
    distrito: text("distrito").notNull(),
    latitud: real("latitud"),
    longitud: real("longitud"),
    createdAt: integer("created_at").default(unixNow()),
  },
  (t) => [
    index("idx_ubigeos_departamento").on(t.departamento),
    index("idx_ubigeos_provincia").on(t.provincia),
    index("idx_ubigeos_distrito").on(t.distrito),
  ]
);

export const costCenters = sqliteTable("cost_center", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  ubigeoId: text("ubigeo_id").references(() => ubigeos.id),
  latitude: real("latitude"),
  longitude: real("longitude"),
  mainPhotoUrl: text("main_photo_url"),
  passwordHash: text("password_hash"),
  createdAt: integer("created_at").default(unixNow()),
  deletedAt: integer("deleted_at"),
});

export const costCenterContacts = sqliteTable("cost_center_contacts", {
  id: text("id").primaryKey(),
  costCenterId: text("cost_center_id")
    .notNull()
    .references(() => costCenters.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  role: text("role").default("Administrador"),
  phone: text("phone"),
  email: text("email"),
  signatureUrl: text("signature_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  country: text("country"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  techSpecs: text("tech_specs", { mode: "json" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const elevatorTypes = sqliteTable("elevator_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const elevatorUnities = sqliteTable("elevator_unity", {
  id: text("id").primaryKey(),
  costCenterId: text("cost_center_id")
    .notNull()
    .references(() => costCenters.id, { onDelete: "restrict" }),
  brandId: text("brand_id").references(() => brands.id),
  modelId: text("model_id").references(() => models.id),
  elevatorTypeId: text("elevator_type_id")
    .notNull()
    .references(() => elevatorTypes.id),

  internalCode: text("internal_code").notNull(),
  manufacturerSerial: text("manufacturer_serial"),
  name: text("name").notNull(),

  capacityPersons: integer("capacity_persons"),
  capacityKg: integer("capacity_kg"),
  speedMs: real("speed_ms"),
  stops: integer("stops"),
  floors: integer("floors"),
  tractionType: text("traction_type"),
  yearOfFabrication: integer("year_of_fabrication"),

  status: text("status").default("OPERATIVE"),
  installationDate: integer("installation_date"),
  referencePhotos: text("reference_photos", { mode: "json" }),

  createdAt: integer("created_at").default(unixNow()),
  deletedAt: integer("deleted_at"),
});

export const serviceTypes = sqliteTable("service_types", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  requiresContract: integer("requires_contract", { mode: "boolean" }).default(false),
  defaultSlaMins: integer("default_sla_mins"),
  isBillableByDefault: integer("is_billable_by_default", { mode: "boolean" }).default(true),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isSystem: integer("is_system", { mode: "boolean" }).default(false),
  billingTrigger: text("billing_trigger").default("MANUAL"),
  billingDelayDays: integer("billing_delay_days").default(0),
  allowedDocumentTypes: text("allowed_document_types").default("FACTURA,BOLETA,NOTA_VENTA_INTERNA"),
  createdAt: integer("created_at").default(unixNow()),
});

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  contractNumber: text("contract_number").notNull().unique(),
  costCenterId: text("cost_center_id")
    .notNull()
    .references(() => costCenters.id, { onDelete: "restrict" }),
  status: text("status").default("ACTIVE"),
  serviceTypeId: text("service_type_id")
    .notNull()
    .references(() => serviceTypes.id, { onDelete: "restrict" }),
  startDate: integer("start_date").notNull(),
  endDate: integer("end_date"),
  autoRenewal: integer("auto_renewal", { mode: "boolean" }).default(true),
  noticePeriodDays: integer("notice_period_days").default(30),
  currency: text("currency").default("PEN"),
  baseAmount: real("base_amount").notNull(),
  includesIgv: integer("includes_igv", { mode: "boolean" }).default(true),
  paymentTermsDays: integer("payment_terms_days").default(5),
  inflationAdjustment: integer("inflation_adjustment", { mode: "boolean" }).default(true),
  slaEntrapmentMins: integer("sla_entrapment_mins").default(45),
  slaMechanicalFailureMins: integer("sla_mechanical_failure_mins").default(180),
  clientSignerName: text("client_signer_name"),
  clientSignerDocument: text("client_signer_document"),
  signatureDate: integer("signature_date"),
  documentStatus: text("document_status").default("DRAFT"),
  documentOverrides: text("document_overrides", { mode: "json" }),
  finalPdfUrl: text("final_pdf_url"),
  createdAt: integer("created_at").default(unixNow()),
  deletedAt: integer("deleted_at"),
});

export const contractElevators = sqliteTable("contract_elevators", {
  id: text("id").primaryKey(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  elevatorUnityId: text("elevator_unity_id")
    .notNull()
    .references(() => elevatorUnities.id, { onDelete: "restrict" }),
  frequencyMonths: integer("frequency_months").default(1),
  price: real("price").notNull(),
  addedAt: integer("added_at").default(unixNow()),
});

export const safetyTemplates = sqliteTable("safety_templates", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  equipmentTypeId: text("equipment_type_id").references(() => elevatorTypes.id),
  name: text("name").notNull(),
  version: text("version").default("v1.0"),
  content: text("content", { mode: "json" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at").default(unixNow()),
});

export const workOrderSafetyRecords = sqliteTable("work_order_safety_records", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id").notNull(),
  templateId: text("template_id")
    .notNull()
    .references(() => safetyTemplates.id),
  technicianId: text("technician_id")
    .notNull()
    .references(() => users.id),
  status: text("status").default("DRAFT"),
  responses: text("responses", { mode: "json" }).notNull(),
  signatureUrl: text("signature_url"),
  geolocation: text("geolocation", { mode: "json" }),
  signedAt: integer("signed_at"),
  createdAt: integer("created_at").default(unixNow()),
});

export const workOrders = sqliteTable("work_orders", {
  id: text("id").primaryKey(),
  otNumber: text("ot_number").notNull().unique(),
  costCenterId: text("cost_center_id")
    .notNull()
    .references(() => costCenters.id, { onDelete: "restrict" }),
  technicianId: text("technician_id").references(() => users.id),
  serviceTypeId: text("service_type_id").references(() => serviceTypes.id),

  type: text("type").default("CORRECTIVE"),
  status: text("status").default("PENDING"),
  priority: text("priority").default("NORMAL"),

  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),

  checkinLatitude: real("checkin_latitude"),
  checkinLongitude: real("checkin_longitude"),

  closingNotes: text("closing_notes"),
  clientSignatureUrl: text("client_signature_url"),
  clientSignerName: text("client_signer_name"),

  createdAt: integer("created_at").default(unixNow()),
  deletedAt: integer("deleted_at"),
});

export const workOrderElevators = sqliteTable("work_order_elevators", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  elevatorUnityId: text("elevator_unity_id")
    .notNull()
    .references(() => elevatorUnities.id, { onDelete: "restrict" }),
  status: text("status").default("PENDING"),
  finding: text("finding"),
  evidencePhotoUrls: text("evidence_photo_urls", { mode: "json" }),
  finalStatus: text("final_equipment_status"),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id),
  equipmentId: text("equipment_id").references(() => elevatorUnities.id),
  reportCategory: text("report_category").notNull(),
  reportType: text("report_type").notNull(),
  issueDescription: text("issue_description").notNull(),
  observations: text("observations"),
  status: text("status").default("Borrador"),
  finalPdfUrl: text("final_pdf_url"),
  createdAt: integer("created_at").default(unixNow()),
  updatedAt: integer("updated_at").default(unixNow()),
});

export const workOrderTasks = sqliteTable("work_order_tasks", {
  id: text("id").primaryKey(),
  workOrderElevatorId: text("work_order_elevator_id")
    .notNull()
    .references(() => workOrderElevators.id, { onDelete: "cascade" }),
  taskDescription: text("task_description").notNull(),
  isCritical: integer("is_critical", { mode: "boolean" }).default(false),
  isCompleted: integer("is_completed", { mode: "boolean" }).default(false),
  observations: text("observations"),
  evidencePhotoUrl: text("evidence_photo_url"),
  completedAt: integer("completed_at"),
});

export const preventiveRoutes = sqliteTable(
  "preventive_routes",
  {
    id: text("id").primaryKey(),
    technicianId: text("technician_id")
      .notNull()
      .references(() => users.id),
    businessDayNumber: integer("business_day_number").notNull(),
    name: text("name"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at").default(unixNow()),
  },
  (t) => [unique().on(t.technicianId, t.businessDayNumber)]
);

export const preventiveRouteConfig = sqliteTable("preventive_route_config", {
  technicianId: text("technician_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  totalDays: integer("total_days").default(10),
  maxDays: integer("max_days").default(15),
  includeSaturdays: integer("include_saturdays", { mode: "boolean" }).default(true),
  saturdayMaxHours: integer("saturday_max_hours").default(4),
  defaultStopDurationMins: integer("default_stop_duration_mins").default(120),
  updatedAt: integer("updated_at").default(unixNow()),
});

export const preventiveRouteStops = sqliteTable(
  "preventive_route_stops",
  {
    id: text("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => preventiveRoutes.id, { onDelete: "cascade" }),
    contractElevatorId: text("contract_elevator_id")
      .notNull()
      .references(() => contractElevators.id),
    plannedTime: text("planned_time").notNull(),
    orderIndex: integer("order_index").default(0),
    visitGroupId: text("visit_group_id"),
    estimatedDurationMins: integer("estimated_duration_mins").default(120),
    generatedWorkOrderId: text("generated_work_order_id").references(() => workOrders.id, {
      onDelete: "set null",
    }),
    generatedMonth: text("generated_month"),
    generatedAt: integer("generated_at"),
    createdAt: integer("created_at").default(unixNow()),
  },
  (t) => [
    index("idx_prs_generated_month").on(t.generatedMonth),
    index("idx_prs_visit_group").on(t.visitGroupId),
  ]
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    documentType: text("document_type").notNull(),
    series: text("series"),
    number: text("number"),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    costCenterId: text("cost_center_id").references(() => costCenters.id, { onDelete: "restrict" }),
    contractId: text("contract_id").references(() => contracts.id, { onDelete: "restrict" }),
    workOrderId: text("work_order_id").references(() => workOrders.id, { onDelete: "restrict" }),
    issueDate: integer("issue_date"),
    dueDate: integer("due_date"),
    taxPeriod: text("tax_period"),
    currency: text("currency").default("PEN"),
    total: real("total").notNull(),
    taxableBase: real("taxable_base"),
    igv: real("igv"),
    rentaRate: real("renta_rate").default(0),
    rentaAmount: real("renta_amount").default(0),
    detractionRate: real("detraction_rate").default(0),
    detractionAmount: real("detraction_amount").default(0),
    netPayable: real("net_payable"),
    sunatStatus: text("sunat_status").default("DRAFT"),
    paymentStatus: text("payment_status").default("PENDING"),
    clientTaxIdSnapshot: text("client_tax_id_snapshot"),
    clientTaxIdTypeSnapshot: text("client_tax_id_type_snapshot"),
    clientNameSnapshot: text("client_name_snapshot"),
    clientAddressSnapshot: text("client_address_snapshot"),
    payerType: text("payer_type").default("COST_CENTER"),
    payerTaxIdType: text("payer_tax_id_type"),
    payerTaxId: text("payer_tax_id"),
    payerName: text("payer_name"),
    payerCommercialName: text("payer_commercial_name"),
    payerPhone: text("payer_phone"),
    payerEmail: text("payer_email"),
    payerRelationship: text("payer_relationship"),
    payerNotes: text("payer_notes"),
    createdAt: integer("created_at").default(unixNow()),
    updatedAt: integer("updated_at").default(unixNow()),
  },
  (t) => [
    uniqueIndex("invoices_doc_series_number_unique")
      .on(t.documentType, t.series, t.number)
      .where(sql`${t.number} IS NOT NULL`),
    index("idx_invoices_payer_type").on(t.payerType),
    index("idx_invoices_payer_tax_id")
      .on(t.payerTaxId)
      .where(sql`${t.payerTaxId} IS NOT NULL`),
  ]
);

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  serviceTypeId: text("service_type_id").references(() => serviceTypes.id),
  description: text("description").notNull(),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  quantity: real("quantity").default(1),
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
  igv: real("igv").notNull(),
  total: real("total").notNull(),
  createdAt: integer("created_at").default(unixNow()),
});

export const laborConfig = sqliteTable("labor_config", {
  id: text("id").primaryKey(),
  hourlyCost: real("hourly_cost").notNull(),
  updatedAt: integer("updated_at").default(unixNow()),
});

export const pricingConfig = sqliteTable("pricing_config", {
  id: text("id").primaryKey(),
  // Mano de obra
  overheadRateLabor: real("overhead_rate_labor").default(0.4),
  // Cotizador
  overheadRateQuote: real("overhead_rate_quote").default(0.2),
  commissionRate: real("commission_rate").default(0.05),
  profitRate: real("profit_rate").default(0.6),
  igvRate: real("igv_rate").default(0.18),
  // Reglas
  allowPriceOverride: integer("allow_price_override", { mode: "boolean" }).default(true),
  allowCostOverride: integer("allow_cost_override", { mode: "boolean" }).default(true),
  updatedAt: integer("updated_at").default(unixNow()),
});

export const quotations = sqliteTable("quotations", {
  id: text("id").primaryKey(),
  quotationNumber: text("quotation_number").notNull().unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  costCenterId: text("cost_center_id").references(() => costCenters.id),
  advisorId: text("advisor_id").references(() => users.id),
  issueDate: integer("issue_date").notNull(),
  validUntil: integer("valid_until").notNull(),
  status: text("status").default("DRAFT"),
  discountMode: text("discount_mode").default("PERCENT"),
  targetTotal: real("target_total"),
  targetTotalIncludesIgv: integer("target_total_includes_igv", { mode: "boolean" }).default(true),
  discountRate: real("discount_rate").default(0),
  subtotal: real("subtotal").default(0),
  discountAmount: real("discount_amount").default(0),
  taxableBase: real("taxable_base").default(0),
  igv: real("igv").default(0),
  total: real("total").default(0),
  notes: text("notes"),
  terms: text("terms"),
  configSnapshot: text("config_snapshot"),
  createdAt: integer("created_at").default(unixNow()),
});

export const quotationLines = sqliteTable("quotation_lines", {
  id: text("id").primaryKey(),
  quotationId: text("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),
  elevatorUnityId: text("elevator_unity_id").references(() => elevatorUnities.id),
  equipmentSerial: text("equipment_serial"),
  description: text("description"),
  orderIndex: integer("order_index").default(0),
  lineMode: text("line_mode").default("CALCULATED"),
  lineModeReason: text("line_mode_reason"),
  manualPrice: real("manual_price"),
  manualPriceIncludesIgv: integer("manual_price_includes_igv", { mode: "boolean" }).default(true),
  supplierName: text("supplier_name"),
  supplierCost: real("supplier_cost"),
  lineOverridePrice: real("line_override_price"),
  lineOverrideReason: text("line_override_reason"),

  totalHours: real("total_hours").default(0),
  hourlyCost: real("hourly_cost").default(0),
  laborCost: real("labor_cost").default(0),

  productCost: real("product_cost").default(0),

  subtotal: real("subtotal").default(0),
  overheadRate: real("overhead_rate").default(0.2),
  overheadAmount: real("overhead_amount").default(0),
  totalCost: real("total_cost").default(0),
  commissionRate: real("commission_rate").default(0.04),
  commissionAmount: real("commission_amount").default(0),
  profitRate: real("profit_rate").default(0.6),
  profitAmount: real("profit_amount").default(0),
  clientValue: real("client_value").default(0),
  igv: real("igv").default(0),
  clientPrice: real("client_price").default(0),

  createdAt: integer("created_at").default(unixNow()),
});

export const quotationLineProducts = sqliteTable("quotation_line_products", {
  id: text("id").primaryKey(),
  quotationLineId: text("quotation_line_id")
    .notNull()
    .references(() => quotationLines.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: real("quantity").default(1),
  unit: text("unit"),
  unitCost: real("unit_cost").notNull(),
  totalCost: real("total_cost"),
  orderIndex: integer("order_index").default(0),
});

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type StaffProfile = typeof staffProfiles.$inferSelect;
export type NewStaffProfile = typeof staffProfiles.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type CostCenter = typeof costCenters.$inferSelect;
export type NewCostCenter = typeof costCenters.$inferInsert;
export type Ubigeo = typeof ubigeos.$inferSelect;
export type NewUbigeo = typeof ubigeos.$inferInsert;
export type CostCenterContact = typeof costCenterContacts.$inferSelect;
export type NewCostCenterContact = typeof costCenterContacts.$inferInsert;
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type ElevatorType = typeof elevatorTypes.$inferSelect;
export type NewElevatorType = typeof elevatorTypes.$inferInsert;
export type ElevatorUnity = typeof elevatorUnities.$inferSelect;
export type NewElevatorUnity = typeof elevatorUnities.$inferInsert;
export type ServiceType = typeof serviceTypes.$inferSelect;
export type NewServiceType = typeof serviceTypes.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type ContractElevator = typeof contractElevators.$inferSelect;
export type NewContractElevator = typeof contractElevators.$inferInsert;
export type SafetyTemplate = typeof safetyTemplates.$inferSelect;
export type NewSafetyTemplate = typeof safetyTemplates.$inferInsert;
export type WorkOrderSafetyRecord = typeof workOrderSafetyRecords.$inferSelect;
export type NewWorkOrderSafetyRecord = typeof workOrderSafetyRecords.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;
export type WorkOrderElevator = typeof workOrderElevators.$inferSelect;
export type NewWorkOrderElevator = typeof workOrderElevators.$inferInsert;
export type WorkOrderTask = typeof workOrderTasks.$inferSelect;
export type NewWorkOrderTask = typeof workOrderTasks.$inferInsert;
export type PreventiveRoute = typeof preventiveRoutes.$inferSelect;
export type NewPreventiveRoute = typeof preventiveRoutes.$inferInsert;
export type PreventiveRouteStop = typeof preventiveRouteStops.$inferSelect;
export type NewPreventiveRouteStop = typeof preventiveRouteStops.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type LaborConfig = typeof laborConfig.$inferSelect;
export type NewLaborConfig = typeof laborConfig.$inferInsert;
export type PricingConfig = typeof pricingConfig.$inferSelect;
export type NewPricingConfig = typeof pricingConfig.$inferInsert;
export type Quotation = typeof quotations.$inferSelect;
export type NewQuotation = typeof quotations.$inferInsert;
export type QuotationLine = typeof quotationLines.$inferSelect;
export type NewQuotationLine = typeof quotationLines.$inferInsert;
export type QuotationLineProduct = typeof quotationLineProducts.$inferSelect;
export type NewQuotationLineProduct = typeof quotationLineProducts.$inferInsert;
