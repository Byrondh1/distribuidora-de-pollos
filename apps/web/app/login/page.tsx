'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@distribuapp/shared/schemas';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const { data, error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setServerError(error.message);
      return;
    }
    // Solo rutas internas: "//evil.com" es protocolo-relativo y saldría del sitio.
    const rawNext = params.get('next');
    const next =
      rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
    const role = (data.user?.app_metadata?.role as string | undefined) ?? null;
    const fallback = role === 'vendedor' ? '/dashboard/ventas/nueva' : '/dashboard/inventario';
    router.push((next ?? fallback) as `/${string}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      {serverError && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Administradores y vendedores · acceso al sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando…</div>}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
