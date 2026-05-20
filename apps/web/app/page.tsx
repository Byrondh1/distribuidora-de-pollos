import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">DistribuApp</h1>
      <p className="max-w-md text-muted-foreground">
        Plataforma multi-tenant para gestión de distribuidoras: inventario, ventas, créditos,
        caja y despacho.
      </p>
      <Button asChild>
        <Link href="/login">Entrar al dashboard</Link>
      </Button>
    </main>
  );
}
