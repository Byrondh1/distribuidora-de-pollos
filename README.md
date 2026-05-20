# DistribuApp

SaaS multi-tenant para gestión de distribuidoras. Monorepo con app móvil (vendedores) y dashboard web (administradores), respaldado por Supabase.

## Stack

- **Monorepo**: pnpm 9 + Turborepo
- **Móvil**: React Native + Expo SDK 52 + expo-router + expo-secure-store
- **Web**: Next.js 15 + React 19 + Tailwind + shadcn/ui
- **Backend**: Supabase (Postgres 15, Auth, Realtime, Storage)
- **Tipos**: TypeScript estricto, Zod, tipos generados con `supabase gen types`

## Estructura

```
apps/
  mobile/     # Expo SDK 52 — vendedores
  web/        # Next.js 15 — admin dashboard
packages/
  shared/     # Zod schemas, constantes, tipos de Supabase
  supabase/   # Migraciones SQL + seed + config local
```

## Setup

Requisitos: Node ≥ 20.11, pnpm ≥ 9, [Supabase CLI](https://supabase.com/docs/guides/cli), Docker.

```bash
# 1. Instala dependencias
pnpm install

# 2. Arranca Supabase local (Postgres + Auth + Realtime + Studio)
pnpm supabase:start
# Toma los valores impresos (anon key, service role) y copia .env.example a .env.local
# en apps/web/ y apps/mobile/ con esos valores.

# 3. Aplica migraciones y seed
pnpm supabase:migrate
pnpm supabase:seed

# 4. Regenera tipos TS
pnpm db:types

# 5. Arranca apps
pnpm --filter @distribuapp/web dev          # http://localhost:3000
pnpm --filter @distribuapp/mobile start     # Expo dev server
```

## Usuarios demo (seed)

| Email                 | Password   | Rol      | App  |
|-----------------------|------------|----------|------|
| `admin@demo.test`     | `demo1234` | admin    | web  |
| `vendedor@demo.test`  | `demo1234` | vendedor | móvil |

Ambos pertenecen a la empresa `Distribuidora Demo` (slug `demo`).

## Arquitectura multi-tenant

Cada tabla de negocio incluye `company_id`. Las políticas RLS filtran por
`public.current_company_id()`, que lee el claim `app_metadata.company_id` del JWT
de Supabase. La función `set_user_company(user_id, company_id, role)` inyecta
ese claim y el `role` en `auth.users.raw_app_meta_data` durante el onboarding.

- **admin**: lectura + escritura completa sobre su tenant; único rol con acceso al dashboard web.
- **vendedor**: lectura del tenant; solo puede insertar movimientos tipo `salida` (ventas en campo).

Todas las mutaciones quedan registradas en `audit_logs` con `before`/`after` JSON.

## Autenticación móvil (PIN local)

1. Primer acceso: vendedor entra con email + password (Supabase Auth).
2. Configura PIN de 6 dígitos → se cifra el `refresh_token` con clave derivada del PIN y se guarda en `expo-secure-store` (Keychain/Keystore).
3. Reentradas: el splash detecta sesión cifrada y va directo a `pin-unlock`. Tras 5 intentos fallidos se borra la sesión local.
4. Soporta uso offline: mientras el `access_token` esté vigente o el `refresh_token` pueda renovarlo, las reads ya cacheadas siguen disponibles.

## Iteraciones futuras

- Ventas (efectivo/transferencia/crédito) y comprobantes
- Clientes con precios personalizados
- Créditos y cobranza
- Caja diaria y arqueos
- Despacho y rutas
- Reportes y exportaciones
