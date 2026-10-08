import { notFound } from "next/navigation";
import { getContractById } from "@/features/contracts/actions";
import { ContractDetailView } from "@/features/contracts/components/contract-detail-view";
import { requirePageAccess } from "@/features/auth/guard";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("contracts:read");
  const { id } = await params;
  const contract = await getContractById(id);

  if (!contract) {
    notFound();
  }

  return <ContractDetailView contract={contract} />;
}
