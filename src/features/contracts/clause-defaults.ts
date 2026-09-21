import type { ContractTemplateData } from "./components/preventive-contract-pdf";

export const EDITABLE_CLAUSES: Array<{ key: string; label: string }> = [
  { key: "clause_1", label: "PRIMERO" },
  { key: "clause_2_1", label: "2.1" },
  { key: "clause_2_2", label: "2.2" },
  { key: "clause_2_3", label: "2.3" },
  { key: "clause_2_4", label: "2.4" },
  { key: "clause_2_5", label: "2.5 (Plazo de pago)" },
  { key: "clause_3_1", label: "3.1" },
  { key: "clause_3_2", label: "3.2" },
  { key: "clause_3_3", label: "3.3" },
  { key: "clause_3_4", label: "3.4" },
  { key: "clause_3_5", label: "3.5" },
  { key: "clause_3_6", label: "3.6" },
  { key: "clause_3_7", label: "3.7" },
  { key: "clause_3_7_1", label: "3.7.1 (Atrapamiento)" },
  { key: "clause_3_7_2", label: "3.7.2 (Falla mecánica)" },
  { key: "clause_4_1", label: "4.1" },
  { key: "clause_4_2", label: "4.2" },
  { key: "clause_4_3", label: "4.3" },
  { key: "clause_4_4", label: "4.4 (Duración)" },
  { key: "clause_4_5", label: "4.5" },
];

const DEFAULTS: Record<string, (d: ContractTemplateData) => string> = {
  clause_1: (d) =>
    `EL CLIENTE contrata los servicios de HTL ELEVADORES S.A.C. Para que realice trabajos relacionados con el mantenimiento preventivo (cuidado y conservación) de ${d.elevatorsCount} ascensor(es), cuyas características son las siguientes:`,
  clause_2_1: () =>
    "2.1. Brindar las facilidades del personal técnico de HTL ELEVADORES S.A.C. en los acceso a las instalaciones de los ascensores, para realizar los trabajos de mantenimiento, detallados en el presente contrato.",
  clause_2_2: () =>
    "2.2. Asimismo, restringir el acceso a personas ajenas a nuestro servicio, a las instalaciones de los ascensores, de darse el caso nuestra empresa no será responsable de los daños personales o materiales que estos ocasionen.",
  clause_2_3: () =>
    "2.3. Comunicar inmediatamente a la Empresa HTL ELEVADORES S.A.C. sobre cualquier desperfecto que presenten los equipos. En caso de presentarse riesgos de seguridad, suspender el funcionamiento hasta la llegada del personal técnico.",
  clause_2_4: (d) =>
    `2.4. Cancelar el costo mensual, por el servicio de mantenimiento preventivo frecuencia de ${d.elevatorsCount} ascensores por la suma de S/. ${d.baseAmount} (${d.baseAmountText}) ${d.includesIgvText}.`,
  clause_2_5: (d) =>
    `El pago de la BOLETA O FACTURA será cancelado, dentro de los ${d.paymentTermDays} días siguientes a la fecha de recepción de dicho documento, debiendo estar la boleta u orden de trabajo firmada por el personal encargado del edificio en señal de conformidad del servicio efectuado y será reajustado automáticamente cada año de acuerdo con el índice de precios al consumidor IPC proporcionado por la INEI.`,
  clause_3_1: () =>
    "3.1. Efectuar una vez al mes el mantenimiento y cumplir con el programa de mantenimiento detallado en el anexo Nº 1, el mismo que será parte integrante del contrato, para este servicio empleara técnicos experimentados, los cuales prestarán el cuidado razonable para mantener los ascensores en condiciones normales de funcionamiento.",
  clause_3_2: () =>
    "3.2. Realizar los servicios de inspección de los ascensores, incluyendo lubricación, aseo técnico y controlar, regular la máquina, motor, tablero de control, cojinetes, guiadores. Efectuar además los ajustes y regulación que sean necesarios para mantener operativo los componentes mecánicos, eléctricos y electrónicos que aseguren el normal funcionamiento del equipo.",
  clause_3_3: () =>
    "3.3. Suministrar en forma gratuita las grasas, lubricantes, materiales y además aditivos necesarios que se usaran en los trabajos detallados en el presente contrato.",
  clause_3_4: () =>
    "3.4. HTL ELEVADORES S.A.C. cuenta con póliza de Seguro de responsabilidad Civil contra terceros, respaldada por la Compañía de Seguros La Positiva Seguros Dicha póliza quedara sin efecto si el equipo es manipulado o reparado por personas ajenas a la empresa.",
  clause_3_5: () =>
    "3.5. HTL ELEVADORES S.A.C. Garantiza que las partes y piezas mecánicas, eléctricas y electrónicas se cotizara y se cambiará por repuestos originales de la marca.",
  clause_3_6: () =>
    "3.6. Poner a disposición del cliente sin costo adicional un servicio de emergencia las 24 horas del día, los 365 días del año, incluyendo domingos y feriados, llamando a: TEL.: 963 207 058.",
  clause_3_7: () =>
    "3.7. El tiempo de respuesta máximo de atención de emergencia, será estipulado de acuerdo al tipo de emergencia:",
  clause_3_7_1: () =>
    "3.7.1. Personas atrapadas en el ascensor: El tiempo máximo de respuesta es cuarenta y cinco (45) minutos.",
  clause_3_7_2: () =>
    "3.7.2. Ascensor detenido por fallas electromecánicas: El tiempo máximo de respuesta será de tres (03) Horas.",
  clause_4_1: () =>
    "4.1. El cliente deberá cancelar el costo del servicio de mantenimiento mensual del ascensor. En el caso de que exista el impago del importe de tres mensualidades consecutivas, faculta a HTL ELEVADORES S.A.C. a suspender el servicio si así ocurriera, en tal caso, el cliente asumirá la responsabilidad de las contingencias e incluso accidentes que pudieran ocurrir, como consecuencia de la cesación en el mantenimiento del equipo elevador.",
  clause_4_2: () =>
    "4.2. La empresa no será responsable por pérdidas, daños y/o perjuicios y/o demoras, y/o imposibilidad de la realización de parte y/o totalidad de los trabajos objetos de la presente, motivada por anormalidades de la red de energía eléctrica y todo otro hecho ajeno al control de la compañía.",
  clause_4_3: () =>
    "4.3. Las reparaciones mayores y el cambio de repuestos, partes y materiales auxiliares de ser necesarios, será a cargo del CLIENTE quienes autorizan el reemplazo previa aprobación del informe y presupuesto presentado por HTL ELEVADORES S.A.C.",
  clause_4_4: (d) =>
    `4.4. El periodo de duración del presente contrato es de (${d.contractDurationYears}) ${d.contractDurationYears === 1 ? "un año" : `${d.contractDurationYears} años`}. A partir de dicho periodo será renovado automáticamente por otro año y así sucesivamente si ninguna de las partes comunica a la otra su terminación, con un plazo mínimo de 30 días antes del vencimiento del contrato mediante una CARTA SIMPLE.`,
  clause_4_5: () =>
    "4.5. El Propietario o Institución debe regularizar y/o estar al día con sus cuotas de mantenimiento o reparaciones para proceder con la cesación del contrato preventivo con HTL ELEVADORES S.A.C.",
};

export function resolveClauseText(
  customClauses: Record<string, string> | undefined,
  key: string,
  data: ContractTemplateData
): string {
  if (customClauses?.[key]) return customClauses[key];
  return DEFAULTS[key]?.(data) ?? "";
}