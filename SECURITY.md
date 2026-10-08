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

### Despliegue: se cierran todas las sesiones

El cambio de formato, secretos y nombre de cookie invalida **todas** las sesiones activas de personal y del portal. Tras desplegar, todos los usuarios (incluidos los técnicos de campo) deben iniciar sesión de nuevo. La variable `AUTH_SECRET` deja de usarse.
