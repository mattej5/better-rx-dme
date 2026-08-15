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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      demo_state: {
        Row: {
          clock_offset_seconds: number
          id: number
          seeded_at: string | null
        }
        Insert: {
          clock_offset_seconds?: number
          id?: number
          seeded_at?: string | null
        }
        Update: {
          clock_offset_seconds?: number
          id?: number
          seeded_at?: string | null
        }
        Relationships: []
      }
      equipment_catalog: {
        Row: {
          category: string
          hazmat: boolean
          hcpcs: string
          image_url: string | null
          plain_name: string
          resupply_interval_days: number | null
          serialized: boolean
          time_critical: boolean
          two_person: boolean
        }
        Insert: {
          category: string
          hazmat?: boolean
          hcpcs: string
          image_url?: string | null
          plain_name: string
          resupply_interval_days?: number | null
          serialized?: boolean
          time_critical?: boolean
          two_person?: boolean
        }
        Update: {
          category?: string
          hazmat?: boolean
          hcpcs?: string
          image_url?: string | null
          plain_name?: string
          resupply_interval_days?: number | null
          serialized?: boolean
          time_critical?: boolean
          two_person?: boolean
        }
        Relationships: []
      }
      magic_links: {
        Row: {
          created_at: string
          expires_at: string | null
          last_used_at: string | null
          order_id: string | null
          scope: string
          token: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          last_used_at?: string | null
          order_id?: string | null
          scope: string
          token: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          last_used_at?: string | null
          order_id?: string | null
          scope?: string
          token?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          direction: string
          id: string
          order_id: string
          parsed: Json | null
          to_addr: string | null
          vendor_id: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          direction: string
          id?: string
          order_id: string
          parsed?: Json | null
          to_addr?: string | null
          vendor_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          id?: string
          order_id?: string
          parsed?: Json | null
          to_addr?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor: string | null
          actor_role: string | null
          created_at: string
          external_id: string | null
          id: number
          order_id: string
          payload: Json
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          actor?: string | null
          actor_role?: string | null
          created_at?: string
          external_id?: string | null
          id?: never
          order_id: string
          payload?: Json
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          actor?: string | null
          actor_role?: string | null
          created_at?: string
          external_id?: string | null
          id?: never
          order_id?: string
          payload?: Json
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          current_eta: string | null
          delivered_at: string | null
          hospice_account: string
          id: string
          items: Json
          order_no: string
          ordered_at: string
          ordered_by: string | null
          ordered_by_role: string | null
          patient_id: string
          picked_up_at: string | null
          pickup_requested_at: string | null
          pickup_scheduled_at: string | null
          price_cents: number | null
          promised_eta: string | null
          status: Database["public"]["Enums"]["order_status"]
          target_at: string | null
          urgency: Database["public"]["Enums"]["order_urgency"]
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          current_eta?: string | null
          delivered_at?: string | null
          hospice_account?: string
          id?: string
          items: Json
          order_no: string
          ordered_at?: string
          ordered_by?: string | null
          ordered_by_role?: string | null
          patient_id: string
          picked_up_at?: string | null
          pickup_requested_at?: string | null
          pickup_scheduled_at?: string | null
          price_cents?: number | null
          promised_eta?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          target_at?: string | null
          urgency: Database["public"]["Enums"]["order_urgency"]
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          current_eta?: string | null
          delivered_at?: string | null
          hospice_account?: string
          id?: string
          items?: Json
          order_no?: string
          ordered_at?: string
          ordered_by?: string | null
          ordered_by_role?: string | null
          patient_id?: string
          picked_up_at?: string | null
          pickup_requested_at?: string | null
          pickup_scheduled_at?: string | null
          price_cents?: number | null
          promised_eta?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          target_at?: string | null
          urgency?: Database["public"]["Enums"]["order_urgency"]
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: Json
          admitted_at: string | null
          care_status: string
          created_at: string
          discharge_at: string | null
          dob: string | null
          emr_source: string
          external_id: string
          first_name: string
          gender: string | null
          hospice_name: string
          id: string
          last_name: string
          med_rec_no: string | null
          phone: string | null
          primary_dx: string | null
          status_changed_at: string | null
        }
        Insert: {
          address?: Json
          admitted_at?: string | null
          care_status?: string
          created_at?: string
          discharge_at?: string | null
          dob?: string | null
          emr_source?: string
          external_id: string
          first_name: string
          gender?: string | null
          hospice_name: string
          id?: string
          last_name: string
          med_rec_no?: string | null
          phone?: string | null
          primary_dx?: string | null
          status_changed_at?: string | null
        }
        Update: {
          address?: Json
          admitted_at?: string | null
          care_status?: string
          created_at?: string
          discharge_at?: string | null
          dob?: string | null
          emr_source?: string
          external_id?: string
          first_name?: string
          gender?: string | null
          hospice_name?: string
          id?: string
          last_name?: string
          med_rec_no?: string | null
          phone?: string | null
          primary_dx?: string | null
          status_changed_at?: string | null
        }
        Relationships: []
      }
      resupply_schedules: {
        Row: {
          active: boolean
          hcpcs: string
          id: string
          interval_days: number
          is_swap: boolean
          last_delivered_at: string | null
          next_due_at: string
          patient_id: string
        }
        Insert: {
          active?: boolean
          hcpcs: string
          id?: string
          interval_days: number
          is_swap?: boolean
          last_delivered_at?: string | null
          next_due_at: string
          patient_id: string
        }
        Update: {
          active?: boolean
          hcpcs?: string
          id?: string
          interval_days?: number
          is_swap?: boolean
          last_delivered_at?: string | null
          next_due_at?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resupply_schedules_hcpcs_fkey"
            columns: ["hcpcs"]
            isOneToOne: false
            referencedRelation: "equipment_catalog"
            referencedColumns: ["hcpcs"]
          },
          {
            foreignKeyName: "resupply_schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      vendor_prices: {
        Row: {
          hcpcs: string
          in_stock: boolean
          lead_time_hours: number
          price_cents: number
          vendor_id: string
        }
        Insert: {
          hcpcs: string
          in_stock?: boolean
          lead_time_hours?: number
          price_cents: number
          vendor_id: string
        }
        Update: {
          hcpcs?: string
          in_stock?: boolean
          lead_time_hours?: number
          price_cents?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_prices_hcpcs_fkey"
            columns: ["hcpcs"]
            isOneToOne: false
            referencedRelation: "equipment_catalog"
            referencedColumns: ["hcpcs"]
          },
          {
            foreignKeyName: "vendor_prices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          categories: string[]
          coverage_zips: string[]
          created_at: string
          dispatch_email: string | null
          dispatch_phone: string | null
          hazmat_certified: boolean
          hours: Json
          id: string
          inventory: Json
          name: string
          notes: string | null
          open_weekends: boolean
          pricing_model: string
          service_center_zip: string | null
          service_radius_miles: number | null
          status: string
        }
        Insert: {
          categories?: string[]
          coverage_zips?: string[]
          created_at?: string
          dispatch_email?: string | null
          dispatch_phone?: string | null
          hazmat_certified?: boolean
          hours?: Json
          id?: string
          inventory?: Json
          name: string
          notes?: string | null
          open_weekends?: boolean
          pricing_model?: string
          service_center_zip?: string | null
          service_radius_miles?: number | null
          status?: string
        }
        Update: {
          categories?: string[]
          coverage_zips?: string[]
          created_at?: string
          dispatch_email?: string | null
          dispatch_phone?: string | null
          hazmat_certified?: boolean
          hours?: Json
          id?: string
          inventory?: Json
          name?: string
          notes?: string | null
          open_weekends?: boolean
          pricing_model?: string
          service_center_zip?: string | null
          service_radius_miles?: number | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_type:
        | "order_placed"
        | "approval_requested"
        | "approved"
        | "denied"
        | "vendor_notified"
        | "vendor_confirmed"
        | "vendor_declined"
        | "dispatched"
        | "gps_opted_in"
        | "eta_updated"
        | "at_risk_flagged"
        | "at_risk_cleared"
        | "escalated"
        | "reordered"
        | "delivered"
        | "condition_reported"
        | "patient_status_changed"
        | "pickup_requested"
        | "pickup_scheduled"
        | "picked_up"
        | "message_sent"
        | "message_received"
        | "resupply_due"
      order_status:
        | "ordered"
        | "dispatched"
        | "in_transit"
        | "delivered"
        | "pickup_triggered"
        | "picked_up"
      order_urgency: "admission" | "routine" | "stat"
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
      event_type: [
        "order_placed",
        "approval_requested",
        "approved",
        "denied",
        "vendor_notified",
        "vendor_confirmed",
        "vendor_declined",
        "dispatched",
        "gps_opted_in",
        "eta_updated",
        "at_risk_flagged",
        "at_risk_cleared",
        "escalated",
        "reordered",
        "delivered",
        "condition_reported",
        "patient_status_changed",
        "pickup_requested",
        "pickup_scheduled",
        "picked_up",
        "message_sent",
        "message_received",
        "resupply_due",
      ],
      order_status: [
        "ordered",
        "dispatched",
        "in_transit",
        "delivered",
        "pickup_triggered",
        "picked_up",
      ],
      order_urgency: ["admission", "routine", "stat"],
    },
  },
} as const
