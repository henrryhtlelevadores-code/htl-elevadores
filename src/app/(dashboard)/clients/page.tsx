import {
  getClients,
  getCostCenters,
  getCostCenterContacts,
} from "@/features/clients/actions";
import { ClientUnifiedView } from "@/features/clients/components/client-unified-view";


export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [clients, costCenters, contacts] = await Promise.all([
    getClients(),
    getCostCenters(),
    getCostCenterContacts(),
  ]);

  return (
    <div className="space-y-6">
      <ClientUnifiedView
        initialClients={clients}
        initialCostCenters={costCenters}
        initialContacts={contacts}
      />
    </div>
  );
}