# HTL Técnicos — App Móvil Flutter — Especificación Técnica

> **Fecha de generación:** 2026-10-03  
> **Versión del schema:** Migración `0043_fixed_module_calendar.sql` (última en `drizzle/`)  
> **Nota:** Documento generado a partir del análisis estático del backend actual (`src/db/schema.ts`, `src/features/technician/`, `src/features/auth/`, `src/app/api/`). Cualquier cambio en el schema o endpoints debe reflejarse aquí.

---

## 1. Contexto General de Arquitectura

### 1.1 Stack Tecnológico del Backend
- **Runtime / Framework:** Next.js (App Router, Server Actions, API Routes).
- **ORM:** Drizzle ORM.
- **Base de Datos:** SQLite / Turso (`libsql`).
- **Almacenamiento de Archivos:** Cloudflare R2 (S3-compatible) para fotos de evidencia y firmas digitales (PNG/JPEG).

### 1.2 Sistema de Autenticación
- **Mecanismo actual en Web:** Cookie HTTP-only llamada `htl_session`.
- **Formato del Token:** Token firmado HMAC-SHA256 con formato:
  $$\text{token} = \text{userId} + "." + \text{expTimestamp} + "." + \text{hmacSignature}$$
- **Duración de Sesión:** 7 días (`SESSION_TTL_SECONDS = 604800`).
- **Verificación:** `verifySessionToken(token)` en `src/features/auth/session.ts` valida el secreto `AUTH_SECRET`, la fecha de expiración y la firma criptográfica.
- **Roles de Usuario Relevantes:**
  - `roles.isFieldRole = true`: Identifica al personal de campo (técnicos).
  - Nombre estándar de rol: `"TECNICO DE CAMPO"` (o cualquier rol con `isFieldRole: true`).

---

## 2. Modelos de Datos Relevantes (Schema Drizzle / SQLite)

### 2.1 Tabla `users` y `roles`
| Campo | Tipo SQLite | Nullable | Descripción / Enums |
|---|---|---|---|
| `id` | `text` | No (PK) | UUID v4 |
| `email` | `text` | No | Único, credencial de acceso |
| `passwordHash` | `text` | No | Hash bcrypt/argon2 |
| `fullName` | `text` | No | Nombre completo del técnico |
| `phone` | `text` | Sí | Teléfono de contacto |
| `roleId` | `text` | No (FK) | Referencia a `roles.id` |
| `status` | `text` | Sí | Default `'ACTIVE'` (`'ACTIVE'`, `'INACTIVE'`) |
| `lastLoginAt` | `integer` | Sí | Timestamp unix en segundos |
| `deletedAt` | `integer` | Sí | Soft delete |

### 2.2 Tabla `work_orders` (Órdenes de Trabajo)
| Campo | Tipo SQLite | Nullable | Descripción / Enums |
|---|---|---|---|
| `id` | `text` | No (PK) | UUID v4 |
| `otNumber` | `text` | No | Código único correlativo (ej. `OT-2026-001`) |
| `costCenterId` | `text` | No (FK) | Referencia a `cost_centers.id` (Edificio / Sede) |
| `technicianId` | `text` | Sí (FK) | Referencia a `users.id` (Técnico asignado) |
| `serviceTypeId` | `text` | Sí (FK) | Referencia a `service_types.id` |
| `status` | `text` | Sí | `'PENDING'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'CANCELLED'` (Default `'PENDING'`) |
| `priority` | `text` | Sí | `'LOW'`, `'NORMAL'`, `'HIGH'`, `'URGENT'` (Default `'NORMAL'`) |
| `approvalStatus` | `text` | Sí | `'PENDING'`, `'APPROVED'`, `'REJECTED'` (Default `'PENDING'`) |
| `approvedBy` | `text` | Sí (FK) | ID del usuario Admin aprobador |
| `approvedAt` | `integer` | Sí | Timestamp unix (ms o seg) de aprobación |
| `scheduledDate` | `text` | Sí | Fecha programada (`YYYY-MM-DD`) |
| `scheduledTime` | `text` | Sí | Hora programada (`HH:mm`) |
| `startedAt` | `integer` | Sí | Timestamp de inicio real de la OT |
| `completedAt` | `integer` | Sí | Timestamp de finalización de la OT |
| `checkinLatitude` | `real` | Sí | Latitud GPS al hacer check-in |
| `checkinLongitude` | `real` | Sí | Longitud GPS al hacer check-in |
| `description` | `text` | Sí | Descripción de los trabajos a realizar |
| `closingNotes` | `text` | Sí | Observaciones de cierre |
| `clientSignerName` | `text` | Sí | Nombre del cliente/administrador que firma |
| `clientSignatureUrl` | `text` | Sí | URL en R2 de la firma del cliente |
| `deletedAt` | `integer` | Sí | Soft delete timestamp |

### 2.3 Tabla `work_order_elevators` (Equipos asignados a la OT)
| Campo | Tipo SQLite | Nullable | Descripción / Enums |
|---|---|---|---|
| `id` | `text` | No (PK) | UUID v4 |
| `workOrderId` | `text` | No (FK) | Referencia a `work_orders.id` (Cascade) |
| `elevatorUnityId` | `text` | No (FK) | Referencia a `elevator_unities.id` |
| `contractElevatorId` | `text` | Sí (FK) | Referencia a `contract_elevators.id` |
| `status` | `text` | Sí | `'PENDING'`, `'COMPLETED'` (Default `'PENDING'`) |
| `finding` | `text` | Sí | Diagnóstico / Hallazgos encontrados por el técnico |
| `evidencePhotoUrls` | `text (JSON)` | Sí | Array JSON de URLs de fotos legacy |
| `finalStatus` | `text` | Sí | Estado final del equipo: `'OPERATIVE'`, `'OUT_OF_SERVICE'`, `'UNCOMPLETED_MAINTENANCE'` |
| `startedAt` | `integer` | Sí | Timestamp de inicio de atención del ascensor |
| `completedAt` | `integer` | Sí | Timestamp de finalización del ascensor |

### 2.4 Tabla `work_order_tasks` (Checklist de Tareas de Mantenimiento)
| Campo | Tipo SQLite | Nullable | Descripción / Enums |
|---|---|---|---|
| `id` | `text` | No (PK) | UUID v4 |
| `workOrderElevatorId` | `text` | No (FK) | Referencia a `work_order_elevators.id` (Cascade) |
| `taskDescription` | `text` | No | Descripción de la tarea (ej. "Revisar frenos") |
| `maintenanceTaskId` | `text` | Sí (FK) | Referencia al catálogo `maintenance_tasks.id` |
| `moduleId` | `text` | Sí (FK) | Referencia a `maintenance_modules.id` (M1, M2, etc.) |
| `isCritical` | `integer (bool)`| Sí | Flag de tarea crítica (`true` / `false`) |
| `isCompleted` | `integer (bool)`| Sí | Flag completado (`true` / `false`) |
| `status` | `text` | Sí | `'PENDING'`, `'COMPLETED'`, `'SKIPPED'`, `'NOT_APPLICABLE'` |
| `requiresPhoto` | `integer (bool)`| Sí | Si exige foto obligatoria para la tarea |
| `observations` | `text` | Sí | Observaciones específicas de la tarea |
| `evidencePhotoUrl` | `text` | Sí | URL de foto asociada |
| `completedAt` | `integer` | Sí | Timestamp de completion |

### 2.5 Tablas de Seguridad (`safety_templates`, `work_order_elevator_safety`, `work_order_elevator_safety_items`)
- **`safety_templates`**:
  - `id`: PK UUID.
  - `equipmentTypeId`: FK a `elevator_types.id`.
  - `name`: Nombre de la plantilla de seguridad.
  - `version`: Versión (ej. `"v1.0"`).
  - `content`: Snapshot JSON de preguntas del checklist.
  - `isActive`: Boolean.
- **`work_order_elevator_safety`**:
  - `id`: PK UUID.
  - `workOrderElevatorId`: FK a `work_order_elevators.id`.
  - `templateId`: FK a `safety_templates.id`.
  - `status`: `'PENDING'`, `'COMPLETED'`.
  - `notes`: Observaciones generales de seguridad.
  - `geolocation`: JSON `{ latitude: number, longitude: number }`.
  - `completedAt`: Timestamp.
- **`work_order_elevator_safety_items`**:
  - `id`: PK UUID.
  - `safetyRecordId`: FK a `work_order_elevator_safety.id`.
  - `question`: Texto de la pregunta de seguridad.
  - `response`: `'SI'`, `'NO'`, `'NA'`.
  - `observations`: Texto (obligatorio si `response == 'NO'`).
  - `orderIndex`: Número de orden en la lista.
  - `answeredAt`: Timestamp de respuesta.

### 2.6 Tabla `work_order_elevator_photos` (Evidencia Fotográfica)
| Campo | Tipo SQLite | Nullable | Descripción / Enums |
|---|---|---|---|
| `id` | `text` | No (PK) | UUID v4 |
| `workOrderElevatorId` | `text` | No (FK) | Referencia a `work_order_elevators.id` |
| `workOrderTaskId` | `text` | Sí (FK) | Opcional, enlace a tarea específica |
| `url` | `text` | No | URL pública del archivo en Cloudflare R2 |
| `tag` | `text` | No | Clasificación: `'BEFORE'` (Antes), `'AFTER'` (Después), `'POINT'` (Punto de atención) |
| `description` | `text` | Sí | Leyenda o descripción de la imagen |
| `createdAt` | `integer` | Sí | Timestamp de creación |

### 2.7 Tablas de Rutas Preventivas (`preventive_routes`, `preventive_route_stops`)
- **`preventive_routes`**:
  - `id`: PK UUID.
  - `technicianId`: FK `users.id`.
  - `businessDayNumber`: Día hábil del ciclo (1 a 20).
  - `name`: Nombre descriptivo de la ruta.
  - `isActive`: Boolean.
- **`preventive_route_stops`**:
  - `id`: PK UUID.
  - `routeId`: FK `preventive_routes.id`.
  - `contractElevatorId`: FK `contract_elevators.id`.
  - `plannedTime`: Hora planificada (`HH:mm`).
  - `orderIndex`: Posición en la ruta.
  - `visitGroupId`: Agrupador de paradas en el mismo edificio.
  - `estimatedDurationMins`: Duración estimada en minutos.
  - `generatedWorkOrderId`: FK `work_orders.id` vinculada a la parada del mes.
  - `generatedMonth`: Mes generado (`YYYY-MM`).

---

## 3. Lógica de Negocio y Reglas Operativas del Técnico

1. **Requisitos para Iniciar una OT (`startWorkOrder`):**
   - El técnico debe estar asignado a la OT (`workOrders.technicianId == session.userId`).
   - La OT pasa de `PENDING` a `IN_PROGRESS`.
   - Se crean automáticamente los registros de seguridad (`work_order_elevator_safety` y sus `items`) a partir de la plantilla activa correspondiente al tipo de cada elevador (`safety_templates`).
   - Todos los ascensores asignados cambian su estado operativo a `'MAINTENANCE'`.
   - Se fija `startedAt` en la OT y en cada `work_order_elevators`.

2. **Checklist de Seguridad Obligatorio:**
   - Para poder finalizar un elevador o la OT, el checklist de seguridad debe estar en `status = 'COMPLETED'`.
   - Cada ítem debe tener una respuesta (`'SI'`, `'NO'`, `'NA'`).
   - Al completar la seguridad se captura la geolocalización GPS `{ latitude, longitude }`.

3. **Checklist de Mantenimiento:**
   - Las tareas pertenecen a módulos (`M1` a `M8` según calendario y tipo de equipo) o a tareas generales.
   - El técnico puede marcar tareas individualmente (`updateWorkOrderTask`) o en bloque por módulo (`bulkUpdateModuleTasks`).
   - Estados de tarea: `'PENDING'`, `'COMPLETED'`, `'SKIPPED'`, `'NOT_APPLICABLE'`.

4. **Reglas de Evidencia Fotográfica Mínima (`MIN_PHOTOS = 4`):**
   - En servicios de tipo Preventivo (`PREV`) y Correctivo (`CORR`), se exige un mínimo de 4 fotografías por elevador antes de poder marcar el equipo como completado (`completeElevator`).
   - Las fotos se categorizan como `'BEFORE'`, `'AFTER'` o `'POINT'`.

5. **Modos de Finalización de Equipo (`completeElevator`):**
   - `mode = "all_completed"`: Marca todas las tareas pendientes del equipo como `COMPLETED`.
   - `mode = "partial"`: Deja el estado de las tareas tal como están registradas.
   - Requiere que la seguridad esté en `COMPLETED` y que cumpla el mínimo de fotos (si aplica).

6. **Cierre y Firma de la Orden (`completeWorkOrder`):**
   - Todos los elevadores de la OT deben estar en `status = 'COMPLETED'` y tener su seguridad en `COMPLETED`.
   - El técnico debe ingresar el `clientName` (Nombre de quien recibe/firma).
   - Se debe proporcionar la firma manuscrita en formato imagen/dataUrl (`signatureDataUrl`).
   - El técnico debe clasificar el estado final operativo de **cada ascensor** (`elevatorStatuses`):
     - `'OPERATIVE'` (Operativo / En funcionamiento).
     - `'OUT_OF_SERVICE'` (Fuera de servicio / Detenido).
     - `'UNCOMPLETED_MAINTENANCE'` (Mantenimiento no culminado).
   - Al cerrar la OT:
     - `workOrders.status = 'COMPLETED'`.
     - Se actualiza `finalStatus` en `workOrderElevators` y el `status` en `elevatorUnities`.

---

## 4. Matriz de Acciones / Endpoints

### 4.1 Backend Actual: Server Actions de Next.js (`src/features/technician/actions.ts` y `queries.ts`)

| Función / Action | Tipo Actual | Entrada / Parámetros | Salida / Retorno |
|---|---|---|---|
| `loginAction` | Server Action (`auth/actions.ts`) | `{ email, password }` | `{ success: bool, message, redirectTo }` |
| `getTechnicianContext` | Query Server (`technician/queries.ts`) | Ninguno (usa sesión) | `{ userId, fullName, roleName }` |
| `getTechnicianWorkOrders` | Query Server (`technician/queries.ts`) | `technicianId` | `TechnicianWorkOrder[]` |
| `getTechnicianEmergencies` | Query Server (`technician/queries.ts`) | `technicianId` | `TechnicianEmergency[]` (con SLA) |
| `getTechnicianWorkOrderExecution` | Query Server (`technician/queries.ts`) | `technicianId, workOrderId` | `TechnicianWorkOrderExecution` (Detalle completo) |
| `startWorkOrder` | Server Action (`technician/actions.ts`) | `workOrderId: string` | `{ success: bool, message, error }` |
| `saveSafetyItem` | Server Action (`technician/actions.ts`) | `itemId: string, data: { response?, observations? }` | `{ success: bool, message, error }` |
| `saveSafetyNotes` | Server Action (`technician/actions.ts`) | `elevatorId: string, notes: string` | `{ success: bool, message, error }` |
| `completeElevatorSafety` | Server Action (`technician/actions.ts`) | `{ elevatorId, geolocation: { latitude, longitude } }` | `{ success: bool, message, error }` |
| `updateWorkOrderTask` | Server Action (`technician/actions.ts`) | `taskId, { isCompleted?, status?, observations? }` | `{ success: bool, message, error }` |
| `bulkUpdateModuleTasks` | Server Action (`technician/actions.ts`) | `{ elevatorId, moduleId, isCompleted }` | `{ success: bool, message, error }` |
| `updateElevatorFindings` | Server Action (`technician/actions.ts`) | `{ elevatorId, findings: string }` | `{ success: bool, message, error }` |
| `addElevatorPhoto` | Server Action (`technician/actions.ts`) | `{ elevatorId, taskId?, tag, description?, dataUrl }` | `{ success: bool, message, error }` |
| `removeElevatorPhoto` | Server Action (`technician/actions.ts`) | `photoId: string` | `{ success: bool, message, error }` |
| `completeElevator` | Server Action (`technician/actions.ts`) | `{ elevatorId, mode: "all_completed" \| "partial" }` | `{ success: bool, message, error }` |
| `completeWorkOrder` | Server Action (`technician/actions.ts`) | `{ workOrderId, clientName, signatureDataUrl, elevatorStatuses }` | `{ success: bool, message, error }` |

### 4.2 Endpoints REST HTTP Existentes en `src/app/api/`

| Ruta | Método | Roles Permitidos | Descripción |
|---|---|---|---|
| `/api/work-orders/[id]/approve` | `POST` | Admin | Aprueba una OT completada (`approvalStatus = 'APPROVED'`) |
| `/api/quotations/[id]/pdf` | `GET` | Autenticado | Descarga o genera PDF de cotización |

---

## 5. Especificación de Endpoints REST Requeridos para Flutter (Pendientes de Implementar en Backend)

Para conectar la app móvil Flutter de forma estándar sin depender de Server Actions de Next.js, se deben exponer los siguientes endpoints REST JSON bajo el prefijo `/api/mobile/v1/`:

### 5.1 `POST /api/mobile/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "tecnico@htl.com",
    "password": "mi_password"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "token": "userId.exp.signature",
    "user": {
      "id": "uuid-tecnico",
      "fullName": "Juan Pérez",
      "email": "tecnico@htl.com",
      "role": "TECNICO DE CAMPO"
    }
  }
  ```

### 5.2 `GET /api/mobile/v1/work-orders`
- **Headers:** `Authorization: Bearer <token>` o Cookie `htl_session`
- **Response `200 OK`:**
  ```json
  {
    "emergencies": [
      {
        "id": "wo-uuid-1",
        "otNumber": "OT-2026-0099",
        "status": "PENDING",
        "cost_center_name": "Edificio Los Rosales",
        "cost_center_address": "Av. Principal 123",
        "slaDeadline": 1775260800
      }
    ],
    "workOrders": [
      {
        "id": "wo-uuid-2",
        "otNumber": "OT-2026-0100",
        "status": "PENDING",
        "priority": "NORMAL",
        "scheduledDate": "2026-10-04",
        "scheduledTime": "09:00",
        "client_name": "Inversiones San Isidro SAC",
        "cost_center_name": "Torre Empresarial A",
        "cost_center_address": "Av. Las Camelias 450",
        "cost_center_phone": "999888777",
        "service_type_code": "PREV",
        "service_type_name": "Mantenimiento Preventivo Mensual",
        "service_type_category": "PREVENTIVO",
        "equipmentCount": 2
      }
    ]
  }
  ```

### 5.3 `GET /api/mobile/v1/work-orders/:id`
- **Response `200 OK`:** Retorna el objeto completo `TechnicianWorkOrderExecution` con costo, edificio, contactos, lista de elevadores, estado de seguridad, tareas agrupadas por módulo y fotos registradas.

### 5.4 `POST /api/mobile/v1/work-orders/:id/start`
- **Request:** `{}`
- **Response `200 OK`:** `{ "success": true, "message": "Orden iniciada" }`

### 5.5 `POST /api/mobile/v1/elevators/:elevatorId/safety/items/:itemId`
- **Request Body:**
  ```json
  {
    "response": "SI",
    "observations": null
  }
  ```
- **Response `200 OK`:** `{ "success": true }`

### 5.6 `POST /api/mobile/v1/elevators/:elevatorId/safety/complete`
- **Request Body:**
  ```json
  {
    "geolocation": {
      "latitude": -12.0968,
      "longitude": -77.0352
    }
  }
  ```
- **Response `200 OK`:** `{ "success": true, "message": "Seguridad completada" }`

### 5.7 `POST /api/mobile/v1/tasks/:taskId`
- **Request Body:**
  ```json
  {
    "isCompleted": true,
    "status": "COMPLETED",
    "observations": "Se ajustaron contactos"
  }
  ```

### 5.8 `POST /api/mobile/v1/elevators/:elevatorId/photos`
- **Request Body (Multipart o Base64 JSON):**
  ```json
  {
    "tag": "BEFORE",
    "taskId": null,
    "description": "Estado inicial del foso",
    "dataUrl": "data:image/jpeg;base64,..."
  }
  ```

### 5.9 `POST /api/mobile/v1/elevators/:elevatorId/complete`
- **Request Body:**
  ```json
  {
    "mode": "all_completed"
  }
  ```

### 5.10 `POST /api/mobile/v1/work-orders/:id/complete`
- **Request Body:**
  ```json
  {
    "clientName": "Carlos Mendoza (Administrador)",
    "signatureDataUrl": "data:image/png;base64,...",
    "elevatorStatuses": {
      "elevator-uuid-1": "OPERATIVE",
      "elevator-uuid-2": "OPERATIVE"
    }
  }
  ```

---

## 6. Arquitectura Móvil Flutter y Modo Offline-First

### 6.1 Esquema de Base de Datos Local en Flutter (SQLite / Drift o sqflite)
La app Flutter debe replicar localmente las tablas necesarias para operar sin conexión:
1. `local_work_orders` (Caché de OTs asignadas).
2. `local_elevators` (Ascensores de cada OT).
3. `local_safety_items` (Preguntas y respuestas del checklist de seguridad).
4. `local_tasks` (Checklist de tareas de mantenimiento).
5. `local_photos` (Ruta local del archivo de foto, tag, estado de subida `pending` | `uploaded`).
6. `sync_queue` (Cola de mutaciones pendientes de envío al backend).

### 6.2 Estrategia de Sincronización
1. **Descarga previa:** Al iniciar sesión o refrescar con internet, la app descarga las OTs asignadas al técnico con todos sus ascensores, plantillas de seguridad y tareas.
2. **Operación Local:** Cada cambio (responder pregunta, marcar tarea, tomar foto, capturar firma) se guarda inmediatamente en la base de datos SQLite local de Flutter y encola una mutación en `sync_queue`.
3. **Fotos Offline:** Las fotos tomadas se guardan en el sistema de archivos del dispositivo (`path_provider`) y se envían a Cloudflare R2 / Backend cuando se restablezca la conectividad.
4. **Despacho de Cola (Sync Queue):**
   - Un worker background en Flutter procesa `sync_queue` secuencialmente con reintentos exponenciales.
   - Las operaciones críticas (`startWorkOrder`, `completeWorkOrder`) son idempotentes en el backend.

---

## 7. Resumen de Estado de Implementación

| Componente | Estado Backend | Estado Móvil Flutter | Notas |
|---|---|---|---|
| Esquema de Base de Datos | **Completado** (`0043_fixed_module_calendar.sql`) | Pendiente de crear schema local Drift | Base de datos Turso / SQLite |
| Lógica de Seguridad (Safety Checklist) | **Completado** (`src/features/technician/actions.ts`) | Pendiente | Exige responder todo + GPS |
| Lógica de Checklist Mantenimiento | **Completado** (`src/features/technician/actions.ts`) | Pendiente | Tareas por módulo |
| Carga de Fotos a Cloudflare R2 | **Completado** (`src/lib/r2.ts`) | Pendiente | Base64 / Multipart a R2 |
| Cierre con Firma y Estado Final | **Completado** (`completeWorkOrder`) | Pendiente | Canvas de firma en Flutter |
| Rutas API REST para Móvil (`/api/mobile/v1/*`) | **Pendiente** | Pendiente | Requiere exponer endpoints REST JSON |
| Autenticación Token Bearer para Móvil | **Pendiente** | Pendiente | Adaptar `createSessionToken` para header Bearer |
