# Seguridad

Notas operativas del modelo de seguridad de HTL Elevadores. Complementa al README.

## Sesiones

Hay dos tipos de sesión, independientes entre sí:

| Tipo | Cookie (producción) | Secreto | Duración |
|---|---|---|---|
| Personal (staff) | `__Host-htl_staff_session` | `STAFF_SESSION_SECRET` | 7 días, renovación deslizante |
| Portal del cliente | `__Host-htl_portal_session` | `PORTAL_SESSION_SECRET` | 24 horas |

- El token es `v2.<tipo>.<sujeto>.<versión>.<exp>.<firma>` (HMAC-SHA256). El tipo va firmado y cada tipo usa su propio secreto, así que un token del portal no sirve como sesión de personal.
- En producción la aplicación no arranca la sesión si falta alguno de los dos secretos o si son iguales. Genera cada uno con `openssl rand -hex 32`.
- Las cookies son `HttpOnly`, `Secure` (producción), `SameSite=Lax`, `Path=/` y sin `Domain`. En desarrollo sobre http se usan sin el prefijo `__Host-`.
- `src/proxy.ts` solo comprueba firma, tipo y expiración. La validación completa (usuario existente, activo y no eliminado) se hace contra la base en `getSessionUser` / `getPortalSessionCostCenterId`, y ante un error de consulta la sesión se considera inválida.

### Revocación

Cada usuario tiene `users.session_version` y cada sede `cost_center.portal_session_version`. El valor viaja dentro del token y se compara con la base cada vez que se resuelve la sesión; si no coincide, la sesión se rechaza.

La versión se incrementa (y por tanto se cierran las sesiones abiertas) cuando:

- se cambia la contraseña de un usuario, su rol o su estado, o se elimina;
- se establece o se borra la credencial del portal de una sede.

Si un usuario se modifica a sí mismo, conserva la sesión desde la que hizo el cambio; el resto de sus sesiones se cierran. Un usuario `INACTIVE` no puede iniciar sesión.

La migración `drizzle/0045_session_versions.sql` debe aplicarse **antes** de desplegar este código: sin esas columnas no se puede resolver ninguna sesión.

## Permisos por rol

Los permisos viven en `roles.permissions` (lista JSON) y se evalúan en `src/features/auth/permissions.ts`.

- Un permiso son segmentos separados por `:`; por ejemplo `users:read` o `work_orders:panel:write`.
- Un permiso concedido cubre al requerido cuando sus segmentos son un **prefijo exacto**: `work_orders` cubre `work_orders:panel:write`; `users:read` no cubre `users:write` ni `users:readonly`.
- `*` cubre todo. Escritura no implica lectura: un rol necesita `modulo` (ambas) o los dos permisos.
- Un rol desactivado no concede nada.

Módulos: `clients`, `contracts`, `equipment`, `invoices`, `maintenance`, `masters`, `quotations`, `reports` (más `reports:approve`), `routes`, `safety`, `users` y `work_orders:panel`. La app del técnico usa `work_orders:field`.

Cómo se aplica:

- **Server actions** (`src/features/*/actions.ts`): cada función exportada empieza con `requirePermission(...)` (lecturas, lanza `AuthError`) o `denyUnless(...)` (mutaciones, devuelve `{ success: false, error }`). El proxy **no** protege las server actions, así que una acción nueva sin guard queda pública.
- **Rutas API**: `authorizeApi(...)` responde 401 o 403.
- **Páginas del panel**: `requirePageAccess(...)` redirige a `/sin-acceso`. El menú lateral solo muestra los módulos que el rol puede leer.
- Algunas lecturas admiten varios permisos porque las usan formularios de otros módulos (por ejemplo, `getClients` desde contratos).

Públicas por diseño: `loginAction`, `portalLoginAction` y `logoutAction`. Los helpers que no deben ser endpoints (`verifyCredentials`, `verifyCostCenterCredentials`, `ensureDefaultRoles`, `getUserRoleName`) están en módulos `server-only`, fuera de los archivos `"use server"`.

La migración `drizzle/0046_role_permissions_panel_field.sql` cambia los roles por defecto: TÉCNICO DE CAMPO pasa a `work_orders:field` y SOPORTE a `work_orders:panel:read`. Con la matriz actual, clientes, contratos, equipos, cotizaciones, facturas, rutas, maestros y mantenimiento solo son accesibles para ADMINISTRADOR hasta que se editen los roles.

### Despliegue: se cierran todas las sesiones

El cambio de formato, secretos y nombre de cookie invalida **todas** las sesiones activas de personal y del portal. Tras desplegar, todos los usuarios (incluidos los técnicos de campo) deben iniciar sesión de nuevo. La variable `AUTH_SECRET` deja de usarse.
