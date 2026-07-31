export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          id: string
          last_address: Json | null
          name: string
          notes: string | null
          phone: string
          tags: string[]
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_address?: Json | null
          name: string
          notes?: string | null
          phone: string
          tags?: string[]
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_address?: Json | null
          name?: string
          notes?: string | null
          phone?: string
          tags?: string[]
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          date: string
          id: string
          note: string | null
          source: string | null
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          note?: string | null
          source?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          note?: string | null
          source?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_history: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          from_value: string | null
          id: string
          meta: Json | null
          note: string | null
          order_id: string
          to_value: string | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          from_value?: string | null
          id?: string
          meta?: Json | null
          note?: string | null
          order_id: string
          to_value?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          from_value?: string | null
          id?: string
          meta?: Json | null
          note?: string | null
          order_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_pnl"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost: number
          created_at: string
          id: string
          name: string
          order_id: string
          price: number
          product_id: string | null
          qty: number
          variant: string | null
          variant_id: string | null
          weight_g: number
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          name: string
          order_id: string
          price?: number
          product_id?: string | null
          qty?: number
          variant?: string | null
          variant_id?: string | null
          weight_g?: number
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          qty?: number
          variant?: string | null
          variant_id?: string | null
          weight_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_pnl"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          campaign: string | null
          city: string | null
          courier: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          destination_city_id: string | null
          destination_label: string | null
          destination_subdistrict_id: string | null
          discount: number
          district: string | null
          dropship_name: string | null
          dropship_phone: string | null
          eta: string | null
          full_address: string
          id: string
          insurance: boolean
          is_dropship: boolean
          label_print_count: number
          label_printed_at: string | null
          marketplace_fee: number
          note: string | null
          order_number: string | null
          payment_status: string
          phone: string
          postal_code: string | null
          province: string | null
          recipient_name: string | null
          recipient_phone: string | null
          ref: string | null
          routing_code: string | null
          service: string | null
          shipping_cost: number
          source: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string
          warehouse_id: string | null
          weight_g: number
        }
        Insert: {
          campaign?: string | null
          city?: string | null
          courier?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          destination_city_id?: string | null
          destination_label?: string | null
          destination_subdistrict_id?: string | null
          discount?: number
          district?: string | null
          dropship_name?: string | null
          dropship_phone?: string | null
          eta?: string | null
          full_address: string
          id?: string
          insurance?: boolean
          is_dropship?: boolean
          label_print_count?: number
          label_printed_at?: string | null
          marketplace_fee?: number
          note?: string | null
          order_number?: string | null
          payment_status?: string
          phone: string
          postal_code?: string | null
          province?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          ref?: string | null
          routing_code?: string | null
          service?: string | null
          shipping_cost?: number
          source?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          warehouse_id?: string | null
          weight_g?: number
        }
        Update: {
          campaign?: string | null
          city?: string | null
          courier?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          destination_city_id?: string | null
          destination_label?: string | null
          destination_subdistrict_id?: string | null
          discount?: number
          district?: string | null
          dropship_name?: string | null
          dropship_phone?: string | null
          eta?: string | null
          full_address?: string
          id?: string
          insurance?: boolean
          is_dropship?: boolean
          label_print_count?: number
          label_printed_at?: string | null
          marketplace_fee?: number
          note?: string | null
          order_number?: string | null
          payment_status?: string
          phone?: string
          postal_code?: string | null
          province?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          ref?: string | null
          routing_code?: string | null
          service?: string | null
          shipping_cost?: number
          source?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          warehouse_id?: string | null
          weight_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          cost: number
          created_at: string
          dropship_price: number
          id: string
          image_url: string | null
          is_default: boolean
          label: string
          price: number
          product_id: string
          size: string | null
          sku: string | null
          sort_order: number
          stock: number
          updated_at: string
          weight_g: number
        }
        Insert: {
          color?: string | null
          cost?: number
          created_at?: string
          dropship_price?: number
          id?: string
          image_url?: string | null
          is_default?: boolean
          label?: string
          price?: number
          product_id: string
          size?: string | null
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
          weight_g?: number
        }
        Update: {
          color?: string | null
          cost?: number
          created_at?: string
          dropship_price?: number
          id?: string
          image_url?: string | null
          is_default?: boolean
          label?: string
          price?: number
          product_id?: string
          size?: string | null
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
          weight_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          name: string
          price: number
          product_type: string
          show_stock: boolean
          sku: string | null
          stock: number
          storefront_visible: boolean
          updated_at: string
          variant: string | null
          weight_g: number
          wholesale_enabled: boolean
          wholesale_tiers: Json
        }
        Insert: {
          category?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          name: string
          price?: number
          product_type?: string
          show_stock?: boolean
          sku?: string | null
          stock?: number
          storefront_visible?: boolean
          updated_at?: string
          variant?: string | null
          weight_g?: number
          wholesale_enabled?: boolean
          wholesale_tiers?: Json
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          name?: string
          price?: number
          product_type?: string
          show_stock?: boolean
          sku?: string | null
          stock?: number
          storefront_visible?: boolean
          updated_at?: string
          variant?: string | null
          weight_g?: number
          wholesale_enabled?: boolean
          wholesale_tiers?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          active_couriers: string[]
          custom_couriers: Json
          id: number
          lincah_api_key: string | null
          lincah_couriers: string[] | null
          lincah_env: string | null
          lincah_partner_id: string | null
          logo_url: string | null
          origin_city_id: string
          origin_label: string
          origin_subdistrict_id: string
          origin_type: string
          sender_address: string
          sender_city: string
          sender_name: string
          sender_phone: string
          updated_at: string
          weight_unit: string
        }
        Insert: {
          active_couriers?: string[]
          custom_couriers?: Json
          id?: number
          lincah_api_key?: string | null
          lincah_couriers?: string[] | null
          lincah_env?: string | null
          lincah_partner_id?: string | null
          logo_url?: string | null
          origin_city_id?: string
          origin_label?: string
          origin_subdistrict_id?: string
          origin_type?: string
          sender_address?: string
          sender_city?: string
          sender_name?: string
          sender_phone?: string
          updated_at?: string
          weight_unit?: string
        }
        Update: {
          active_couriers?: string[]
          custom_couriers?: Json
          id?: number
          lincah_api_key?: string | null
          lincah_couriers?: string[] | null
          lincah_env?: string | null
          lincah_partner_id?: string | null
          logo_url?: string | null
          origin_city_id?: string
          origin_label?: string
          origin_subdistrict_id?: string
          origin_type?: string
          sender_address?: string
          sender_city?: string
          sender_name?: string
          sender_phone?: string
          updated_at?: string
          weight_unit?: string
        }
        Relationships: []
      }
      shipping_rate_cache: {
        Row: {
          couriers: string
          created_at: string
          destination_subdistrict_id: string
          fetched_at: string
          id: string
          origin_subdistrict_id: string
          services: Json
          weight_bucket: number
        }
        Insert: {
          couriers: string
          created_at?: string
          destination_subdistrict_id: string
          fetched_at?: string
          id?: string
          origin_subdistrict_id: string
          services: Json
          weight_bucket: number
        }
        Update: {
          couriers?: string
          created_at?: string
          destination_subdistrict_id?: string
          fetched_at?: string
          id?: string
          origin_subdistrict_id?: string
          services?: Json
          weight_bucket?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          note: string | null
          order_id: string | null
          product_id: string | null
          reason: string
          stock_after: number | null
          stock_before: number | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          reason: string
          stock_after?: number | null
          stock_before?: number | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          reason?: string
          stock_after?: number | null
          stock_before?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_pnl"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          origin_label: string | null
          origin_subdistrict_id: string | null
          sender_name: string | null
          sender_phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          origin_label?: string | null
          origin_subdistrict_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          origin_label?: string | null
          origin_subdistrict_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      order_pnl: {
        Row: {
          campaign: string | null
          cogs: number | null
          created_at: string | null
          customer_id: string | null
          discount: number | null
          gross_profit: number | null
          marketplace_fee: number | null
          order_id: string | null
          order_number: string | null
          revenue: number | null
          shipping_cost: number | null
          source: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_variant_stock: {
        Args: {
          _delta: number
          _note: string
          _order_id: string
          _reason: string
          _variant_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
      expense_category:
        | "ads"
        | "operational"
        | "salary"
        | "rent"
        | "packaging"
        | "other"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      expense_category: [
        "ads",
        "operational",
        "salary",
        "rent",
        "packaging",
        "other",
      ],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
