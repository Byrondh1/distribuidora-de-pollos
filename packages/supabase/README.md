# @distribuapp/supabase

Migraciones, seed y configuración local de Supabase.

## Setup

```bash
# Requiere Supabase CLI: https://supabase.com/docs/guides/cli
pnpm supabase:start         # arranca Postgres + Auth + Realtime locales
pnpm supabase:migrate       # aplica migrations/*.sql
pnpm supabase:seed          # carga seed.sql (empresa + usuarios + productos demo)
pnpm db:types               # regenera packages/shared/src/types/database.ts
```

## Migraciones

| Archivo | Contenido |
|---|---|
| `0001_init_tenancy.sql` | `companies` + helpers `current_company_id()`, `current_user_role()` |
| `0002_auth_profiles.sql` | `profiles` ligado a `auth.users` + `set_user_company()` |
| `0003_inventario.sql` | `productos`, `inventario`, `movimientos_inventario` + Realtime |
| `0004_audit_logs.sql` | `audit_logs` + trigger genérico aplicado a tablas sensibles |
| `0005_rls_policies.sql` | RLS por tenant y por rol (admin/vendedor) |

## Usuarios demo (seed)

| Email | Password | Rol |
|---|---|---|
| `admin@demo.test`    | `demo1234` | admin    |
| `vendedor@demo.test` | `demo1234` | vendedor |

Ambos en la empresa `Distribuidora Demo` (slug `demo`).
