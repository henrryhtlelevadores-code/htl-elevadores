import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_API,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

async function putR2(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<string> {
  await R2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function uploadToR2(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<string> {
  return putR2(key, body, contentType);
}

export async function uploadPdfToR2(
  key: string,
  buffer: Buffer
): Promise<string> {
  return putR2(key, buffer, "application/pdf");
}

export function buildContractPdfKey(contractNumber: string): string {
  const year = new Date().getFullYear();
  return `contracts/${year}/${contractNumber}.pdf`;
}

export function buildEvidenceKey(
  workOrderId: string,
  elevatorId: string,
  index: number,
  ext: string
): string {
  const safe = INDEX_SAFE_REPLACEMENTS;
  const wo = workOrderId.replace(/-/g, "").toLowerCase().slice(0, 12);
  const ev = elevatorId.replace(/-/g, "").toLowerCase().slice(0, 12);
  const ts = Date.now();
  return `work-orders/${wo}/${ev}/${ts}-${safe(index)}.${ext}`;
}

export function buildSignatureKey(workOrderId: string): string {
  const wo = workOrderId.replace(/-/g, "").toLowerCase().slice(0, 12);
  return `work-orders/${wo}/client-signature.png`;
}

const INDEX_SAFE_REPLACEMENTS = (n: number) => String(n).padStart(2, "0");
