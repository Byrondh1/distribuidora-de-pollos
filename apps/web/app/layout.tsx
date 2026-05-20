import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DistribuApp',
  description: 'Gestión multi-tenant para distribuidoras',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
