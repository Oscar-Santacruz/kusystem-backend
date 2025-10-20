# kuSystem Backend (Express + Prisma + PostgreSQL)

API REST desacoplada para kuSystem. Stack: Node.js, TypeScript, Express, Prisma y PostgreSQL.

## Requisitos
- Node.js 18+
- PostgreSQL corriendo en `localhost:5432`

## Configuración
1. Copiar `.env.example` a `.env` y ajustar variables:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres?schema=public
ALLOW_ORIGIN=http://localhost:5173
PORT=4000
SENTRY_DSN=
NEW_RELIC_LICENSE_KEY=
NEW_RELIC_APP_NAME=kusystem-backend
```

2. Instalar dependencias:
```
npm install
```

3. Generar cliente Prisma y aplicar migraciones:
```
npx prisma generate
npx prisma migrate dev --name init
```

4. Ejecutar en desarrollo:
```
npm run dev
```

## Endpoints
- Salud: `GET /health`

- Calendario HR (requiere cabecera `X-Tenant-Id`):
  - `GET /hr/calendar/week?start=YYYY-MM-DD`
  - `PUT /hr/calendar/week/:employeeId/:date`
  - `GET /hr/calendar/employees`

- Clientes:
  - `GET /clients?search=&page=1&pageSize=20`
  - `GET /clients/:id`
  - `POST /clients`
  - `PUT /clients/:id`
  - `DELETE /clients/:id`

- Sucursales de cliente:
  - `GET /clients/:clientId/branches`
  - `POST /clients/:clientId/branches`
  - `GET /client-branches/:id`
  - `PUT /client-branches/:id`
  - `DELETE /client-branches/:id`

- Productos:
  - `GET /products?search=&page=1&pageSize=20`
  - `GET /products/:id`
  - `POST /products`
  - `PUT /products/:id`
  - `DELETE /products/:id`

- Presupuestos (Quotes):
  - `GET /quotes?search=&page=1&pageSize=20`
  - `GET /quotes/:id`
  - `POST /quotes`
  - `PUT /quotes/:id`
  - `DELETE /quotes/:id`

Notas:
- Los campos monetarios y cantidades usan `Decimal` en BD; las respuestas convierten a `number`.
- Validaciones con `zod` en los endpoints.
- CORS permite por defecto `http://localhost:5173` (Vite). Cambiar `ALLOW_ORIGIN` si es necesario.
- Para habilitar el Calendario HR en una base existente ejecutar: `npx prisma migrate deploy` y luego `npm run prisma:seed`.
