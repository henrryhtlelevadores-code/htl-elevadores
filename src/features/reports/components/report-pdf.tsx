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

export interface ReportPdfTask {
  id: string;
  taskDescription: string;
  isCritical: boolean;
  isCompleted: boolean;
  observations: string | null;
  moduleCode: string | null;
  moduleName: string | null;
}

export interface ReportPdfPhoto {
  id: string;
  url: string;
  tag: string;
  description: string | null;
}

export interface ReportPdfElevator {
  id: string;
  internalCode: string | null;
  elevatorName: string | null;
  brandName: string | null;
  modelName: string | null;
  elevatorTypeName: string | null;
  finding: string | null;
  finalStatus: string | null;
  tasks: ReportPdfTask[];
  photos: ReportPdfPhoto[];
}

export interface WorkOrderReportPdfData {
  otNumber: string;
  serviceTypeName: string;
  priority: string;
  clientName: string;
  costCenterName: string;
  costCenterAddress: string;
  costCenterDistrict: string;
  technicianName: string;
  scheduledText: string;
  startedText: string;
  completedText: string;
  closingNotes: string | null;
  clientSignerName: string | null;
  clientSignatureUrl: string | null;
  generatedDateText: string;
  logoUrl?: string;
  elevators: ReportPdfElevator[];
}

const PRIMARY = "#0066CC";
const DARK = "#0F172A";
const TEXT_MUTED = "#64748B";
const BORDER = "#E2E8F0";
const BG_LIGHT = "#F8FAFC";
const SUCCESS = "#10B981";
const DANGER = "#EF4444";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9,
    lineHeight: 1.4,
    color: DARK,
    paddingTop: 36,
    paddingBottom: 45,
    paddingHorizontal: 36,
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 12,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandSquare: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#021133",
    alignItems: "center",
    justifyContent: "center",
  },
  brandSquareText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#021133",
    letterSpacing: 0.5,
  },
  companySubtitle: {
    fontSize: 7.5,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  docTypeBox: {
    alignItems: "flex-end",
  },
  docTypeTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  docTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: PRIMARY,
    marginTop: 2,
  },
  docDate: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  otBanner: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  otNumberText: {
    fontSize: 16,
    fontWeight: "bold",
    color: DARK,
    fontFamily: PDF_FONT,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    color: "#065F46",
    fontSize: 8,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#021133",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
  },
  grid2Col: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
    columnGap: 12,
  },
  infoField: {
    width: "48%",
  },
  infoFieldFull: {
    width: "100%",
  },
  fieldLabel: {
    fontSize: 7.5,
    color: TEXT_MUTED,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 8.5,
    color: DARK,
  },
  elevatorCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: "hidden",
  },
  elevatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BG_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  elevatorCode: {
    fontSize: 8.5,
    fontWeight: "bold",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  elevatorTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: DARK,
    marginLeft: 6,
  },
  elevatorStatusBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 7.5,
    fontWeight: "bold",
  },
  badgeOperative: {
    backgroundColor: "#ECFDF5",
    color: "#065F46",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  badgeOutOfService: {
    backgroundColor: "#FEF2F2",
    color: "#991B1B",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  elevatorBody: {
    padding: 10,
  },
  subHeading: {
    fontSize: 8,
    fontWeight: "bold",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  findingBox: {
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 6,
    marginBottom: 8,
  },
  findingText: {
    fontSize: 8,
    color: DARK,
  },
  tasksTable: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  moduleHeader: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  moduleHeaderText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#334155",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  taskCheck: {
    width: 14,
    fontSize: 8,
    fontWeight: "bold",
    color: SUCCESS,
  },
  taskCheckUnchecked: {
    width: 14,
    fontSize: 8,
    color: TEXT_MUTED,
  },
  taskContent: {
    flex: 1,
  },
  taskDesc: {
    fontSize: 8,
    color: DARK,
  },
  taskObs: {
    fontSize: 7.5,
    color: TEXT_MUTED,
    fontStyle: "italic",
    marginTop: 1,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  photoCard: {
    width: "31%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  photoImage: {
    width: "100%",
    height: 90,
    objectFit: "cover",
  },
  photoTag: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: PRIMARY,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingTop: 3,
  },
  photoDesc: {
    fontSize: 6.5,
    color: TEXT_MUTED,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  closingNotesBox: {
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  signatureSection: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  signatureBox: {
    width: 200,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  signatureImage: {
    width: 160,
    height: 60,
    objectFit: "contain",
    marginBottom: 4,
  },
  stampBox: {
    width: 170,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: "#0F766E",
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: "#F0FDFA",
  },
  stampBadge: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0F766E",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  stampSigner: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0F766E",
    fontStyle: "italic",
    marginTop: 3,
    marginBottom: 2,
    textAlign: "center",
  },
  stampDate: {
    fontSize: 6.5,
    color: "#0F766E",
  },
  signerLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    textTransform: "uppercase",
    marginTop: 4,
  },
  signerName: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: DARK,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: TEXT_MUTED,
  },
});

export function WorkOrderReportPDF({ data }: { data: WorkOrderReportPdfData }) {
  return (
    <Document title={`Informe_OT_${data.otNumber}`} author="HTL Elevadores">
      <Page size="A4" style={styles.page}>
        {/* Cabecera */}
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            <View>
              <Text style={styles.companyName}>HTL ELEVADORES</Text>
              <Text style={styles.companySubtitle}>
                Servicio Técnico Integral de Transporte Vertical
              </Text>
            </View>
          </View>

          <View style={styles.docTypeBox}>
            <Text style={styles.docTypeTitle}>Documento Oficial</Text>
            <Text style={styles.docTitle}>INFORME TÉCNICO</Text>
            <Text style={styles.docDate}>Emisión: {data.generatedDateText}</Text>
          </View>
        </View>

        {/* Banner OT */}
        <View style={styles.otBanner}>
          <Text style={styles.otNumberText}>OT: {data.otNumber}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>SERVICIO APROBADO</Text>
          </View>
        </View>

        {/* Información General */}
        <Text style={styles.sectionTitle}>Información del Servicio</Text>
        <View style={styles.grid2Col}>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Cliente</Text>
            <Text style={styles.fieldValue}>{data.clientName || "—"}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Centro de Costos / Edificio</Text>
            <Text style={styles.fieldValue}>{data.costCenterName || "—"}</Text>
          </View>
          <View style={styles.infoFieldFull}>
            <Text style={styles.fieldLabel}>Dirección</Text>
            <Text style={styles.fieldValue}>
              {[data.costCenterAddress, data.costCenterDistrict]
                .filter(Boolean)
                .join(", ") || "—"}
            </Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Tipo de Servicio</Text>
            <Text style={styles.fieldValue}>{data.serviceTypeName || "—"}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Prioridad</Text>
            <Text style={styles.fieldValue}>{data.priority || "Normal"}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Técnico Responsable</Text>
            <Text style={styles.fieldValue}>{data.technicianName || "—"}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Fecha Programada</Text>
            <Text style={styles.fieldValue}>{data.scheduledText || "—"}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Inicio del Servicio</Text>
            <Text style={styles.fieldValue}>{data.startedText || "—"}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Finalización</Text>
            <Text style={styles.fieldValue}>{data.completedText || "—"}</Text>
          </View>
        </View>

        {/* Equipos Atendidos */}
        <Text style={styles.sectionTitle}>
          Equipos Atendidos ({data.elevators.length})
        </Text>

        {data.elevators.map((elevator) => {
          const isOutOfService = elevator.finalStatus === "OUT_OF_SERVICE";
          const tasks = elevator.tasks || [];

          // Agrupar tareas por módulo
          const moduleGroups = Array.from(
            tasks.reduce((groups, task) => {
              const key = task.moduleCode || "GENERAL";
              const group = groups.get(key) ?? [];
              group.push(task);
              groups.set(key, group);
              return groups;
            }, new Map<string, ReportPdfTask[]>())
          );

          return (
            <View key={elevator.id} wrap={false} style={styles.elevatorCard}>
              <View style={styles.elevatorHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.elevatorCode}>
                    {elevator.internalCode || "—"}
                  </Text>
                  <Text style={styles.elevatorTitle}>
                    {elevator.elevatorName || "Equipo"}
                    {elevator.brandName ? ` · ${elevator.brandName}` : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.elevatorStatusBadge,
                    isOutOfService
                      ? styles.badgeOutOfService
                      : styles.badgeOperative,
                  ]}
                >
                  {isOutOfService ? "Fuera de Servicio" : "Operativo"}
                </Text>
              </View>

              <View style={styles.elevatorBody}>
                {/* Hallazgos */}
                <Text style={styles.subHeading}>Hallazgos y Observaciones</Text>
                <View style={styles.findingBox}>
                  <Text style={styles.findingText}>
                    {elevator.finding?.trim() || "Sin hallazgos específicos registrados."}
                  </Text>
                </View>

                {/* Tareas */}
                {tasks.length > 0 && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={styles.subHeading}>
                      Tareas Ejecutadas ({tasks.filter((t) => t.isCompleted).length} / {tasks.length})
                    </Text>
                    <View style={styles.tasksTable}>
                      {moduleGroups.map(([modKey, modTasks]) => (
                        <View key={modKey}>
                          {modTasks[0]?.moduleName && (
                            <View style={styles.moduleHeader}>
                              <Text style={styles.moduleHeaderText}>
                                {modTasks[0].moduleCode
                                  ? `${modTasks[0].moduleCode} - `
                                  : ""}
                                {modTasks[0].moduleName}
                              </Text>
                            </View>
                          )}
                          {modTasks.map((t) => (
                            <View key={t.id} style={styles.taskRow}>
                              <Text
                                style={
                                  t.isCompleted
                                    ? styles.taskCheck
                                    : styles.taskCheckUnchecked
                                }
                              >
                                {t.isCompleted ? "[X]" : "[ ]"}
                              </Text>
                              <View style={styles.taskContent}>
                                <Text style={styles.taskDesc}>
                                  {t.taskDescription}
                                  {t.isCritical ? " (CRÍTICA)" : ""}
                                </Text>
                                {t.observations ? (
                                  <Text style={styles.taskObs}>
                                    Obs: {t.observations}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Fotos de Evidencia si existen */}
                {elevator.photos && elevator.photos.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.subHeading}>
                      Evidencias Fotográficas ({elevator.photos.length})
                    </Text>
                    <View style={styles.photosGrid}>
                      {elevator.photos.slice(0, 6).map((photo) => (
                        <View key={photo.id} style={styles.photoCard}>
                          <Image src={photo.url} style={styles.photoImage} />
                          <Text style={styles.photoTag}>
                            {{
                              BEFORE: "Antes",
                              AFTER: "Después",
                              POINT: "Puntual",
                            }[photo.tag] || photo.tag}
                          </Text>
                          {photo.description ? (
                            <Text style={styles.photoDesc}>
                              {photo.description}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Notas de Cierre */}
        <View wrap={false} style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Notas de Cierre del Servicio</Text>
          <View style={styles.closingNotesBox}>
            <Text style={styles.findingText}>
              {data.closingNotes?.trim() || "Sin notas adicionales registradas."}
            </Text>
          </View>

          {/* Firma o Sello de Aprobación */}
          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              {data.clientSignatureUrl ? (
                <Image
                  src={data.clientSignatureUrl}
                  style={styles.signatureImage}
                />
              ) : (
                <View style={styles.stampBox}>
                  <Text style={styles.stampBadge}>
                    APROBADO POR EL RESPONSABLE
                  </Text>
                  <Text style={styles.stampSigner}>
                    {data.clientSignerName?.trim() || "Responsable"}
                  </Text>
                  <Text style={styles.stampDate}>
                    Conformidad registrada ({data.completedText})
                  </Text>
                </View>
              )}
              <Text style={styles.signerLabel}>Conformidad del Cliente</Text>
              <Text style={styles.signerName}>
                {data.clientSignerName?.trim() || "Responsable Autorizado"}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            HTL Elevadores · {data.costCenterName} · OT #{data.otNumber}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
