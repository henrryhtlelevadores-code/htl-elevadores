/**
 * Mueve los PDFs de contratos y cotizaciones del bucket público de R2 al
 * bucket privado (R2_PRIVATE_BUCKET_NAME).
 *
 *   npx tsx scripts/migrate-pdfs-to-private.ts --dry-run
 *   npx tsx scripts/migrate-pdfs-to-private.ts
 *   npx tsx scripts/migrate-pdfs-to-private.ts --delete-public
 *
 * Por defecto SOLO COPIA: sube cada PDF al bucket privado con una clave
 * aleatoria y guarda esa clave en la base (pdf_key / final_pdf_key). No borra
 * nada y no toca las URLs públicas antiguas.
 *
 * Es idempotente: las filas que ya tienen clave se saltan, así que se puede
 * volver a ejecutar tras un fallo sin duplicar copias.
 *
 * `--delete-public` es un paso aparte y explícito, pensado para ejecutarse
 * días después de verificar en producción. Solo borra el objeto público de
 * las filas cuya copia privada existe (se comprueba con HEAD), y entonces
 * vacía la URL antigua.
 *
 * Requiere las migraciones 0048 aplicadas y las variables de R2 y Turso.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const dryRun = process.argv.includes("--dry-run");
const deletePublic = process.argv.includes("--delete-public");

const publicBucket = process.env.R2_BUCKET_NAME;
const privateBucket = process.env.R2_PRIVATE_BUCKET_NAME;

if (!publicBucket || !privateBucket || !process.env.R2_S3_API) {
  console.error("Faltan R2_S3_API, R2_BUCKET_NAME o R2_PRIVATE_BUCKET_NAME.");
  process.exit(1);
}
if (publicBucket === privateBucket) {
  console.error("R2_PRIVATE_BUCKET_NAME no puede ser el bucket público.");
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, ...(authToken ? { authToken } : {}) });

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_API,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

interface Target {
  label: string;
  table: string;
  urlColumn: string;
  keyColumn: string;
  prefix: "contracts" | "quotations";
}

const TARGETS: Target[] = [
  { label: "cotizaciones", table: "quotations", urlColumn: "pdf_url", keyColumn: "pdf_key", prefix: "quotations" },
  { label: "contratos", table: "contracts", urlColumn: "final_pdf_url", keyColumn: "final_pdf_key", prefix: "contracts" },
];

function publicKeyFromUrl(value: string): string | null {
  if (!/^https?:\/\//.test(value)) return null;
  try {
    return decodeURIComponent(new URL(value).pathname.replace(/^\//, "")) || null;
  } catch {
    return null;
  }
}

async function privateExists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: privateBucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyPhase(target: Target) {
  const { rows } = await db.execute(
    `SELECT id, ${target.urlColumn} AS url FROM ${target.table}
     WHERE ${target.urlColumn} IS NOT NULL AND ${target.keyColumn} IS NULL`
  );
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const id = String(row.id);
    const sourceKey = publicKeyFromUrl(String(row.url));
    if (!sourceKey) {
      // p. ej. un data: URL guardado en desarrollo: no hay nada que copiar.
      skipped++;
      continue;
    }
    const privateKey = `${target.prefix}/${randomUUID()}.pdf`;
    if (dryRun) {
      console.log(`[dry-run] ${target.label} ${id}: ${sourceKey} -> ${privateKey}`);
      copied++;
      continue;
    }
    try {
      const source = await r2.send(new GetObjectCommand({ Bucket: publicBucket, Key: sourceKey }));
      if (!source.Body) throw new Error("objeto vacío");
      const bytes = await source.Body.transformToByteArray();
      await r2.send(
        new PutObjectCommand({
          Bucket: privateBucket,
          Key: privateKey,
          Body: bytes,
          ContentType: "application/pdf",
        })
      );
      if (!(await privateExists(privateKey))) throw new Error("la copia no se pudo verificar");
      // Solo se guarda la clave si la fila sigue sin tenerla (re-ejecuciones).
      await db.execute({
        sql: `UPDATE ${target.table} SET ${target.keyColumn} = ? WHERE id = ? AND ${target.keyColumn} IS NULL`,
        args: [privateKey, id],
      });
      copied++;
      console.log(`OK   ${target.label} ${id}`);
    } catch (error) {
      failed++;
      console.error(`FAIL ${target.label} ${id}: ${(error as Error).message}`);
    }
  }
  console.log(`${target.label}: ${copied} copiados, ${skipped} sin objeto público, ${failed} con error`);
  return failed;
}

async function deletePhase(target: Target) {
  const { rows } = await db.execute(
    `SELECT id, ${target.urlColumn} AS url, ${target.keyColumn} AS key FROM ${target.table}
     WHERE ${target.urlColumn} IS NOT NULL AND ${target.keyColumn} IS NOT NULL`
  );
  let deleted = 0;
  let kept = 0;

  for (const row of rows) {
    const id = String(row.id);
    const sourceKey = publicKeyFromUrl(String(row.url));
    if (!(await privateExists(String(row.key)))) {
      kept++;
      console.error(`KEEP ${target.label} ${id}: no se encontró la copia privada; no se borra`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] borraría ${target.label} ${id}: ${sourceKey ?? "(sin objeto público)"}`);
      deleted++;
      continue;
    }
    try {
      if (sourceKey) {
        await r2.send(new DeleteObjectCommand({ Bucket: publicBucket, Key: sourceKey }));
      }
      await db.execute({
        sql: `UPDATE ${target.table} SET ${target.urlColumn} = NULL WHERE id = ?`,
        args: [id],
      });
      deleted++;
      console.log(`DEL  ${target.label} ${id}`);
    } catch (error) {
      kept++;
      console.error(`FAIL ${target.label} ${id}: ${(error as Error).message}`);
    }
  }
  console.log(`${target.label}: ${deleted} públicos borrados, ${kept} conservados`);
}

async function main() {
  console.log(
    `${dryRun ? "[dry-run] " : ""}${deletePublic ? "Borrado de PDFs públicos ya copiados" : "Copia al bucket privado"}`
  );
  let failures = 0;
  for (const target of TARGETS) {
    if (deletePublic) await deletePhase(target);
    else failures += await copyPhase(target);
  }
  if (failures > 0) {
    console.error(`Terminó con ${failures} errores. Vuelve a ejecutarlo: las filas ya copiadas se saltan.`);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
