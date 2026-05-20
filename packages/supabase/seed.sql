-- seed.sql — datos de prueba para desarrollo local.
-- Crea: 1 empresa demo, 1 admin, 1 vendedor, 5 productos con stock,
--        3 clientes con precios personalizados, y 1 venta demo.
--
-- Los usuarios se crean directamente en auth.users con password 'demo1234'.
-- En producción usar Supabase Auth API (signUp + invitación).

-- =====================================================================
-- Empresa demo
-- =====================================================================
insert into public.companies (id, nombre, slug, plan)
values ('00000000-0000-0000-0000-000000000001', 'Distribuidora Demo', 'demo', 'pro')
on conflict (id) do nothing;

-- =====================================================================
-- Usuarios demo
-- =====================================================================
-- admin@demo.test / demo1234
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin@demo.test',
  crypt('demo1234', gen_salt('bf')),
  now(),
  jsonb_build_object(
    'provider','email',
    'providers', jsonb_build_array('email'),
    'company_id','00000000-0000-0000-0000-000000000001',
    'role','admin'
  ),
  jsonb_build_object('full_name','Admin Demo'),
  now(), now()
)
on conflict (id) do nothing;

-- vendedor@demo.test / demo1234
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'vendedor@demo.test',
  crypt('demo1234', gen_salt('bf')),
  now(),
  jsonb_build_object(
    'provider','email',
    'providers', jsonb_build_array('email'),
    'company_id','00000000-0000-0000-0000-000000000001',
    'role','vendedor'
  ),
  jsonb_build_object('full_name','Vendedor Demo'),
  now(), now()
)
on conflict (id) do nothing;

-- Asignar company + role a los profiles creados por el trigger.
update public.profiles
   set company_id = '00000000-0000-0000-0000-000000000001',
       role = 'admin',
       full_name = 'Admin Demo'
 where id = '11111111-1111-1111-1111-111111111111';

update public.profiles
   set company_id = '00000000-0000-0000-0000-000000000001',
       role = 'vendedor',
       full_name = 'Vendedor Demo'
 where id = '22222222-2222-2222-2222-222222222222';

-- =====================================================================
-- Productos demo
-- =====================================================================
insert into public.productos (id, company_id, sku, nombre, categoria, unidad, precio_base)
values
  ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','POL-ENT','Pollo entero',     'Aves','kg', 4.50),
  ('aaaaaaaa-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','POL-PEC','Pechuga de pollo', 'Aves','kg', 6.80),
  ('aaaaaaaa-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','POL-MUS','Muslo de pollo',   'Aves','kg', 5.20),
  ('aaaaaaaa-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','POL-ALA','Alas de pollo',    'Aves','kg', 4.90),
  ('aaaaaaaa-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','POL-MEN','Menudencias',      'Aves','kg', 2.30)
on conflict (company_id, sku) do nothing;

-- Stock inicial vía movimientos de entrada.
insert into public.movimientos_inventario (company_id, producto_id, tipo, cantidad, motivo, usuario_id)
select
  p.company_id, p.id, 'entrada', 100, 'Stock inicial seed',
  '11111111-1111-1111-1111-111111111111'
from public.productos p
where p.company_id = '00000000-0000-0000-0000-000000000001'
on conflict do nothing;

-- =====================================================================
-- Clientes demo
-- =====================================================================
insert into public.clientes (id, company_id, nombre, telefono, ruc, limite_credito)
values
  ('bbbbbbbb-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
   'Restaurante El Gallo', '555-1001', '20100123456', 500.00),
  ('bbbbbbbb-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
   'Pollería La Brasa',    '555-1002', '20100654321', 1000.00),
  ('bbbbbbbb-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
   'Mercado Central',      '555-1003', null,          0.00)
on conflict (id) do nothing;

-- Precios personalizados (Restaurante El Gallo tiene precios preferenciales).
insert into public.precios_cliente (company_id, cliente_id, producto_id, precio)
values
  ('00000000-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', 4.10),  -- pollo entero más barato
  ('00000000-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002', 6.20),  -- pechuga
  ('00000000-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 4.20)   -- Pollería La Brasa
on conflict (cliente_id, producto_id) do nothing;
