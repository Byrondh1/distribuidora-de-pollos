import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function ReportesPage() {
  const supabase = await createClient();
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);

  const [
    { data: ventasDiarias },
    { data: productosTop },
    { data: clientesTop },
    { data: inventarioCritico },
    { data: cobranzaResumen },
  ] = await Promise.all([
    supabase
      .from('reporte_ventas_diarias')
      .select('*')
      .gte('fecha', hace30)
      .order('fecha', { ascending: false }),
    supabase.from('reporte_productos_top').select('*').limit(10),
    supabase.from('reporte_clientes_top').select('*').limit(10),
    supabase.from('reporte_inventario_critico').select('*').limit(50),
    supabase.from('reporte_cobranza_resumen').select('*'),
  ]);

  // Agrupar ventas diarias por fecha (suma de todos los métodos de pago).
  const porFecha = new Map<string, number>();
  for (const r of ventasDiarias ?? []) {
    porFecha.set(r.fecha, (porFecha.get(r.fecha) ?? 0) + Number(r.total));
  }
  const fechasOrdenadas = [...porFecha.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const maxVenta = Math.max(...fechasOrdenadas.map(([, v]) => v), 1);

  // Totales 30 días.
  const total30 = [...porFecha.values()].reduce((s, v) => s + v, 0);
  const numVentas30 = (ventasDiarias ?? []).reduce((s, r) => s + Number(r.num_ventas), 0);
  const cobranzaSaldo = (cobranzaResumen ?? [])
    .filter((r) => r.estado !== 'pagado')
    .reduce((s, r) => s + Number(r.saldo_total), 0);
  const stockCritico = (inventarioCritico ?? []).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Reportes</h1>
        <p className="text-sm text-muted-foreground">Últimos 30 días · hasta {hoy}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard titulo="Ventas 30 días" valor={formatCurrency(total30)} sub={`${numVentas30} transacciones`} />
        <KpiCard titulo="Ticket promedio" valor={formatCurrency(numVentas30 ? total30 / numVentas30 : 0)} sub="por venta confirmada" />
        <KpiCard titulo="Cartera pendiente" valor={formatCurrency(cobranzaSaldo)} sub="créditos activos" color="text-yellow-600" />
        <KpiCard titulo="Stock crítico" valor={String(stockCritico)} sub="productos bajo mínimo" color={stockCritico > 0 ? 'text-destructive' : 'text-green-600'} />
      </div>

      {/* Gráfico de barras (CSS) */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas por día (últimos 30 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1 overflow-x-auto pb-2">
            {fechasOrdenadas.slice(0, 30).reverse().map(([fecha, total]) => {
              const pct = (total / maxVenta) * 100;
              return (
                <div key={fecha} className="group relative flex flex-1 min-w-[12px] flex-col items-center">
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary"
                    style={{ height: `${pct}%` }}
                  />
                  <span className="absolute -top-5 hidden rounded bg-background px-1 text-xs shadow group-hover:block">
                    {formatCurrency(total)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{fechasOrdenadas.at(-1)?.[0] ?? ''}</span>
            <span>{fechasOrdenadas[0]?.[0] ?? ''}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 productos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">Producto</th>
                  <th className="px-4 py-2 text-right font-medium">Cant.</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {(productosTop ?? []).map((p, i) => (
                  <tr key={p.producto_id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2">
                      <div>{p.nombre}</div>
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {Number(p.cantidad_total).toFixed(1)} {p.unidad}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(Number(p.monto_total))}
                    </td>
                  </tr>
                ))}
                {!productosTop?.length && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Top clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 clientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">Cliente</th>
                  <th className="px-4 py-2 text-right font-medium">Ventas</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {(clientesTop ?? []).map((c, i) => (
                  <tr key={c.cliente_id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2">
                      <div>{c.nombre}</div>
                      <div className="text-xs text-muted-foreground">{c.ultima_compra}</div>
                    </td>
                    <td className="px-4 py-2 text-right">{c.num_ventas}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(Number(c.monto_total))}
                    </td>
                  </tr>
                ))}
                {!clientesTop?.length && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Inventario crítico */}
        <Card>
          <CardHeader>
            <CardTitle>
              Inventario crítico{' '}
              {stockCritico > 0 && (
                <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-white">
                  {stockCritico}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {inventarioCritico?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Producto</th>
                    <th className="px-4 py-2 text-right font-medium">Stock</th>
                    <th className="px-4 py-2 text-right font-medium">Mínimo</th>
                    <th className="px-4 py-2 text-right font-medium">Déficit</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioCritico.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2">
                        <div>{p.nombre}</div>
                        <div className="text-xs text-muted-foreground">{p.sku}</div>
                      </td>
                      <td className="px-4 py-2 text-right text-destructive font-medium">
                        {Number(p.stock).toFixed(2)} {p.unidad}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {Number(p.stock_minimo).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-destructive">
                        -{Number(p.deficit).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Todos los productos tienen stock suficiente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cobranza resumen */}
        <Card>
          <CardHeader>
            <CardTitle>Cartera de créditos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Créditos</th>
                  <th className="px-4 py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(cobranzaResumen ?? []).map((r) => (
                  <tr key={r.estado} className="border-t">
                    <td className="px-4 py-2 capitalize">{r.estado}</td>
                    <td className="px-4 py-2 text-right">{r.num_creditos}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(Number(r.saldo_total))}
                    </td>
                  </tr>
                ))}
                {!cobranzaResumen?.length && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Sin créditos</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  sub,
  color = 'text-foreground',
}: {
  titulo: string;
  valor: string;
  sub: string;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{valor}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
