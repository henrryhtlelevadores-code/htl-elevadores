import { notFound } from "next/navigation";
import {
  getLaborConfig,
  getQuotationById,
  getQuotationFormData,
  getQuotationImages,
} from "@/features/quotations/actions";
import { QuotationDetailPage } from "@/features/quotations/components/quotation-detail-page";
import { requirePageAccess } from "@/features/auth/guard";

export const dynamic = "force-dynamic";

export default async function QuotationDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("quotations:read");
  const { id } = await params;
  const quotation = await getQuotationById(id);
  if (!quotation) notFound();
  const [images, options, hourlyCost] = await Promise.all([
    getQuotationImages(id),
    getQuotationFormData(),
    getLaborConfig(),
  ]);
  return (
    <QuotationDetailPage
      quotation={quotation}
      images={images}
      options={options}
      defaultHourlyCost={hourlyCost}
    />
  );
}
