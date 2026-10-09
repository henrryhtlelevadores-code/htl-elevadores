# Seguridad

Notas operativas del modelo de seguridad de HTL Elevadores. Complementa al README.

## Antes de desplegar

1. Definir en el entorno `STAFF_SESSION_SECRET` y `PORTAL_SESSION_SECRET` (distintos; `openssl rand -hex 32`). `AUTH_SECRET` deja de usarse.
2. Crear un bucket R2 **sin acceso público** y definir `R2_PRIVATE_BUCKET_NAME`.
3. Aplicar las migraciones `0045` a `0049` con `npx tsx scripts/apply-sql.ts drizzle/<archivo>.sql`. Deben estar aplicadas **antes** de que arranque el código nuevo: sin `session_version` no se puede resolver ninguna sesión.
4. Desplegar.
5. Ejecutar `npx tsx scripts/migrate-pdfs-to-private.ts --dry-run` y luego sin `--dry-run`.

**El despliegue cierra todas las sesiones activas**, de personal y del portal: cambian el formato del token, los secretos y el nombre de las cookies. Todos los usuarios, incluidos los técnicos de campo, deben iniciar sesión de nuevo.

## Sesiones

| Tipo | Cookie (producción) | Secreto | Duración |
|---|---|---|---|
| Personal (staff) | `__Host-htl_staff_session` | `STAFF_SESSION_SECRET` | 7 días, renovación deslizante |
| Portal del cliente | `__Host-htl_portal_session` | `PORTAL_SESSION_SECRET` | 24 horas |

- El token es `v2.<tipo>.<sujeto>.<versión>.<exp>.<firma>` (HMAC-SHA256). El tipo va firmado y cada tipo usa su propio secreto, así que un token del portal no sirve como sesión de personal.
- En producción no se emite ni valida ninguna sesión si falta alguno de los dos secretos o si son iguales.
- Las cookies son `HttpOnly`, `Secure` (producción), `SameSite=Lax`, `Path=/` y sin `Domain`. En desarrollo sobre http se usan sin el prefijo `__Host-`.
- `src/proxy.ts` solo comprueba firma, tipo y expiración. La validación completa (usuario existente, activo, no eliminado y con la versión vigente) se hace contra la base en `getSessionUser` / `getPortalSessionCostCenterId`. Ante un error de consulta la sesión se considera inválida.

### Revocación

Cada usuario tiene `users.session_version` y cada sede `cost_center.portal_session_version`. El valor viaja dentro del token y se compara con la base al resolver la sesión.

La versión se incrementa, y por tanto se cierran las sesiones abiertas, cuando:

- se cambia la contraseña de un usuario, su rol o su estado, o se elimina;
- se establece o se borra la credencial del portal de una sede.

Quien se modifica a sí mismo conserva la sesión desde la que hizo el cambio. Un usuario `INACTIVE` no puede iniciar sesión.

## Permisos por rol

Los permisos viven en `roles.permissions` (lista JSON) y se evalúan en `src/features/auth/permissions.ts`.

- Un permiso son segmentos separados por `:`, por ejemplo `users:read` o `work_orders:panel:write`.
- Un permiso concedido cubre al requerido cuando sus segmentos son un **prefijo exacto**: `work_orders` cubre `work_orders:panel:write`; `users:read` no cubre `users:write` ni `users:readonly`.
- `*` cubre todo. Escritura no implica lectura: un rol necesita `modulo` (ambas) o los dos permisos.
- Un rol desactivado no concede nada.

Módulos: `clients`, `contracts`, `equipment`, `invoices`, `maintenance`, `masters`, `quotations`, `reports` (más `reports:approve`), `routes`, `safety`, `users` y `work_orders:panel`. La app del técnico usa `work_orders:field`.

Cómo se aplica:

- **Server actions** (`src/features/*/actions.ts`): cada función exportada empieza con `requirePermission(...)` (lecturas, lanza `AuthError`) o `denyUnless(...)` (mutaciones, devuelve `{ success: false, error }`). El proxy **no** protege las server actions: una acción nueva sin guard queda pública.
- **Rutas API**: `authorizeApi(...)` responde 401 o 403.
- **Páginas del panel**: `requirePageAccess(...)` redirige a `/sin-acceso`. El menú solo muestra los módulos que el rol puede leer.
- Algunas lecturas admiten varios permisos porque las usan formularios de otros módulos (por ejemplo, `getClients` desde contratos).

Públicas por diseño: `loginAction`, `portalLoginAction` y `logoutAction`. Los helpers que no deben ser endpoints (`verifyCredentials`, `verifyCostCenterCredentials`, `ensureDefaultRoles`, `getUserRoleName`, las lecturas internas de cotizaciones y la generación de PDF) están en módulos `server-only`, fuera de los archivos `"use server"`.

La migración `0046` cambia los roles por defecto: TÉCNICO DE CAMPO pasa a `work_orders:field` y SOPORTE a `work_orders:panel:read`. Con la matriz actual, clientes, contratos, equipos, cotizaciones, facturas, rutas, maestros y mantenimiento solo son accesibles para ADMINISTRADOR hasta que se editen los roles.

## Portal del cliente

El hash de la credencial de una sede nunca se envía al navegador: el panel solo recibe si la sede tiene credencial (`hasPortalPassword`).

Todo recurso del portal se carga filtrando por la sede de la **sesión**, nunca por la de la URL. Una cotización, informe, equipo o contrato de otra sede responde 404. Al navegador solo llegan número y PDF de la cotización, no costos ni márgenes.

## App de técnicos (`/api/mobile/v1`)

La app móvil usa este mismo backend a través de rutas propias; no hay otro servidor ni otra base.

- **Autenticación:** `POST /auth/login` devuelve un token que la app envía como `Authorization: Bearer`. Es un token de tipo `mobile`: solo lo aceptan estas rutas. No sirve como cookie del panel, y las cookies del panel no autentican la API móvil.
- **Quién puede entrar:** usuarios activos cuyo rol tenga el permiso `work_orders:field`. El login comparte el rate limit con el del panel.
- **Duración y revocación:** 7 días, renovable con `POST /auth/refresh`. Se comprueba en cada petición contra `session_version` y el estado del usuario, así que cambiar la contraseña o desactivar al técnico lo deja fuera de inmediato.
- **Pertenencia:** cada operación comprueba que la orden o el equipo estén asignados al técnico. Un recurso ajeno responde 404.
- **Idempotencia:** la app reintenta envíos cuando recupera señal. Repetir una operación ya aplicada responde bien y no cambia nada; fotos, audios e ítems de seguridad usan el ID que generó la app (debe ser un UUID).
- **Hora del teléfono:** se respeta la hora en que el técnico hizo cada cambio, salvo que esté más de 5 minutos en el futuro o más de 30 días atrás; en ese caso se usa la del servidor.
- **Archivos:** las fotos se validan por contenido, igual que las de cotización. Las notas de voz (M4A, máximo 5 MB) van al bucket privado y se entregan con URL firmada de una hora. Requiere la migración `0049`.
- **Códigos de respuesta:** 401 detiene la cola de la app hasta volver a iniciar sesión; 4xx significa que reintentar no sirve; 5xx, que la app debe reintentar.

La regla de fotos difiere de la vista web del técnico: en la app el mínimo de 4 fotos solo aplica a preventivos (`PREV`); en la web también a correctivos.

## Inicio de sesión

### Rate limiting

- 5 fallos en 15 minutos bloquean 15 minutos; cada bloqueo posterior dentro de 24 horas dura el doble, con tope de 24 horas.
- La clave es IP + correo (personal) o IP + sede (portal). Un acierto borra el historial; los aciertos no cuentan.
- La comprobación va antes de Argon2: una petición bloqueada no hashea.
- Los fallos se guardan en la tabla `login_attempts` (compartida entre instancias). Al registrar un fallo se purgan los de más de 30 días. `RATE_LIMIT_STORE=memory` usa un almacén en memoria, solo válido para desarrollo y tests.

**IP del cliente.** Solo se confía en las cabeceras que fija la plataforma: en Vercel, `x-real-ip` / `x-vercel-forwarded-for`. `X-Forwarded-For` crudo no se usa porque lo controla el cliente. Fuera de Vercel la IP es `unknown` y el límite cuenta solo por correo o sede; si se despliega tras otro proxy de confianza, hay que añadir su cabecera en `src/lib/client-ip.ts`.

### Contraseñas

- Mínimo 10 caracteres para el personal y 6 para el portal.
- Se rechazan las 10 000 contraseñas más comunes (lista de SecLists).
- A las escritas a mano se les exige composición: 3 de 4 clases de caracteres (personal) o 2 (portal).
- La validación es de servidor (`src/lib/password-policy.ts`).

### Generador asistido

`src/lib/password-generator.ts`, expuesto por `generatePasswordAction` a quien puede fijar contraseñas. Toda la aleatoriedad sale de `crypto.randomInt`.

- **Palabra propia o sugerida:** `Palabra` + separador + dígitos (+ 5 caracteres aleatorios para el personal).
- **Frase:** 4 palabras de `src/lib/wordlist-es.ts` más 2 dígitos.
- La palabra semilla debe tener 4 a 12 letras `a-z` y no puede ser el nombre, el correo o el dominio del usuario, contener `htl`, ni estar entre las contraseñas comunes.
- Ni la semilla ni la contraseña generada se registran en logs ni se guardan. La contraseña se muestra una sola vez.
- `passwordGenerated: true` llega del cliente, así que solo exime de la regla de composición; longitud y lista común se comprueban siempre.

## Archivos

### PDFs de contratos y cotizaciones

- Se guardan en `R2_PRIVATE_BUCKET_NAME` con clave aleatoria (`contracts/<uuid>.pdf`, `quotations/<uuid>.pdf`).
- El navegador nunca recibe la URL del bucket. Las rutas `/api/quotations/[id]/pdf`, `/api/contracts/[id]/pdf` y sus equivalentes bajo `/api/portal/[costCenterId]/` validan sesión, permiso y pertenencia, y redirigen a una URL firmada de 5 minutos.
- Los PDFs antiguos que siguen en el bucket público se sirven a través de la app hasta que se migren.

`scripts/migrate-pdfs-to-private.ts`:

- Por defecto solo copia y guarda la clave; no borra nada.
- Es idempotente: salta las filas ya copiadas.
- `--dry-run` muestra lo que haría.
- `--delete-public` es un paso aparte: borra el objeto público solo si la copia privada existe. Ejecutarlo días después, tras verificar en producción.

### Imágenes de cotización

Máximo 4 MB (por debajo del tope de 4,5 MB por petición de Vercel); solo JPEG, PNG y WebP, decidido por los primeros bytes del archivo (no por `Content-Type` ni extensión). SVG se rechaza. Nombre y extensión se generan en servidor.

## Cabeceras y CSRF

`next.config.ts` añade a todas las respuestas `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` y, fuera de desarrollo, `Strict-Transport-Security`.

- La CSP es estática. `script-src` conserva `'unsafe-inline'` porque Next inserta scripts en línea para la hidratación.
- Permite Google Fonts, el bucket público de R2 (imágenes), las URLs firmadas de R2 (iframes de PDF) y los orígenes del dictado por voz del técnico (Hugging Face y jsDelivr).
- `CSP_REPORT_ONLY=true` la despliega sin bloquear, para observar antes de aplicarla.

`src/proxy.ts` rechaza con 403 todo `POST`/`PUT`/`PATCH`/`DELETE` cuyo `Origin` no sea el propio host o cuyo `Sec-Fetch-Site` sea `cross-site`, también en `/api`.

## Deuda conocida

- **Contraseñas antiguas de menos de 10 caracteres** siguen siendo válidas; no hay cambio forzado. Conviene rotarlas a mano con el generador.
- **Sin registro de auditoría** de acciones sensibles (altas, bajas, cambios de rol o contraseña).
- **`'unsafe-inline'` en `script-src`**: eliminarlo exige nonces generados en el proxy.
- **La vista web del técnico** (`src/features/technician`) no se revisó en esta ronda: la reemplaza la app móvil.
- **Transcripción de notas de voz:** los audios se guardan, pero no se transcriben (`transcript_status = NONE`).

## Tests

`npm test` ejecuta la suite de seguridad (`tests/`) contra una base SQLite temporal creada desde `src/db/schema.ts`. Nunca toca Turso.
