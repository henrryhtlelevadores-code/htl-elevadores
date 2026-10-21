/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image does not support HTML alt attributes */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { WorkOrderReportData } from "../work-order-report";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const MONTSERRAT_REGULAR = path.join(FONT_DIR, "Montserrat-Regular.ttf");
const MONTSERRAT_BOLD = path.join(FONT_DIR, "Montserrat-Bold.ttf");
const MONTSERRAT_ITALIC = path.join(FONT_DIR, "Montserrat-Italic.ttf");
const MONTSERRAT_BOLD_ITALIC = path.join(FONT_DIR, "Montserrat-BoldItalic.ttf");
let PDF_FONT = "Helvetica";

if (
  fs.existsSync(MONTSERRAT_REGULAR) &&
  fs.existsSync(MONTSERRAT_BOLD) &&
  fs.existsSync(MONTSERRAT_ITALIC) &&
  fs.existsSync(MONTSERRAT_BOLD_ITALIC)
) {
  Font.register({
    family: "MontserratReport",
    fonts: [
      { src: MONTSERRAT_REGULAR },
      { src: MONTSERRAT_BOLD, fontWeight: 700 },
      { src: MONTSERRAT_ITALIC, fontStyle: "italic" },
      { src: MONTSERRAT_BOLD_ITALIC, fontWeight: 700, fontStyle: "italic" },
    ],
  });
  PDF_FONT = "MontserratReport";
}

const BRAND = "#810303";
const BRAND_SOFT = "#FEE2E2";
const BRAND_TEXT = "#991B1B";
const DARK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E5E7EB";
const SOFT_BG = "#F8FAFC";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9,
    color: DARK,
    backgroundColor: "#FFFFFF",
    paddingTop: 35,
    paddingBottom: 58,
    paddingHorizontal: 35,
    lineHeight: 1.45,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 12,
  },
  logo: { width: 160, height: 46, objectFit: "contain" },
  headerRight: { alignItems: "flex-end", width: 240 },
  headerTitle: {
    fontSize: 12.5,
    fontWeight: 700,
    color: BRAND,
    letterSpacing: 0.7,
    textAlign: "right",
    lineHeight: 1.2,
  },
  headerSubtitle: {
    fontSize: 8,
    color: MUTED,
    marginTop: 4,
    textAlign: "right",
  },
  headerDate: { fontSize: 7.5, color: DARK, marginTop: 3, fontWeight: 700 },

  infoBand: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 18,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: SOFT_BG,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginTop: 14,
    marginBottom: 14,
  },
  companyCol: { width: "42%" },
  companyLine: { fontSize: 7.2, color: MUTED, marginBottom: 2 },
  metaBox: { flex: 1, alignItems: "flex-end" },
  metaLabel: {
    fontSize: 6.2,
    color: MUTED,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  clienteName: {
    fontSize: 9,
    fontWeight: 700,
    color: DARK,
    textAlign: "right",
    lineHeight: 1.35,
    maxWidth: "100%",
  },
  metaInline: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 7,
  },
  metaInlineItem: { alignItems: "flex-end" },
  metaValue: { fontSize: 7.4, fontWeight: 700, color: DARK, textAlign: "right" },

  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  costCenterName: { fontSize: 10.5, fontWeight: 700 },
  costCenterMeta: { fontSize: 8, color: MUTED, marginTop: 2 },

  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 14,
  },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: SOFT_BG,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  summaryLabel: {
    fontSize: 6.2,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },

  emptyBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: SOFT_BG,
    padding: 16,
    alignItems: "center",
  },
  emptyText: { fontSize: 8.5, color: MUTED },

  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: SOFT_BG,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 5,
    marginBottom: 7,
  },
  cardOt: {
    fontSize: 8.4,
    fontWeight: 700,
    color: DARK,
    letterSpacing: 0.2,
  },
  cardBody: { flexDirection: "row", gap: 10 },
  colService: { flex: 1.6 },
  colTech: { flex: 1 },
  colEquipment: { flex: 1.3 },
  colSchedule: { flex: 1.1 },
  fieldLabel: {
    fontSize: 5.8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.45,
    marginBottom: 2,
  },
  fieldValue: { fontSize: 7.2, color: DARK, lineHeight: 1.35 },
  fieldValueBold: { fontSize: 7.3, fontWeight: 700, color: DARK },
  fieldMuted: { fontSize: 6.5, color: MUTED, marginTop: 2, lineHeight: 1.35 },
  statusPending: {
    fontSize: 6.4,
    fontWeight: 700,
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  statusProgress: {
    fontSize: 6.4,
    fontWeight: 700,
    color: "#1D4ED8",
    backgroundColor: "#DBEAFE",
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },

  annexTitleBlock: { marginTop: 18, marginBottom: 14 },
  annexTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: BRAND,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  annexSubtitle: {
    fontSize: 9.5,
    fontWeight: 700,
    color: DARK,
    letterSpacing: 0.6,
  },
  annexRule: {
    width: 42,
    height: 2,
    backgroundColor: BRAND,
    marginTop: 9,
  },
  annexIntro: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.5,
    marginBottom: 12,
  },
  equipmentBlock: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    marginBottom: 10,
  },
  equipmentHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: SOFT_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  equipmentCode: {
    fontSize: 7.2,
    fontWeight: 400,
    color: BRAND_TEXT,
    backgroundColor: BRAND_SOFT,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    letterSpacing: 0.3,
  },
  equipmentName: { fontSize: 8.6, fontWeight: 700, flex: 1 },
  moduleBlock: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 5 },
  moduleTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: DARK,
    marginBottom: 4,
  },
  moduleCode: { color: BRAND },
  taskRow: { flexDirection: "row", marginBottom: 1.6 },
  taskNumber: {
    width: 14,
    fontSize: 7,
    color: MUTED,
    textAlign: "right",
    paddingRight: 4,
  },
  taskText: { flex: 1, fontSize: 7.1, color: "#334155", lineHeight: 1.35 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: MUTED,
  },
  footerBold: { fontWeight: 700, color: DARK },
});

function formatScheduled(date: string | null, time: string | null): string {
  if (!date) return time ?? "Sin programar";
  const [year, month, day] = date.split("-").map(Number);
  const formatted = new Date(year, month - 1, day).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return time ? `${formatted} · ${time}` : formatted;
}

function statusLabel(status: string) {
  if (status === "IN_PROGRESS") {
    return { label: "En curso", style: styles.statusProgress };
  }
  return { label: "Pendiente", style: styles.statusPending };
}

function Header({ data, short = false }: { data: WorkOrderReportData; short?: boolean }) {
  return (
    <View style={styles.header}>
      {data.logoUrl ? (
        <Image src={data.logoUrl} style={styles.logo} fixed />
      ) : (
        <Text style={styles.headerTitle}>HTL ELEVADORES</Text>
      )}
      <View style={styles.headerRight}>
        <Text style={styles.headerTitle}>
          {short ? "ANEXO 1" : "REPORTE DE ÓRDENES DE TRABAJO"}
        </Text>
        <Text style={styles.headerSubtitle}>
          {short ? "Faenas de mantenimiento" : data.costCenterName}
        </Text>
        <Text style={styles.headerDate}>Emitido: {data.generatedAt}</Text>
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>
        <Text style={styles.footerBold}>Henrry Abner Diaz Cueva</Text> · 963 207
        058
      </Text>
      <Text>comercial@htl-elevadores.com</Text>
      <Text style={styles.footerBold}>HTL ELEVADORES S.A.C.</Text>
    </View>
  );
}

export function WorkOrderReportPDF({ data }: { data: WorkOrderReportData }) {
  const preventiveOrders = data.orders.filter((order) => {
    const code = order.serviceTypeCode?.toUpperCase() ?? "";
    const name = order.serviceTypeName?.toLowerCase() ?? "";
    return code.includes("PREV") || name.includes("preventiv");
  });
  const longClientName = data.clientName.length > 60;

  return (
    <Document
      title={`Reporte de OTs - ${data.costCenterName}`}
      author="HTL Elevadores"
    >
      <Page size="A4" style={styles.page}>
        <Header data={data} />

        <View style={styles.infoBand}>
          <View style={styles.companyCol}>
            <Text style={styles.companyLine}>Cal. Laurel Rosa Mz. G1 Lote 14</Text>
            <Link
              src="https://htl-elevadores.com/"
              style={[styles.companyLine, { textDecoration: "none" }]}
            >
              www.htl-elevadores.com
            </Link>
            <Text style={styles.companyLine}>Celular: +51 963 207 058</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Cliente</Text>
            <Text
              style={[
                styles.clienteName,
                { fontSize: longClientName ? 7.8 : 9 },
              ]}
            >
              {data.clientName}
            </Text>
            <View style={styles.metaInline}>
              {data.clientTaxId ? (
                <View style={styles.metaInlineItem}>
                  <Text style={styles.metaLabel}>RUC</Text>
                  <Text style={styles.metaValue}>{data.clientTaxId}</Text>
                </View>
              ) : null}
              <View style={styles.metaInlineItem}>
                <Text style={styles.metaLabel}>Reporte emitido</Text>
                <Text style={styles.metaValue}>{data.generatedAt}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Centro de Costos</Text>
        <Text style={styles.costCenterName}>{data.costCenterName}</Text>
        {data.costCenterAddress ? (
          <Text style={styles.costCenterMeta}>
            {data.costCenterAddress}
            {data.costCenterDistrict ? `, ${data.costCenterDistrict}` : ""}
          </Text>
        ) : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>OTs pendientes</Text>
            <Text style={styles.summaryValue}>{data.orders.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>OTs preventivas</Text>
            <Text style={styles.summaryValue}>{preventiveOrders.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Equipos en anexo</Text>
            <Text style={styles.summaryValue}>{data.annex.length}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Órdenes de trabajo pendientes</Text>

        {data.orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No hay órdenes de trabajo pendientes para este centro de costos.
            </Text>
          </View>
        ) : (
          <View>
            {data.orders.map((order) => {
              const status = statusLabel(order.status);
              return (
                <View key={order.otNumber} style={styles.card} wrap={false}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardOt}>{order.otNumber}</Text>
                    <Text style={status.style}>{status.label}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.colService}>
                      <Text style={styles.fieldLabel}>Servicio</Text>
                      <Text style={styles.fieldValueBold}>
                        {order.serviceTypeName ?? "Sin tipo de servicio"}
                      </Text>
                      {order.description ? (
                        <Text style={styles.fieldMuted}>{order.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.colTech}>
                      <Text style={styles.fieldLabel}>Técnico</Text>
                      <Text style={styles.fieldValue}>
                        {order.technicianName ?? "Por asignar"}
                      </Text>
                    </View>
                    <View style={styles.colEquipment}>
                      <Text style={styles.fieldLabel}>Equipo(s)</Text>
                      {order.equipments.length === 0 ? (
                        <Text style={styles.fieldValue}>—</Text>
                      ) : (
                        order.equipments.map((equipment) => (
                          <Text
                            key={`${order.otNumber}-${equipment.internalCode}`}
                            style={styles.fieldValue}
                          >
                            {equipment.internalCode} · {equipment.name}
                          </Text>
                        ))
                      )}
                    </View>
                    <View style={styles.colSchedule}>
                      <Text style={styles.fieldLabel}>Programación</Text>
                      <Text style={styles.fieldValue}>
                        {formatScheduled(order.scheduledDate, order.scheduledTime)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Footer />
      </Page>

      {data.annex.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Header data={data} short />

          <View style={styles.annexTitleBlock}>
            <Text style={styles.annexTitle}>ANEXO 1</Text>
            <Text style={styles.annexSubtitle}>FAENAS DE MANTENIMIENTO</Text>
            <View style={styles.annexRule} />
          </View>

          <Text style={styles.annexIntro}>
            A continuación se detallan, por equipo, los módulos de mantenimiento
            preventivo y las tareas asociadas a las órdenes de trabajo pendientes
            de este centro de costos.
          </Text>

          {data.annex.map((equipment) => (
            <View
              key={equipment.internalCode}
              style={styles.equipmentBlock}
              minPresenceAhead={60}
            >
              <View style={styles.equipmentHead} wrap={false}>
                <Text style={styles.equipmentCode}>
                  {equipment.internalCode}
                </Text>
                <Text style={styles.equipmentName}>{equipment.name}</Text>
              </View>
              {equipment.modules.map((module) => (
                <View
                  key={`${equipment.internalCode}-${module.code}`}
                  style={styles.moduleBlock}
                  minPresenceAhead={36}
                >
                  <Text style={styles.moduleTitle}>
                    <Text style={styles.moduleCode}>{module.code}</Text>
                    {" · "}
                    {module.name}
                  </Text>
                  {module.tasks.map((task, index) => (
                    <View
                      key={`${module.code}-${task}`}
                      style={styles.taskRow}
                    >
                      <Text style={styles.taskNumber}>{index + 1}.</Text>
                      <Text style={styles.taskText}>{task}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}

          <Footer />
        </Page>
      ) : null}
    </Document>
  );
}
