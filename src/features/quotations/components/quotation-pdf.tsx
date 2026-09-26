/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image does not support HTML alt attributes */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const MONTSERRAT_REGULAR = path.join(FONT_DIR, "Montserrat-Regular.ttf");
const MONTSERRAT_BOLD = path.join(FONT_DIR, "Montserrat-Bold.ttf");
let PDF_FONT = "Helvetica";

if (fs.existsSync(MONTSERRAT_REGULAR) && fs.existsSync(MONTSERRAT_BOLD)) {
  Font.register({
    family: "Montserrat",
    fonts: [
      { src: MONTSERRAT_REGULAR },
      { src: MONTSERRAT_BOLD, fontWeight: 700 },
    ],
  });
  PDF_FONT = "Montserrat";
}

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
  lineMode?: string | null;
  lineModeReason?: string | null;
  manualPrice?: number | null;
  manualPriceIncludesIgv?: boolean | null;
  supplierName?: string | null;
  supplierCost?: number | null;
  lineOverridePrice?: number | null;
  lineOverrideReason?: string | null;
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
  discountMode: string;
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

const BRAND = "#DC2626";
const BRAND_SOFT = "#FEF2F2";
const SOFT_BG = "#F3F4F6";
const DARK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E5E7EB";
const ALT_ROW = "#F9FAFB";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9,
    color: DARK,
    backgroundColor: "#FFFFFF",
    paddingTop: 28,
    paddingBottom: 56,
    paddingHorizontal: 36,
    lineHeight: 1.35,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 12,
  },
  logo: {
    width: 180,
    height: 56,
    objectFit: "contain",
  },
  brandTitle: {
    fontSize: 18,
    fontFamily: PDF_FONT,
    color: BRAND,
    letterSpacing: 1.2,
    textAlign: "right",
  },
  brandNumber: {
    fontSize: 11,
    color: MUTED,
    marginTop: 8,
    textAlign: "right",
  },
  companyBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 12,
  },
  companyCol: {
    flexDirection: "column",
    maxWidth: "55%",
  },
  companyLine: {
    fontSize: 8,
    color: DARK,
    marginBottom: 1.5,
  },
  metaBox: {
    width: 220,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: SOFT_BG,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 7.5,
    color: MUTED,
    fontFamily: PDF_FONT,
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 8,
    color: DARK,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: PDF_FONT,
    color: BRAND,
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  clientBlock: {
    backgroundColor: BRAND_SOFT,
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 2,
    marginBottom: 4,
  },
  clientCenter: {
    fontSize: 9.5,
    fontFamily: PDF_FONT,
    color: DARK,
  },
  clientMeta: {
    fontSize: 8,
    color: MUTED,
    marginTop: 1,
  },
  lineBlock: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    marginBottom: 10,
  },
  lineHead: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SOFT_BG,
  },
  lineEquipment: {
    fontSize: 9.5,
    fontFamily: PDF_FONT,
    color: DARK,
  },
  lineDescription: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  lineBody: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND,
    color: "#FFFFFF",
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontFamily: PDF_FONT,
    fontSize: 7.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    fontSize: 8,
  },
  tableRowAlt: {
    backgroundColor: ALT_ROW,
  },
  colDesc: { width: "55%" },
  colHours: { width: "12%", textAlign: "right" },
  colCost: { width: "16%", textAlign: "right" },
  colTotal: { width: "17%", textAlign: "right" },
  colQty: { width: "12%", textAlign: "right" },
  colUnit: { width: "10%", textAlign: "right" },
  colUnitCost: { width: "13%", textAlign: "right" },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  subLabel: {
    fontSize: 8,
    color: MUTED,
  },
  subValue: {
    fontSize: 8,
    color: DARK,
  },
  totalsOuter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  totalsBox: {
    width: 240,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 9,
  },
  totalLabel: {
    color: MUTED,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: BRAND,
    fontFamily: PDF_FONT,
    color: BRAND,
    fontSize: 12,
  },
  termsBlock: {
    backgroundColor: SOFT_BG,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  termsLine: {
    fontSize: 8,
    color: DARK,
    marginBottom: 1.5,
  },
  notesBlock: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  notesText: {
    fontSize: 8,
    color: DARK,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1.5,
    borderTopColor: BRAND,
    paddingTop: 6,
    textAlign: "center",
    fontSize: 7.5,
    color: MUTED,
  },
  footerBold: {
    fontFamily: PDF_FONT,
    color: DARK,
  },
});

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function CalculatedLine({ line }: { line: QuotationPdfLine }) {
  const isOverride = line.lineOverridePrice != null && Number(line.lineOverridePrice) > 0;
  return (
    <View style={styles.lineBody}>
      {line.products.length > 0 ? (
        <>
          <Text style={[styles.subLabel, { marginBottom: 4, fontFamily: PDF_FONT }]}> 
            Materiales
          </Text>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={styles.colDesc}>Descripción</Text>
            <Text style={styles.colQty}>Cant.</Text>
            <Text style={styles.colUnit}>Unidad</Text>
            <Text style={styles.colUnitCost}>Costo unit.</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {line.products.map((p, i) => (
            <View
              key={i}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={styles.colDesc}>{p.description}</Text>
              <Text style={styles.colQty}>{p.quantity}</Text>
              <Text style={styles.colUnit}>{p.unit ?? "—"}</Text>
              <Text style={styles.colUnitCost}>{money(p.unitCost)}</Text>
              <Text style={styles.colTotal}>{money(p.totalCost)}</Text>
            </View>
          ))}
        </>
      ) : null}
      {line.totalHours > 0 ? (
        <>
          <Text
            style={[
              styles.subLabel,
              { marginTop: line.products.length > 0 ? 8 : 0, marginBottom: 4, fontFamily: PDF_FONT },
            ]}
          >
            Mano de obra
          </Text>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={styles.colDesc}>Concepto</Text>
            <Text style={styles.colHours}>Horas</Text>
            <Text style={styles.colCost}>Costo/hora</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDesc}>Servicio técnico</Text>
            <Text style={styles.colHours}>{Number(line.totalHours).toFixed(2)}</Text>
            <Text style={styles.colCost}>{money(line.hourlyCost)}</Text>
            <Text style={styles.colTotal}>{money(line.laborCost)}</Text>
          </View>
        </>
      ) : null}
      <View style={{ marginTop: 6 }}>
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>Subtotal línea</Text>
          <Text style={styles.subValue}>{money(line.subtotal)}</Text>
        </View>
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>Precio de venta (c/IGV)</Text>
          <Text           style={[styles.subValue, isOverride ? { fontFamily: PDF_FONT, color: BRAND } : {}]}>
            {money(isOverride ? line.lineOverridePrice ?? 0 : line.clientPrice)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ManualLine({ line }: { line: QuotationPdfLine }) {
  return (
    <View style={styles.lineBody}>
      <View style={[styles.subRow, { marginBottom: 4 }]}>
        <Text style={styles.subLabel}>Precio de venta (c/IGV)</Text>
        <Text style={[styles.subValue, { fontFamily: PDF_FONT, color: BRAND }]}> 
          {money(line.manualPrice ?? line.clientPrice)}
        </Text>
      </View>
    </View>
  );
}

function Totals({ data }: { data: QuotationPdfData }) {
  const hasDiscount = data.discountAmount > 0;
  return (
    <View style={styles.totalsOuter} wrap={false}>
      <View style={styles.totalsBox}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text>{money(data.subtotal)}</Text>
        </View>
        {hasDiscount ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {data.discountMode === "AMOUNT"
                ? "Descuento (monto fijo)"
                : data.discountMode === "FINAL"
                ? "Descuento aplicado"
                : `Descuento (${Math.round(data.discountRate)}%)`}
            </Text>
            <Text>-{money(data.discountAmount)}</Text>
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Base imponible</Text>
          <Text>{money(data.taxableBase)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>IGV 18%</Text>
          <Text>{money(data.igv)}</Text>
        </View>
        <View style={styles.grandRow}>
          <Text>TOTAL</Text>
          <Text>{money(data.total)}</Text>
        </View>
      </View>
    </View>
  );
}

function TermsBlock({ terms }: { terms: string | null }) {
  if (!terms) return null;
  const lines = terms.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return (
    <View style={styles.termsBlock}>
      {lines.map((line, i) => (
        <Text key={i} style={styles.termsLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function QuotationPDF({ data }: { data: QuotationPdfData }) {
  const equipmentCodes = data.lines
    .map((l) => l.equipment)
    .filter((e): e is string => !!e);
  const equipmentLabel =
    equipmentCodes.length > 0 ? equipmentCodes.join(" / ") : "—";

  return (
    <Document
      title={`Cotización ${data.quotationNumber}`}
      author="HTL Elevadores"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={data.logoUrl} style={styles.logo} fixed />
          <View>
            <Text style={styles.brandTitle}>COTIZACIÓN</Text>
            <Text style={styles.brandNumber}>N° {data.quotationNumber}</Text>
          </View>
        </View>

        <View style={styles.companyBlock}>
          <View style={styles.companyCol}>
            <Text style={styles.companyLine}>Cal. Laurel Rosa Mz. G1 Lote 14</Text>
            <Text style={styles.companyLine}>www.htl-elevadores.com</Text>
            <Text style={styles.companyLine}>Celular: +51 963 207 058</Text>
            <Text style={styles.companyLine}>
              Asesor de Servicio: {data.advisorName ?? "—"}
            </Text>
          </View>
          <View style={styles.metaBox}>
            <MetaRow label="FECHA" value={data.issueDate} />
            <MetaRow label="COTIZACIÓN N°" value={data.quotationNumber} />
            <MetaRow label="EQUIPO" value={equipmentLabel} />
            <MetaRow label="VÁLIDO HASTA" value={data.validUntil} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.clientBlock}>
          {data.costCenterName ? (
            <Text style={styles.clientCenter}>{data.costCenterName}</Text>
          ) : null}
          {data.costCenterAddress ? (
            <Text style={styles.clientMeta}>
              {data.costCenterAddress}
              {data.costCenterDistrict ? `, ${data.costCenterDistrict}` : ""}
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Detalle de Cotización</Text>
        {data.lines.map((line, index) => {
          const isManual = (line.lineMode ?? "CALCULATED") === "MANUAL_PRICE";
          return (
            <View style={styles.lineBlock} key={index} minPresenceAhead={90}>
              <View style={styles.lineHead} wrap={false}>
                {line.equipment ? (
                  <Text style={styles.lineEquipment}>Equipo: {line.equipment}</Text>
                ) : null}
                <Text style={styles.lineDescription}>{line.description}</Text>
              </View>
              {isManual ? <ManualLine line={line} /> : <CalculatedLine line={line} />}
            </View>
          );
        })}

        <Totals data={data} />

        {data.terms ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Términos y Condiciones</Text>
            <TermsBlock terms={data.terms} />
          </View>
        ) : null}

        {data.notes ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <View style={styles.notesBlock}>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            <Text style={styles.footerBold}>Henrry Abner Diaz Cueva</Text> · 963 207 058
          </Text>
          <Text>comercial@htl-elevadores.com</Text>
          <Text style={styles.footerBold}>¡Gracias por trabajar con nosotros!</Text>
        </View>
      </Page>
    </Document>
  );
}

export default QuotationPDF;
