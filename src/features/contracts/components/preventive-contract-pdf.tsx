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
import { resolveClauseText } from "../clause-defaults";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const ARIAL_PATH = path.join(FONT_DIR, "arial.ttf");
const ARIAL_BD_PATH = path.join(FONT_DIR, "arialbd.ttf");

if (fs.existsSync(ARIAL_PATH) && fs.existsSync(ARIAL_BD_PATH)) {
  Font.register({
    family: "Arial",
    fonts: [
      { src: ARIAL_PATH },
      { src: ARIAL_BD_PATH, fontWeight: 700 },
    ],
  });
}

export interface ContractPdfElevator {
  brand: string;
  internalCode: string;
}

export interface ContractTemplateData {
  costCenterName: string;
  costCenterAddress: string;
  costCenterDistrict: string;
  clientSignerName: string;
  clientSignerDocument: string;
  elevatorsCount: number;
  elevators: ContractPdfElevator[];
  elevatorsBrand: string;
  elevatorsInternalCode: string;
  elevatorsFeatures: string;
  baseAmount: string;
  baseAmountText: string;
  currency: string;
  includesIgvText: string;
  paymentTermDays: number;
  currentDay: string;
  currentMonth: string;
  currentYear: string;
  contractDurationYears: number;
  htlFooterUrl: string;
  htlLogoUrl: string;
  htlSignatureUrl: string;
  customClauses?: Record<string, string>;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 140,
    paddingBottom: 80,
    paddingHorizontal: 60,
    fontFamily: "Arial",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#050505",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: 10,
    flexDirection: "row",
  },
  franjaRed: {
    backgroundColor: "#810303",
    width: "50%",
  },
  franjaBlack: {
    backgroundColor: "#000000",
    width: "50%",
  },
  logo: {
    position: "absolute",
    top: 30,
    right: 60,
    width: 140,
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
  },
  footerGraphic: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: 70,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#000000",
  },
  paragraph: {
    marginBottom: 10,
    textAlign: "justify",
  },
  bold: {
    fontWeight: "bold",
  },
  list: {
    marginLeft: 20,
    marginBottom: 10,
  },
  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 60,
  },
  signatureBlock: {
    width: 200,
    alignItems: "center",
  },
  signatureImage: {
    width: 150,
    height: 60,
    objectFit: "contain",
    marginBottom: 5,
  },
  signatureLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#000",
    marginTop: 10,
    paddingTop: 5,
    textAlign: "center",
  },
});

function clause(
  customClauses: Record<string, string> | undefined,
  key: string,
  data: ContractTemplateData
): string {
  return resolveClauseText(customClauses, key, data);
}

export const PreventiveContractPDF: React.FC<ContractTemplateData> = (
  data
) => {
  const cc = data.customClauses;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header repeated on every page: franja 50% roja + 50% negra */}
        <View style={styles.header} fixed wrap={false}>
          <View style={styles.franjaRed} />
          <View style={styles.franjaBlack} />
        </View>

        {/* Logo letterhead on every page */}
        {data.htlLogoUrl && (
          <Image src={data.htlLogoUrl} style={styles.logo} fixed />
        )}

        {/* Footer repeated on every page */}
        {data.htlFooterUrl && (
          <Image src={data.htlFooterUrl} style={styles.footerGraphic} fixed />
        )}

        {/* Dynamic page numbering below the safe zone's bottom edge */}
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
        />

        {/* Contract content (flows inside the page's safe padding) */}
        <Text style={styles.title}>
          CONTRATO DE SERVICIO MANTENIMIENTO PREVENTIVO
        </Text>

        <Text style={styles.paragraph}>
          Conste por el presente documento EL CONTRATO DE PRESTACION DE
          SERVICIOS, que celebran de una parte, la Empresa{" "}
          <Text style={styles.bold}>HTL ELEVADORES S.A.C.</Text> ubicado en
          Calle Laurel Rosa Mz.G1 Lt. 14 Urb. Los Sauces - Surquillo, con RUC.
          20614626241, representada por el Sr. Henrry Abner Diaz Cueva,
          debidamente identificado con D.N.I. No 09521595, Y de la otra parte{" "}
          <Text style={styles.bold}>{data.costCenterName}</Text>, ubicado en{" "}
          {data.costCenterAddress}, {data.costCenterDistrict}, representado por
          el señor {data.clientSignerName}, identificado con DNI{" "}
          {data.clientSignerDocument}, en quien en adelante se les denominará{" "}
          <Text style={styles.bold}>EL CLIENTE</Text>; en los términos y
          condiciones siguientes:
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>PRIMERO.-</Text>{" "}
          {clause(cc, "clause_1", data)}
        </Text>

        <View style={styles.list}>
          {data.elevators.map((elevator, index) => (
            <Text key={index}>
              {`• Equipo ${index + 1}: Marca ${elevator.brand || "—"} | Código Interno: ${elevator.internalCode}`}
            </Text>
          ))}
          {data.elevatorsCount > 0 && (
            <Text>• Cantidad: {data.elevatorsCount} ascensor(es)</Text>
          )}
          <Text>• Características: {data.elevatorsFeatures}</Text>
        </View>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>SEGUNDO.- EL CLIENTE se compromete a:</Text>
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_2_1", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_2_2", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_2_3", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_2_4", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_2_5", data)}
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>
            TERCERO: HTL ELEVADORES S.A.C. se compromete a:
          </Text>
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_3_1", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_3_2", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_3_3", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_3_4", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_3_5", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_3_6", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_3_7", data)}
        </Text>
        <View style={styles.list}>
          <Text>
            {clause(cc, "clause_3_7_1", data)}
          </Text>
          <Text>
            {clause(cc, "clause_3_7_2", data)}
          </Text>
        </View>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>CUARTO: DISPOSICIONES FINALES</Text>
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_4_1", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_4_2", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_4_3", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_4_4", data)}
        </Text>
        <Text style={styles.paragraph}>
          {clause(cc, "clause_4_5", data)}
        </Text>

        <Text style={[styles.paragraph, { marginTop: 20 }]}>
          Conforme con todas las cláusulas anteriores, firman las partes por
          duplicado en la ciudad de Lima a los {data.currentDay} días del mes de{" "}
          {data.currentMonth} del {data.currentYear}.
        </Text>

        {/* Signature blocks */}
        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureBlock}>
            <View style={{ height: 60 }} />
            <Text style={styles.signatureLine}>{data.costCenterName}</Text>
          </View>

          <View style={styles.signatureBlock}>
            {data.htlSignatureUrl && (
              <Image src={data.htlSignatureUrl} style={styles.signatureImage} />
            )}
            <Text style={styles.signatureLine}>HTL ELEVADORES</Text>
            <Text>HENRRY DIAZ CUEVA</Text>
            <Text>DNI: 09521595</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};