// Hand-authored to match supabase/migrations/*. Regenerate the canonical
// version once the project is linked:
//   supabase gen types typescript --linked > lib/supabase/database.types.ts
// Kept in sync with the SQL by hand until then.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "admin" | "manager" | "sale" | "cs" | "mkt";

export interface Database {
  public: {
    Tables: {
      // NOTE: `role` and `email` are read-only from the client (enforced by
      // column-level grants). Change a role only via the admin_set_role RPC.
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          sales_owner: string | null;
          role: AppRole | null;
          province_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          sales_owner?: string | null;
          role?: AppRole | null;
          province_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          sales_owner?: string | null;
          role?: AppRole | null;
          province_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: { name: string; created_at: string };
        Insert: { name: string; created_at?: string };
        Update: { name?: string; created_at?: string };
        Relationships: [];
      };
      owner_quotas: {
        Row: { owner: string; quota: number };
        Insert: { owner: string; quota?: number };
        Update: { owner?: string; quota?: number };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          province: string;
          province_code: string | null;
          sales_owner: string;
          contact_person: string;
          phone: string;
          email: string;
          line_id: string;
          color: string;
          interactions: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          province?: string;
          province_code?: string | null;
          sales_owner?: string;
          contact_person?: string;
          phone?: string;
          email?: string;
          line_id?: string;
          color?: string;
          interactions?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          province?: string;
          province_code?: string | null;
          sales_owner?: string;
          contact_person?: string;
          phone?: string;
          email?: string;
          line_id?: string;
          color?: string;
          interactions?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          customer_id: string | null;
          qt_no: string;
          inv_no: string;
          channel: string;
          item_type: string;
          detail: string;
          price: number | null;
          exec_status: string;
          result_status: string;
          report_status: string;
          renewal_status: string;
          target: string;
          actual: string;
          metrics: Json;
          metric_name: string;
          metric_unit: string;
          target_value: number | null;
          actual_value: number | null;
          report_sent_date: string | null;
          link: string;
          rating: number;
          deadline: string | null;
          publish_date: string | null;
          finished_date: string | null;
          notes: string;
          follow_up_date: string | null;
          follow_up_note: string;
          priority: string;
          progress: number;
          checklist: Json;
          activity: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          customer_id?: string | null;
          qt_no?: string;
          inv_no?: string;
          channel?: string;
          item_type?: string;
          detail?: string;
          price?: number | null;
          exec_status?: string;
          result_status?: string;
          report_status?: string;
          renewal_status?: string;
          target?: string;
          actual?: string;
          metrics?: Json;
          metric_name?: string;
          metric_unit?: string;
          target_value?: number | null;
          actual_value?: number | null;
          report_sent_date?: string | null;
          link?: string;
          rating?: number;
          deadline?: string | null;
          publish_date?: string | null;
          finished_date?: string | null;
          notes?: string;
          follow_up_date?: string | null;
          follow_up_note?: string;
          priority?: string;
          progress?: number;
          checklist?: Json;
          activity?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          qt_no?: string;
          inv_no?: string;
          channel?: string;
          item_type?: string;
          detail?: string;
          price?: number | null;
          exec_status?: string;
          result_status?: string;
          report_status?: string;
          renewal_status?: string;
          target?: string;
          actual?: string;
          metrics?: Json;
          metric_name?: string;
          metric_unit?: string;
          target_value?: number | null;
          actual_value?: number | null;
          report_sent_date?: string | null;
          link?: string;
          rating?: number;
          deadline?: string | null;
          publish_date?: string | null;
          finished_date?: string | null;
          notes?: string;
          follow_up_date?: string | null;
          follow_up_note?: string;
          priority?: string;
          progress?: number;
          checklist?: Json;
          activity?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      admin_set_role: {
        // new_role null revokes access (sets the user back to pending).
        Args: { target_user: string; new_role: AppRole | null };
        Returns: undefined;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      user_role: {
        // NULL for a pending user (role IS NULL) or an unknown uid.
        Args: { uid: string };
        Returns: AppRole | null;
      };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: Record<never, never>;
  };
}
