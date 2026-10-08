# HTL Elevadores

Aplicación web para la gestión operativa de una empresa de mantenimiento de elevadores. Centraliza clientes, sedes, equipos, contratos, órdenes de trabajo, mantenimiento preventivo, seguridad, evidencias fotográficas, rutas de técnicos, cotizaciones, reportes y documentos.

El backend incluye la lógica necesaria para una futura aplicación móvil para técnicos de campo. La especificación funcional y técnica de esa integración se encuentra en [`TECHNICIAN_APP_SPEC.md`](./TECHNICIAN_APP_SPEC.md).

## Tech Stack

- [Next.js 16](https://nextjs.org/) con App Router, Server Actions y API Routes
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Drizzle ORM](https://orm.drizzle.team/) y Drizzle Kit
- SQLite local mediante `@libsql/client`, compatible con Turso
- Cloudflare R2 para fotografías, firmas y otros archivos
- Tailwind CSS 4 mediante PostCSS
- ESLint 9 y `eslint-config-next`
- React Hook Form, Zod, Radix/Base UI y componentes reutilizables
- `tsx` para ejecutar scripts operativos en TypeScript

## Requisitos Previos

- Node.js 20 o superior
- npm 10 o superior
- Una copia de las variables de entorno requeridas
- Opcionalmente, una base de datos Turso y un bucket Cloudflare R2 para las funciones remotas

## Instalación

1. Clona el repositorio y entra en el proyecto:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd htl-elevadores
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Crea el archivo local de variables de entorno:

   ```bash
   cp .env.example .env.local
   ```

   En Windows PowerShell puede usarse:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Completa los valores de `.env.local`. Para desarrollo local, `TURSO_DATABASE_URL=file:local.db` permite utilizar la base SQLite incluida en el entorno de desarrollo.

5. Sincroniza el esquema de la base de datos. El comando usa `drizzle.config.ts` y `.env.local`:

   ```bash
   npx drizzle-kit push
   ```

6. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Variables De Entorno

Las variables se documentan en [`.env.example`](./.env.example). Las principales son:

| Variable | Uso |
|---|---|
| `TURSO_DATABASE_URL` | URL de SQLite local o base Turso |
| `TURSO_AUTH_TOKEN` | Token de autenticación de Turso, si aplica |
| `STAFF_SESSION_SECRET` | Secreto para firmar las sesiones del personal (ver [`SECURITY.md`](./SECURITY.md)) |
| `PORTAL_SESSION_SECRET` | Secreto para firmar las sesiones del portal del cliente; debe ser distinto del anterior |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` | Identificación del almacenamiento Cloudflare R2 |
| `R2_PRIVATE_BUCKET_NAME` | Bucket R2 sin acceso público para los PDFs de contratos y cotizaciones |
| `R2_S3_API`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Acceso S3-compatible a R2 |
| `R2_PUBLIC_URL` | URL pública base de los archivos |
| `NEXT_PUBLIC_R2_*` | URLs públicas de imágenes usadas en documentos PDF |

No subas `.env.local` ni secretos al repositorio. El archivo `local.db` puede contener datos locales y debe conservarse o eliminarse únicamente según la política de datos del proyecto.

## Comandos Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia Next.js en modo desarrollo |
| `npm run build` | Genera el build de producción |
| `npm run start` | Inicia el build de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Comprueba los tipos con TypeScript |
| `npm test` | Ejecuta los tests de seguridad contra una base SQLite temporal |
| `npx drizzle-kit push` | Aplica el esquema directamente a la base configurada |
| `npx drizzle-kit generate` | Genera una migración a partir de cambios en el esquema |
| `npx drizzle-kit migrate` | Ejecuta las migraciones de `drizzle/` |
| `npx drizzle-kit studio` | Abre Drizzle Studio |

El `package.json` actualmente define los scripts npm de Next.js y lint; los comandos de Drizzle se ejecutan mediante `npx` porque todavía no existen alias `db:*` en `package.json`.

Los scripts operativos se ejecutan, normalmente, con:

```bash
npx tsx --env-file=.env.local scripts/<script>.ts
```

Revisa cada script antes de usar `--apply`: varios modifican datos. Los scripts de verificación están diseñados para hacer rollback de sus datos de prueba.

## Estructura Del Proyecto

```text
.
├── src/
│   ├── app/              # Rutas, layouts, páginas y estilos globales del App Router
│   ├── components/       # Componentes compartidos y primitives de UI
│   ├── db/               # Cliente Drizzle y esquema SQLite/Turso
│   ├── features/         # Dominios funcionales: auth, técnicos, OT, equipos, contratos, etc.
│   ├── lib/              # Utilidades transversales, fechas, documentos, R2 y errores
│   └── types/            # Declaraciones TypeScript adicionales
├── drizzle/              # Migraciones SQL y metadatos generados por Drizzle Kit
├── scripts/              # Migraciones de datos, backfills, limpieza y verificaciones manuales
├── public/               # Logos, fuentes y otros recursos estáticos
├── .env.example          # Plantilla de configuración
├── drizzle.config.ts     # Configuración de Drizzle Kit
├── next.config.ts        # Configuración de Next.js
└── TECHNICIAN_APP_SPEC.md# Contrato técnico de la futura app móvil de técnicos
```

La organización actual de `src` es adecuada para crecer: cada dominio mantiene sus acciones, consultas, esquemas y componentes dentro de `features`, mientras que `components/ui` contiene piezas genéricas. `drizzle/` debe conservar sus migraciones numeradas y su carpeta `meta/`; `public/` puede seguir agrupando recursos por tipo, como `fonts/`, `logos/` e imágenes.

## Contribución

1. Crea una rama descriptiva desde la rama principal.
2. Mantén la lógica de negocio dentro del `feature` correspondiente y evita colocar código de dominio en `lib` o componentes genéricos.
3. Si cambias `src/db/schema.ts`, genera y revisa la migración de Drizzle correspondiente.
4. Actualiza `TECHNICIAN_APP_SPEC.md` cuando cambien los contratos usados por la app móvil.
5. Ejecuta `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` antes de abrir un pull request.
6. Documenta cualquier migración de datos y prueba primero en una copia de la base de datos.

## Documentación Relacionada

- [`TECHNICIAN_APP_SPEC.md`](./TECHNICIAN_APP_SPEC.md): especificación del backend y de la integración con la app Flutter para técnicos.
- [`AGENTS.md`](./AGENTS.md): instrucciones de trabajo específicas del entorno Next.js del repositorio.
- [`CLAUDE.md`](./CLAUDE.md): referencia para herramientas de IA compatibles.
