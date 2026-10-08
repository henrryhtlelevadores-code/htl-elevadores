import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, quotations } from "@/db";
import { acceptPortalQuotation, getPortalQuotation } from "@/features/portal/quotations";
import { portalQuotationPdfAction } from "@/features/portal/actions";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { clearCostCenterPassword, setCostCenterPassword } from "@/features/clients/actions";
import { PORTAL_SESSION_COOKIE } from "@/features/portal/session";
import PortalQuotationPage from "@/app/(portal)/portal/[costCenterId]/cotizaciones/[quotationId]/page";
import { GET as portalQuotationPdf } from "@/app/api/portal/[costCenterId]/quotations/[quotationId]/pdf/route";
import { GET as portalContractPdf } from "@/app/api/portal/[costCenterId]/contracts/[contractId]/pdf/route";
import { POST as acceptRoute } from "@/app/api/portal/[costCenterId]/quotations/[quotationId]/accept/route";
import { GET as staffQuotationPdf } from "@/app/api/quotations/[id]/pdf/route";
import { GET as staffContractPdf } from "@/app/api/contracts/[id]/pdf/route";
import { GET as quotationImages } from "@/app/api/quotations/[id]/images/route";
import { cookieJar, resetRequest } from "./helpers/request";
import {
  createCostCenter,
  createQuotation,
  createUser,
  loginAs,
  loginPortal,
} from "./helpers/fixtures";

const request = (path = "/") => new Request(`http://localhost${path}`);
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => resetRequest());

describe("cotizaciones del portal (IDOR)", () => {
  it("devuelve la cotización de la propia sede", async () => {
    const mine = await createCostCenter();
    const quotationId = await createQuotation(mine);
    expect((await getPortalQuotation(mine.id, quotationId))?.id).toBe(quotationId);
  });

  it("no devuelve la cotización de otra sede", async () => {
    const mine = await createCostCenter();
    const other = await createCostCenter();
    const foreignQuotation = await createQuotation(other);
    expect(await getPortalQuotation(mine.id, foreignQuotation)).toBeNull();
  });

  it("no devuelve borradores aunque sean de la sede", async () => {
    const mine = await createCostCenter();
    const draft = await createQuotation(mine, "DRAFT");
    expect(await getPortalQuotation(mine.id, draft)).toBeNull();
  });

  it("la página responde 404 para una cotización de otra sede", async () => {
    const mine = await createCostCenter();
    const other = await createCostCenter();
    const foreignQuotation = await createQuotation(other);
    await loginPortal(mine.id);

    await expect(
      PortalQuotationPage(params({ costCenterId: mine.id, quotationId: foreignQuotation }))
    ).rejects.toThrow("NOT_FOUND");
  });

  it("la página redirige al login si la sede de la URL no es la de la sesión", async () => {
    const mine = await createCostCenter();
    const other = await createCostCenter();
    const foreignQuotation = await createQuotation(other);
    await loginPortal(mine.id);

    await expect(
      PortalQuotationPage(params({ costCenterId: other.id, quotationId: foreignQuotation }))
    ).rejects.toThrow(`REDIRECT:/portal/${other.id}/login`);
  });

  it("no se puede aceptar la cotización de otra sede", async () => {
    const mine = await createCostCenter();
    const other = await createCostCenter();
    const foreignQuotation = await createQuotation(other);

    expect((await acceptPortalQuotation(mine.id, foreignQuotation)).success).toBe(false);

    await loginPortal(mine.id);
    const response = await acceptRoute(
      request(),
      params({ costCenterId: other.id, quotationId: foreignQuotation })
    );
    expect(response.status).toBe(401);

    const [row] = await db
      .select({ status: quotations.status })
      .from(quotations)
      .where(eq(quotations.id, foreignQuotation));
    expect(row.status).toBe("SENT");
  });
});

describe("PDFs", () => {
  it("el portal no puede leer el PDF de una cotización de otra sede", async () => {
    const mine = await createCostCenter();
    const other = await createCostCenter();
    const foreignQuotation = await createQuotation(other);
    await loginPortal(mine.id);

    // Con su propia sede en la URL: la cotización no le pertenece -> 404.
    const notMine = await portalQuotationPdf(
      request(),
      params({ costCenterId: mine.id, quotationId: foreignQuotation })
    );
    expect(notMine.status).toBe(404);

    // Con la sede ajena en la URL: su sesión no es de esa sede -> 401.
    const wrongCenter = await portalQuotationPdf(
      request(),
      params({ costCenterId: other.id, quotationId: foreignQuotation })
    );
    expect(wrongCenter.status).toBe(401);

    // Por la server action tampoco.
    expect((await portalQuotationPdfAction(foreignQuotation)).success).toBe(false);
  });

  it("el portal sin sesión no obtiene PDFs", async () => {
    const mine = await createCostCenter();
    const quotationId = await createQuotation(mine);
    const quotationPdf = await portalQuotationPdf(
      request(),
      params({ costCenterId: mine.id, quotationId })
    );
    expect(quotationPdf.status).toBe(401);
    const contractPdf = await portalContractPdf(
      request(),
      params({ costCenterId: mine.id, contractId: "CUALQUIERA" })
    );
    expect(contractPdf.status).toBe(401);
  });

  it("el personal sin quotations:read no obtiene el PDF de una cotización", async () => {
    const quotationId = await createQuotation(await createCostCenter());

    const anonymous = await staffQuotationPdf(request(), params({ id: quotationId }));
    expect(anonymous.status).toBe(401);

    await loginAs((await createUser({ permissions: ["work_orders", "reports"] })).id);
    const forbidden = await staffQuotationPdf(request(), params({ id: quotationId }));
    expect(forbidden.status).toBe(403);
    expect((await quotationImages(request(), params({ id: quotationId }))).status).toBe(403);
  });

  it("el personal sin contracts:read no obtiene el PDF de un contrato", async () => {
    await loginAs((await createUser({ permissions: ["quotations"] })).id);
    const response = await staffContractPdf(request(), params({ id: "CUALQUIERA" }));
    expect(response.status).toBe(403);
  });

  it("una sesión del portal no sirve para las rutas de PDF del personal", async () => {
    const mine = await createCostCenter();
    const quotationId = await createQuotation(mine);
    await loginPortal(mine.id);
    const response = await staffQuotationPdf(request(), params({ id: quotationId }));
    expect(response.status).toBe(401);
  });
});

describe("revocación de la sesión del portal", () => {
  it("cambiar o borrar la credencial de la sede cierra sus sesiones", async () => {
    const admin = await createUser({ permissions: ["*"] });
    const costCenter = await createCostCenter();

    await loginPortal(costCenter.id);
    const portalToken = cookieJar.get(PORTAL_SESSION_COOKIE)!.value;
    expect(await getPortalSessionCostCenterId()).toBe(costCenter.id);

    await loginAs(admin.id);
    expect((await setCostCenterPassword(costCenter.id, "Nueva-Clave-55")).success).toBe(true);

    resetRequest();
    cookieJar.set(PORTAL_SESSION_COOKIE, portalToken);
    expect(await getPortalSessionCostCenterId()).toBeNull();

    // Con la credencial eliminada, ni siquiera una sesión nueva es válida.
    await loginAs(admin.id);
    expect((await clearCostCenterPassword(costCenter.id)).success).toBe(true);
    await loginPortal(costCenter.id);
    expect(await getPortalSessionCostCenterId()).toBeNull();
  });
});
