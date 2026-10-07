/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image does not support HTML alt attributes */
import React from "react";
import { marked } from "marked";
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
  Font,
} from "@react-pdf/renderer";


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
    family: "Montserrat",
    fonts: [
      { src: MONTSERRAT_REGULAR },
      { src: MONTSERRAT_BOLD, fontWeight: 700 },
      { src: MONTSERRAT_ITALIC, fontStyle: "italic" },
      { src: MONTSERRAT_BOLD_ITALIC, fontWeight: 700, fontStyle: "italic" },
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

export interface QuotationPdfImage {
  url: string;
  caption: string | null;
  isReferenceOnly?: boolean | null;
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
  signatureUrl: string;
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
  showTaxBreakdown: boolean;
  discountRate: number;
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  igv: number;
  total: number;
  welcomeMessage: string | null;
  closeMessage: string | null;
  paymentTerms: string | null;
  executionTime: string | null;
  workingHours: string | null;
  validityDays: number;
  images: QuotationPdfImage[];
  lines: QuotationPdfLine[];
}

const BRAND = "#810303";
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
    paddingTop: 35,
    paddingBottom: 60,
    paddingHorizontal: 35,
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
    fontSize: 16,
    fontFamily: PDF_FONT,
    color: DARK,
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
    fontSize: 9,
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
    fontSize: 11,
    fontFamily: PDF_FONT,
    color: BRAND,
    marginTop: 12,
    marginBottom: 14,
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
    fontSize: 10,
    color: DARK,
    marginTop: 2,
  },
  lineBody: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  lineFinalPrice: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    fontSize: 9.5,
    fontFamily: PDF_FONT,
    color: DARK,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND,
    color: "#FFFFFF",
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontFamily: PDF_FONT,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    fontSize: 9,
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
    fontSize: 10,
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
    color: DARK,
    fontSize: 10,
    fontWeight: "bold",
  },
  termsBlock: {
    backgroundColor: SOFT_BG,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  termsLine: {
    fontSize: 9.5,
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
  markdownParagraph: {
    fontSize: 9.5,
    color: DARK,
    lineHeight: 1.4,
    marginBottom: 10,
  },
  markdownHeading: {
    fontSize: 12,
    color: DARK,
    fontFamily: PDF_FONT,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 8,
  },
  markdownList: {
    marginBottom: 10,
  },
  markdownListItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  markdownBullet: {
    width: 16,
    fontSize: 10,
    color: DARK,
  },
  markdownListContent: {
    flex: 1,
    fontSize: 9.5,
    color: DARK,
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 35,
    right: 35,
    borderTopWidth: 1.5,
    borderTopColor: BRAND,
    paddingTop: 6,
    textAlign: "center",
    fontSize: 8,
    color: MUTED,
  },
  footerBold: {
    fontFamily: PDF_FONT,
    color: DARK,
  },
  closing: {
    marginTop: 30,
    color: DARK,
  },
  closingText: { fontSize: 10, marginBottom: 2 },
  closingSignoff: { fontSize: 10, marginTop: 8, marginBottom: 2 },
  closingCompany: { fontSize: 12, fontFamily: PDF_FONT, fontWeight: "bold", marginTop: 6, marginBottom: 10 },
  signature: { width: 150, height: 54, objectFit: "contain", objectPosition: "left center", marginBottom: 6 },
  signerName: { fontSize: 10, fontFamily: PDF_FONT, fontWeight: "bold" },
  signerRole: { fontSize: 9, color: "#4B5563" },
  bankPage: { fontFamily: PDF_FONT, color: DARK, fontSize: 10, lineHeight: 1.5 },
  bankTitle: { fontSize: 18, fontFamily: PDF_FONT, color: BRAND, paddingBottom: 8, marginBottom: 20 },
  bankIntro: { fontSize: 10, marginBottom: 10 },
  bankSection: { fontSize: 12, fontFamily: PDF_FONT, color: BRAND, marginTop: 18, marginBottom: 8 },
  bankCard: { backgroundColor: SOFT_BG, borderLeftWidth: 4, borderLeftColor: BRAND, padding: 12, borderRadius: 4, marginBottom: 10 },
  bankName: { fontFamily: PDF_FONT, marginBottom: 6 },
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
    </View>
  );
}

function ManualLine(_props: { line: QuotationPdfLine }) {
  void _props;
  return null;
}

function Totals({ data }: { data: QuotationPdfData }) {
  if (!data.showTaxBreakdown) {
    return (
      <View style={styles.totalsOuter} wrap={false}>
        <View style={styles.totalsBox}>
          <View style={styles.grandRow}>
             <Text>TOTAL (Se incluye el IGV)</Text>
            <Text>{money(data.total)}</Text>
          </View>
        </View>
      </View>
    );
  }

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

function MarkdownBlock({ value }: { value: string | null }) {
  if (!value) return null;
  const inline = (text: string, keyPrefix: string) => text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <Text key={`${keyPrefix}-${index}`} style={{ fontFamily: PDF_FONT, fontWeight: "bold" }}>{part.slice(2, -2)}</Text>;
    if (part.startsWith("*") && part.endsWith("*")) return <Text key={`${keyPrefix}-${index}`} style={{ fontFamily: PDF_FONT, fontStyle: "italic" }}>{part.slice(1, -1)}</Text>;
    return part;
  });
  const tokens = marked.lexer(value);
  return (
    <View style={styles.notesBlock}>
      {tokens.map((token, index) => {
        if (token.type === "list") {
          return <View key={index} style={styles.markdownList}>{token.items.map((item: { text: string }, itemIndex: number) => <View key={itemIndex} style={styles.markdownListItem}><Text style={styles.markdownBullet}>{token.ordered ? `${itemIndex + 1}.` : "•"}</Text><Text style={styles.markdownListContent}>{inline(item.text, `${index}-${itemIndex}`)}</Text></View>)}</View>;
        }
        if (token.type === "space") return null;
        const text = "text" in token ? token.text : "";
        if (token.type === "heading") return <Text key={index} style={styles.markdownHeading}>{inline(text, String(index))}</Text>;
        return <Text key={index} style={styles.markdownParagraph}>{inline(text, String(index))}</Text>;
      })}
    </View>
  );
}

export function QuotationPDF({ data }: { data: QuotationPdfData }) {
  const equipmentCodes = Array.from(
    new Set(
      data.lines
        .map((l) => l.equipment)
        .filter((e): e is string => !!e),
    ),
  );
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
            <Link src="https://htl-elevadores.com/" style={[styles.companyLine, { textDecoration: "none" }]}>www.htl-elevadores.com</Link>
            <Text style={styles.companyLine}>Celular: +51 963 207 058</Text>
            <Text style={styles.companyLine}>
              Asesor de Servicio: {data.advisorName ?? "—"}
            </Text>
          </View>
          <View style={styles.metaBox}>
            <MetaRow label="FECHA" value={data.issueDate} />
            <MetaRow label="COTIZACIÓN N°" value={data.quotationNumber} />
            <MetaRow label={equipmentCodes.length > 1 ? "EQUIPOS" : "EQUIPO"} value={equipmentLabel} />
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

        {data.welcomeMessage ? (
          <View wrap={false} style={styles.notesBlock}>
            <MarkdownBlock value={data.welcomeMessage} />
          </View>
        ) : null}

        <View wrap={false}>
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
                 <View style={styles.lineFinalPrice} wrap={false}>
                   <Text>
                     {line.equipment
                       ? line.manualPriceIncludesIgv
                         ? "Precio por Equipo (Incluye IGV):"
                         : "Precio por Equipo:"
                       : line.manualPriceIncludesIgv
                         ? "Precio por Servicio (Incluye IGV):"
                         : "Precio por Servicio:"}
                   </Text>
                   <Text>{money(line.clientPrice)}</Text>
                 </View>
               </View>
               {isManual ? <ManualLine line={line} /> : <CalculatedLine line={line} />}
             </View>
           );
        })}
        </View>

        <View wrap={false}><Totals data={data} /></View>

        {data.paymentTerms || data.executionTime || data.workingHours ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Términos y Condiciones</Text>
            {data.paymentTerms ? <Text style={styles.termsLine}>Forma de Pago: {data.paymentTerms}</Text> : null}
            {data.executionTime ? <Text style={styles.termsLine}>Ejecución: {data.executionTime}</Text> : null}
            {data.workingHours ? <Text style={styles.termsLine}>Horario: {data.workingHours}</Text> : null}
            <Text style={styles.termsLine}>Validez de la Oferta: {data.validityDays} días</Text>
          </View>
        ) : null}

        {data.images.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Imágenes referenciales</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: data.images.length === 1 ? "center" : "flex-start", gap: 8 }}>
              {data.images.map((image, index) => (
                <View key={index} style={{ width: data.images.length === 1 ? 240 : "48%", alignItems: "center" }}>
                  <Image src={image.url} style={{ width: "100%", height: 160, objectFit: "contain", backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 4 }} />
                  {image.caption ? <Text style={styles.termsLine}>{image.caption}</Text> : null}
                  {image.isReferenceOnly ? <Text style={[styles.termsLine, { color: "#9CA3AF", fontStyle: "italic" }]}>Imagen referencial</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.closing} wrap={false}>
          <Text style={styles.closingText}>
            {data.closeMessage || "Sabemos lo importante que es el funcionamiento de su ascensor en su edificio. Quedamos a su total disposición para programar la reparación a la brevedad y garantizar la seguridad de todos los usuarios. Sin otro particular, me despido."}
          </Text>
          <Text style={styles.closingText}>Sin otro particular, me despido.</Text>
          <Text style={styles.closingText}>Saludos.</Text>
          <Text style={styles.closingSignoff}>Atentamente,</Text>
          <Text style={styles.closingCompany}>HTL ELEVADORES S.A.C.</Text>
          <Image src={data.signatureUrl} style={styles.signature} />
          <Text style={styles.signerName}>Henrry Abner Diaz Cueva</Text>
          <Text style={styles.signerRole}>División Comercial</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            <Text style={styles.footerBold}>Henrry Abner Diaz Cueva</Text> · 963 207 058
          </Text>
          <Text>comercial@htl-elevadores.com</Text>
          <Text style={styles.footerBold}>¡Gracias por trabajar con nosotros!</Text>
        </View>
      </Page>
      <Page size="A4" style={[styles.page, styles.bankPage]}>
        <Image src={data.logoUrl} style={{ width: 120, height: 38, objectFit: "contain", marginBottom: 28 }} />
        <Text style={styles.bankTitle}>CUENTAS BANCARIAS</Text>
        <Text style={styles.bankIntro}>El presente documento tiene como objetivo centralizar y detallar la información de las cuentas bancarias oficiales de HTL ELEVADORES S.A.C.</Text>
        <Text style={styles.bankIntro}>Está dirigido a clientes, proveedores e inversionistas que requieran realizar pagos o validaciones financieras de forma rápida y segura.</Text>
        <Text style={styles.bankIntro}>De esta manera, se asegura transparencia en las operaciones, evitando confusiones o el uso de cuentas no autorizadas.</Text>
        <Text style={styles.bankSection}>DATOS DE LA EMPRESA</Text>
        <Text>Razón Social: HTL ELEVADORES S.A.C.</Text>
        <Text>RUC: 20614626241</Text>
        <Text style={styles.bankSection}>CUENTAS BANCARIAS</Text>
        <View style={styles.bankCard}><Text style={styles.bankName}>Banco Scotiabank — Soles</Text><Text>Cuenta Corriente: 00004711247</Text><Text>Cuenta Interbancaria (CCI): 009230000000471124749</Text></View>
        <View style={styles.bankCard}><Text style={styles.bankName}>Banco de la Nación — Detracciones</Text><Text>Cuenta Detracción: 00058555770</Text></View>
        <Text style={styles.bankSection}>USO Y ALCANCE</Text>
        <Text>Las cuentas listadas son de uso exclusivo para:</Text>
        <Text>• Pagos por servicios de mantenimiento y proyectos de ascensores.</Text>
        <Text>• Depósitos de detracciones según normativa vigente.</Text>
        <Text>• Operaciones seguras y verificables, asociadas únicamente al RUC 20614626241.</Text>
        <Text style={styles.bankSection}>RECOMENDACIONES DE USO</Text>
        <Text>• Antes de transferir, verifique que el titular sea HTL ELEVADORES S.A.C.</Text>
        <Text>• Remita el voucher a comercial@htl-elevadores.com indicando número de factura.</Text>
        <Text>• No se aceptan pagos en cuentas distintas a las indicadas.</Text>
        <View style={styles.footer} fixed><Text><Text style={styles.footerBold}>Henrry Abner Diaz Cueva</Text> · +51 963 207 058</Text><Text>comercial@htl-elevadores.com</Text><Text style={styles.footerBold}>¡Gracias por trabajar con nosotros!</Text></View>
      </Page>
    </Document>
  );
}

export default QuotationPDF;
