export type AppRole = "owner" | "office" | "dispatcher" | "accountant" | "technician";

export type LeadStage =
  | "new"
  | "qualified"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "won"
  | "lost"
  | "cancelled";

export type JobStatus = "queued" | "assigned" | "en_route" | "on_site" | "done" | "cancelled";

export type InvoiceStatus = "draft" | "sent" | "paid" | "void" | "overdue";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: AppRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: AppRole;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      customers: {
        Row: {
          id: string;
          name: string | null;
          phone: string | null;
          email: string | null;
          zip: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          zip?: string | null;
          address?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          customer_id: string | null;
          name: string | null;
          phone: string | null;
          zip: string | null;
          message: string | null;
          source: string;
          lead_type: string | null;
          stage: LeadStage;
          assigned_to: string | null;
          deal_title: string | null;
          deal_price: string | null;
          scheduled_at: string | null;
          problem: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id?: string | null;
          name?: string | null;
          phone?: string | null;
          zip?: string | null;
          message?: string | null;
          source?: string;
          lead_type?: string | null;
          stage?: LeadStage;
          assigned_to?: string | null;
          deal_title?: string | null;
          deal_price?: string | null;
          scheduled_at?: string | null;
          problem?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      inbox_items: {
        Row: {
          id: string;
          lead_id: string | null;
          item_type: string;
          title: string;
          body: string | null;
          status: "new" | "reviewed" | "done" | "ignored";
          source: string | null;
          payload: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lead_id?: string | null;
          item_type?: string;
          title: string;
          body?: string | null;
          status?: "new" | "reviewed" | "done" | "ignored";
          source?: string | null;
          payload?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["inbox_items"]["Insert"]>;
      };
      reviews: {
        Row: {
          id: string;
          source: "google" | "thumbtack";
          external_id: string;
          author_name: string | null;
          rating: number | null;
          text: string | null;
          posted_at: string | null;
          owner_reply: string | null;
          raw: Record<string, unknown>;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          source: "google" | "thumbtack";
          external_id: string;
          author_name?: string | null;
          rating?: number | null;
          text?: string | null;
          posted_at?: string | null;
          owner_reply?: string | null;
          raw?: Record<string, unknown>;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
      review_snapshots: {
        Row: {
          id: string;
          source: "google" | "thumbtack";
          rating: number | null;
          review_count: number;
          raw: Record<string, unknown>;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          source: "google" | "thumbtack";
          rating?: number | null;
          review_count?: number;
          raw?: Record<string, unknown>;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_snapshots"]["Insert"]>;
      };
      seo_snapshots: {
        Row: {
          id: string;
          period_start: string;
          period_end: string;
          source: string;
          search_console: Record<string, unknown> | null;
          ga4: Record<string, unknown> | null;
          synced_at: string;
          created_at: string;
        };
        Insert: {
          period_start: string;
          period_end: string;
          source?: string;
          search_console?: Record<string, unknown> | null;
          ga4?: Record<string, unknown> | null;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["seo_snapshots"]["Insert"]>;
      };
      chat_sessions: {
        Row: {
          id: string;
          session_key: string;
          messages: unknown;
          collected: Record<string, unknown>;
          lead_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          session_key: string;
          messages?: unknown;
          collected?: Record<string, unknown>;
          lead_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["chat_sessions"]["Insert"]>;
      };
      jobs: {
        Row: {
          id: string;
          lead_id: string | null;
          customer_id: string | null;
          technician_id: string | null;
          title: string;
          status: JobStatus;
          scheduled_start: string | null;
          scheduled_end: string | null;
          address: string | null;
          zip: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lead_id?: string | null;
          customer_id?: string | null;
          technician_id?: string | null;
          title: string;
          status?: JobStatus;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          address?: string | null;
          zip?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
      };
      invoices: {
        Row: {
          id: string;
          customer_id: string | null;
          lead_id: string | null;
          job_id: string | null;
          amount_cents: number;
          status: InvoiceStatus;
          description: string | null;
          due_at: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id?: string | null;
          lead_id?: string | null;
          job_id?: string | null;
          amount_cents?: number;
          status?: InvoiceStatus;
          description?: string | null;
          due_at?: string | null;
          paid_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
      };
    };
  };
};
