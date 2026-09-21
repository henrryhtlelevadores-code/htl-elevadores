import { getUsers, getAllRoles, ensureDefaultRoles } from "@/features/users/actions";
import { UsersTable } from "@/features/users/components/users-table";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await ensureDefaultRoles();
  const [users, roles] = await Promise.all([getUsers(), getAllRoles()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="size-5 text-[#0066CC]" />
            Personal y Usuarios
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Administra colaboradores y sus accesos al sistema. Las contraseñas se protegen con
            Argon2id (m=64MB, t=3, p=4).
          </p>
        </div>
      </div>

      <UsersTable initialUsers={users} roles={roles} />
    </div>
  );
}