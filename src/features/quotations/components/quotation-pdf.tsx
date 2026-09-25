/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image does not support HTML alt attributes */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

export const money = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  return n.toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });
};

export const dateEs = (value: number | null | undefined): string => {
  if (!value) return "—";
  return new Date(value * 1000).toLocaleDateString("es-PE");
};

export interface QuotationPdfProduct {
  description: string;
  quantity: number;
  unit: string | null;
  unitCost: number;
  totalCost: number;
}

export interface QuotationPdfLine {
  equipment: string | null;
  description: string;
  totalHours: number;
  hourlyCost: number;
  productCost: number;
  laborCost: number;
  subtotal: number;
  overheadRate: number;
  overheadAmount: number;
  totalCost: number;
  commissionRate: number;
  commissionAmount: number;
  profitRate: number;
  profitAmount: number;
  clientValue: number;
  igv: number;
  clientPrice: number;
  products: QuotationPdfProduct[];
}

export interface QuotationPdfData {
  logoUrl: string;
  quotationNumber: string;
  clientName: string;
  clientTaxId: string | null;
  costCenterName: string | null;
  costCenterAddress: string | null;
  costCenterDistrict: string | null;
  advisorName: string | null;
  status: string;
  issueDate: string;
  validUntil: string;
  discountRate: number;
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  igv: number;
  total: number;
  notes: string | null;
  terms: string | null;
  lines: QuotationPdfLine[];
}

const BRAND = "#B91C1C";
const DARK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Arial",
    fontSize: 9,
    color: DARK,
    backgroundColor: "#FFFFFF",
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 36,
    lineHeight: 1.35,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 14,
  },
  logo: {
    width: 120,
    height: 48,
    objectFit: "contain",
  },
  companyText: {
    textAlign: "right",
    fontSize: 7.5,
    color: MUTED,
  },
  companyName: {
    fontSize: 10,
    fontWeight: "bold",
    color: DARK,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: BRAND,
    letterSpacing: 1,
  },
  number: {
    fontSize: 11,
    fontWeight: "bold",
    color: DARK,
  },
  metaBlock: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    width: 92,
    color: MUTED,
  },
  metaValue: {
    flex: 1,
  },
  status: {
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    backgroundColor: BRAND,
    color: "#FFFFFF",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  lineBlock: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    marginBottom: 10,
    overflow: "hidden",
  },
  lineHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  lineTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
  },
  lineEquipment: {
    fontSize: 8,
    color: MUTED,
  },
  lineBody: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  table: {
    width: "100%",
    marginBottom: 4,
  },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 3,
    fontSize: 7.5,
    color: MUTED,
    fontWeight: "bold",
  },
  td: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 3,
    fontSize: 8,
  },
  colDesc: { width: "52%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "10%", textAlign: "right" },
  colCost: { width: "14%", textAlign: "right" },
  colTotal: { width: "14%", textAlign: "right" },
  calcGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  calcItem: {
    width: "33.33%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    fontSize: 7.5,
  },
  calcLabel: { color: MUTED },
  totalsBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  totalsInner: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  totalRowLabel: { color: MUTED },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    backgroundColor: BRAND,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  noteBlock: {
    marginTop: 12,
  },
  noteLabel: {
    fontWeight: "bold",
    fontSize: 8.5,
    marginBottom: 3,
  },
  noteText: {
    fontSize: 8,
    color: MUTED,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    textAlign: "center",
    fontSize: 7,
    color: MUTED,
  },
});

export function QuotationPDF({ data }: { data: QuotationPdfData }) {
  return (
    <Document
      title={`Cotización ${data.quotationNumber}`}
      author="HTL Elevadores"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={data.logoUrl} style={styles.logo} fixed />
          <View style={styles.companyText}>
            <Text style={styles.companyName}>HTL ELEVADORES S.A.C.</Text>
            <Text>Av. Los Constructores N° 123, Urb. Santa Patricia</Text>
            <Text>La Molina – Lima – Perú</Text>
            <Text>RUC: 20555678910</Text>
            <Text>Tel: (01) 555-1234 | ventas@htlelevadores.pe</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>COTIZACIÓN DE SERVICIOS</Text>
          <Text style={styles.number}>{data.quotationNumber}</Text>
        </View>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Cliente</Text>
            <Text style={styles.metaValue}>
              {data.clientName}
              {data.clientTaxId ? `  (RUC: ${data.clientTaxId})` : ""}
            </Text>
          </View>
          {data.costCenterName ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Sede</Text>
              <Text style={styles.metaValue}>
                {data.costCenterName}
                {data.costCenterAddress
                  ? ` — ${data.costCenterAddress}${data.costCenterDistrict ? `, ${data.costCenterDistrict}` : ""}`
                  : ""}
              </Text>
            </View>
          ) : null}
          {data.advisorName ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Asesor</Text>
              <Text style={styles.metaValue}>{data.advisorName}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fechas</Text>
            <Text style={styles.metaValue}>
              Emisión: {data.issueDate} — Válida hasta: {data.validUntil}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Estado</Text>
            <Text style={styles.metaValue}>
              <Text style={styles.status}>{data.status}</Text>
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>DETALLE</Text>

        {data.lines.map((line, index) => (
          <View style={styles.lineBlock} key={index} wrap={false}>
            <View style={styles.lineHead}>
              <View>
                <Text style={styles.lineTitle}>
                  {String(index + 1).padStart(2, "0")}. {line.description}
                </Text>
                {line.equipment ? (
                  <Text style={styles.lineEquipment}>
                    Equipo: {line.equipment}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.lineTitle}>{money(line.clientPrice)}</Text>
            </View>
            <View style={styles.lineBody}>
              {line.products.length > 0 ? (
                <View style={styles.table}>
                  <View style={styles.th}>
                    <Text style={styles.colDesc}>Descripción</Text>
                    <Text style={styles.colQty}>Cant.</Text>
                    <Text style={styles.colUnit}>Und</Text>
                    <Text style={styles.colCost}>C. Unit.</Text>
                    <Text style={styles.colTotal}>Total</Text>
                  </View>
                  {line.products.map((p, i) => (
                    <View style={styles.td} key={i}>
                      <Text style={styles.colDesc}>{p.description}</Text>
                      <Text style={styles.colQty}>{p.quantity}</Text>
                      <Text style={styles.colUnit}>{p.unit ?? "—"}</Text>
                      <Text style={styles.colCost}>{money(p.unitCost)}</Text>
                      <Text style={styles.colTotal}>{money(p.totalCost)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.calcGrid}>
                <View style={styles.calcItem}>
                  <Text style={styles.calcLabel}>Materiales</Text>
                  <Text>{money(line.productCost)}</Text>
                </View>
                <View style={styles.calcItem}>
                  <Text style={styles.calcLabel}>Mano de obra</Text>
                  <Text>
                    {line.totalHours} h × {money(line.hourlyCost)} ={" "}
                    {money(line.laborCost)}
                  </Text>
                </View>
                <View style={styles.calcItem}>
                  <Text style={styles.calcLabel}>Subtotal</Text>
                  <Text>{money(line.subtotal)}</Text>
                </View>
                <View style={styles.calcItem}>
                  <Text style={styles.calcLabel}>
                    Gastos generales ({Math.round(line.overheadRate * 100)}%)
                  </Text>
                  <Text>{money(line.overheadAmount)}</Text>
                </View>
                <View style={styles.calcItem}>
                  <Text style={styles.calcLabel}>
                    Comisión ({Math.round(line.commissionRate * 100)}%)
                  </Text>
                  <Text>{money(line.commissionAmount)}</Text>
                </View>
                <View style={styles.calcItem}>
                  <Text style={styles.calcLabel}>
                    Margen ({Math.round(line.profitRate * 100)}%)
                  </Text>
                  <Text>{money(line.profitAmount)}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsInner}>
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Subtotal (sin IGV)</Text>
              <Text>{money(data.subtotal)}</Text>
            </View>
            {data.discountRate > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>
                  Descuento ({Math.round(data.discountRate * 100)}%)
                </Text>
                <Text>-{money(data.discountAmount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Base imponible</Text>
              <Text>{money(data.taxableBase)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>IGV (18%)</Text>
              <Text>{money(data.igv)}</Text>
            </View>
            <View style={styles.grandTotal}>
              <Text>TOTAL</Text>
              <Text>{money(data.total)}</Text>
            </View>
          </View>
        </View>

        {data.notes ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Notas</Text>
            <Text style={styles.noteText}>{data.notes}</Text>
          </View>
        ) : null}

        {data.terms ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Condiciones</Text>
            <Text style={styles.noteText}>{data.terms}</Text>
          </View>
        ) : null}

        <Text
          style={{
            position: "absolute",
            bottom: 40,
            left: 36,
            right: 36,
            fontSize: 7.5,
            color: DARK,
          }}
        >
          Atentamente,
        </Text>

        <View style={styles.footer}>
          <Text>
            Documento de referencia, no constituye factura. HTL ELEVADORES S.A.C.
            — {data.quotationNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}