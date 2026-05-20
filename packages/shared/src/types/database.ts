// Tipos generados por `pnpm db:types` (supabase gen types typescript --local).
// Este archivo se regenera; el placeholder permite typecheck antes del primer
// `supabase start`. NO editar a mano.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          nombre: string;
          slug: string;
          plan: 'free' | 'pro' | 'enterprise';
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['companies']['Row']> & {
          nombre: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['companies']['Row']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          company_id: string | null;
          full_name: string | null;
          email: string;
          role: 'admin' | 'vendedor';
          pin_hash: string | null;
          pin_set_at: string | null;
          activo: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      productos: {
        Row: {
          id: string;
          company_id: string;
          sku: string;
          nombre: string;
          categoria: string | null;
          unidad: string;
          precio_base: number;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['productos']['Row']> & {
          company_id: string;
          sku: string;
          nombre: string;
        };
        Update: Partial<Database['public']['Tables']['productos']['Row']>;
        Relationships: [];
      };
      inventario: {
        Row: {
          id: string;
          company_id: string;
          producto_id: string;
          stock: number;
          stock_minimo: number;
          ubicacion: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['inventario']['Row']> & {
          company_id: string;
          producto_id: string;
        };
        Update: Partial<Database['public']['Tables']['inventario']['Row']>;
        Relationships: [];
      };
      movimientos_inventario: {
        Row: {
          id: string;
          company_id: string;
          producto_id: string;
          tipo: 'entrada' | 'salida' | 'ajuste';
          cantidad: number;
          motivo: string | null;
          usuario_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['movimientos_inventario']['Row']> & {
          company_id: string;
          producto_id: string;
          tipo: 'entrada' | 'salida' | 'ajuste';
          cantidad: number;
        };
        Update: Partial<Database['public']['Tables']['movimientos_inventario']['Row']>;
        Relationships: [];
      };
      clientes: {
        Row: {
          id: string;
          company_id: string;
          nombre: string;
          telefono: string | null;
          email: string | null;
          direccion: string | null;
          ruc: string | null;
          limite_credito: number;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['clientes']['Row']> & {
          company_id: string;
          nombre: string;
        };
        Update: Partial<Database['public']['Tables']['clientes']['Row']>;
        Relationships: [];
      };
      precios_cliente: {
        Row: {
          id: string;
          company_id: string;
          cliente_id: string;
          producto_id: string;
          precio: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['precios_cliente']['Row']> & {
          company_id: string;
          cliente_id: string;
          producto_id: string;
          precio: number;
        };
        Update: Partial<Database['public']['Tables']['precios_cliente']['Row']>;
        Relationships: [];
      };
      ventas: {
        Row: {
          id: string;
          company_id: string;
          vendedor_id: string;
          cliente_id: string | null;
          fecha: string;
          subtotal: number;
          descuento: number;
          total: number;
          metodo_pago: 'efectivo' | 'transferencia' | 'credito';
          estado: 'borrador' | 'confirmada' | 'anulada';
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['ventas']['Row']> & {
          company_id: string;
          vendedor_id: string;
          metodo_pago: 'efectivo' | 'transferencia' | 'credito';
        };
        Update: Partial<Database['public']['Tables']['ventas']['Row']>;
        Relationships: [];
      };
      venta_items: {
        Row: {
          id: string;
          venta_id: string;
          company_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
        };
        Insert: Partial<Database['public']['Tables']['venta_items']['Row']> & {
          venta_id: string;
          company_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
        };
        Update: Partial<Database['public']['Tables']['venta_items']['Row']>;
        Relationships: [];
      };
      cajas: {
        Row: {
          id: string;
          company_id: string;
          vendedor_id: string;
          fecha: string;
          monto_apertura: number;
          monto_cierre: number | null;
          estado: 'abierta' | 'cerrada';
          notas_cierre: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['cajas']['Row']> & {
          company_id: string;
          vendedor_id: string;
        };
        Update: Partial<Database['public']['Tables']['cajas']['Row']>;
        Relationships: [];
      };
      creditos: {
        Row: {
          id: string;
          company_id: string;
          cliente_id: string;
          venta_id: string;
          monto_original: number;
          saldo_pendiente: number;
          fecha_emision: string;
          fecha_vencimiento: string | null;
          estado: 'vigente' | 'pagado' | 'vencido';
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['creditos']['Row']> & {
          company_id: string;
          cliente_id: string;
          venta_id: string;
          monto_original: number;
          saldo_pendiente: number;
        };
        Update: Partial<Database['public']['Tables']['creditos']['Row']>;
        Relationships: [];
      };
      pagos_credito: {
        Row: {
          id: string;
          credito_id: string;
          company_id: string;
          monto: number;
          fecha: string;
          metodo_pago: 'efectivo' | 'transferencia' | 'credito';
          notas: string | null;
          usuario_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['pagos_credito']['Row']> & {
          credito_id: string;
          company_id: string;
          monto: number;
        };
        Update: Partial<Database['public']['Tables']['pagos_credito']['Row']>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          company_id: string | null;
          user_id: string | null;
          action: 'INSERT' | 'UPDATE' | 'DELETE';
          entity_type: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>;
        Relationships: [];
      };
    };
    Views: {
      caja_resumen: {
        Row: {
          caja_id: string;
          company_id: string;
          vendedor_id: string;
          fecha: string;
          monto_apertura: number;
          monto_cierre: number | null;
          estado: 'abierta' | 'cerrada';
          notas_cierre: string | null;
          total_efectivo: number;
          total_transferencia: number;
          total_credito: number;
          total_ventas: number;
          num_ventas: number;
        };
      };
    };
    Functions: {
      current_company_id: { Args: Record<string, never>; Returns: string | null };
      current_user_role: { Args: Record<string, never>; Returns: string | null };
      set_user_company: {
        Args: { target_user_id: string; target_company_id: string; target_role: 'admin' | 'vendedor' };
        Returns: void;
      };
      precio_efectivo: {
        Args: { p_cliente_id: string; p_producto_id: string };
        Returns: number;
      };
      confirmar_venta: { Args: { p_venta_id: string }; Returns: void };
      anular_venta: { Args: { p_venta_id: string }; Returns: void };
      abrir_caja: { Args: { p_monto_apertura?: number }; Returns: string };
      cerrar_caja: { Args: { p_monto_cierre: number; p_notas?: string }; Returns: void };
      marcar_creditos_vencidos: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      user_role: 'admin' | 'vendedor';
      movimiento_tipo: 'entrada' | 'salida' | 'ajuste';
      metodo_pago: 'efectivo' | 'transferencia' | 'credito';
      venta_estado: 'borrador' | 'confirmada' | 'anulada';
      caja_estado: 'abierta' | 'cerrada';
      credito_estado: 'vigente' | 'pagado' | 'vencido';
    };
    CompositeTypes: Record<string, never>;
  };
}
