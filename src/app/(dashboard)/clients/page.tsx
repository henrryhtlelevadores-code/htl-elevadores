import {
  getClients,
  getCostCenters,
  getCostCenterContacts,
} from "@/features/clients/actions";
import { getUbigeos } from "@/features/masters/actions";
import { ClientUnifiedView } from "@/features/clients/components/client-unified-view";
import { requirePageAccess } from "@/features/auth/guard";


export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requirePageAccess("clients:read");
  const [clients, costCenters, contacts, ubigeos] = await Promise.all([
    getClients(),
    getCostCenters(),
    getCostCenterContacts(),
    getUbigeos(),
  ]);

  return (
    <div className="space-y-6">
      <ClientUnifiedView
        initialClients={clients}
        initialCostCenters={costCenters}
        initialContacts={contacts}
        initialUbigeos={ubigeos}
      />
    </div>
  );
}