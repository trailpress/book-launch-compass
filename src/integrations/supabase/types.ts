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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      competitor_books: {
        Row: {
          analysis_id: string
          asin: string
          author: string | null
          cover_url: string | null
          created_at: string
          current_bsr: number | null
          current_price: number | null
          current_rating: number | null
          current_reviews: number | null
          format: string | null
          id: string
          pages: number | null
          publish_date: string | null
          title: string
        }
        Insert: {
          analysis_id: string
          asin: string
          author?: string | null
          cover_url?: string | null
          created_at?: string
          current_bsr?: number | null
          current_price?: number | null
          current_rating?: number | null
          current_reviews?: number | null
          format?: string | null
          id?: string
          pages?: number | null
          publish_date?: string | null
          title: string
        }
        Update: {
          analysis_id?: string
          asin?: string
          author?: string | null
          cover_url?: string | null
          created_at?: string
          current_bsr?: number | null
          current_price?: number | null
          current_rating?: number | null
          current_reviews?: number | null
          format?: string | null
          id?: string
          pages?: number | null
          publish_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_books_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "niche_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_history: {
        Row: {
          book_id: string
          bsr: number | null
          estimated_sales: number | null
          id: string
          price: number | null
          recorded_at: string
          reviews: number | null
        }
        Insert: {
          book_id: string
          bsr?: number | null
          estimated_sales?: number | null
          id?: string
          price?: number | null
          recorded_at?: string
          reviews?: number | null
        }
        Update: {
          book_id?: string
          bsr?: number | null
          estimated_sales?: number | null
          id?: string
          price?: number | null
          recorded_at?: string
          reviews?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "competitor_books"
            referencedColumns: ["id"]
          },
        ]
      }
      niche_analyses: {
        Row: {
          clustered_pain_points: Json | null
          competition_score: number
          created_at: string
          demand_score: number
          id: string
          niche_keyword: string
          opportunities: Json | null
          overall_score: number
          pain_points: Json | null
          patterns: Json | null
          profit_potential_score: number
          review_patterns: Json | null
          search_volume: number | null
          search_volume_score: number | null
          search_volume_source: string | null
          social_excerpts: Json | null
          sources: Json | null
          strategy: Json | null
          suggested_titles: Json | null
          trend_data: number[] | null
          trend_direction: string
          trend_labels: string[] | null
          trend_seasonality: string
          trend_viability: string
          updated_at: string
          verdict_description: string
          verdict_title: string
          verdict_type: string
        }
        Insert: {
          clustered_pain_points?: Json | null
          competition_score: number
          created_at?: string
          demand_score: number
          id?: string
          niche_keyword: string
          opportunities?: Json | null
          overall_score: number
          pain_points?: Json | null
          patterns?: Json | null
          profit_potential_score: number
          review_patterns?: Json | null
          search_volume?: number | null
          search_volume_score?: number | null
          search_volume_source?: string | null
          social_excerpts?: Json | null
          sources?: Json | null
          strategy?: Json | null
          suggested_titles?: Json | null
          trend_data?: number[] | null
          trend_direction: string
          trend_labels?: string[] | null
          trend_seasonality: string
          trend_viability: string
          updated_at?: string
          verdict_description: string
          verdict_title: string
          verdict_type: string
        }
        Update: {
          clustered_pain_points?: Json | null
          competition_score?: number
          created_at?: string
          demand_score?: number
          id?: string
          niche_keyword?: string
          opportunities?: Json | null
          overall_score?: number
          pain_points?: Json | null
          patterns?: Json | null
          profit_potential_score?: number
          review_patterns?: Json | null
          search_volume?: number | null
          search_volume_score?: number | null
          search_volume_source?: string | null
          social_excerpts?: Json | null
          sources?: Json | null
          strategy?: Json | null
          suggested_titles?: Json | null
          trend_data?: number[] | null
          trend_direction?: string
          trend_labels?: string[] | null
          trend_seasonality?: string
          trend_viability?: string
          updated_at?: string
          verdict_description?: string
          verdict_title?: string
          verdict_type?: string
        }
        Relationships: []
      }
      niche_comparisons: {
        Row: {
          analysis_ids: string[]
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          analysis_ids: string[]
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          analysis_ids?: string[]
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          client_ip: string
          created_at: string
          id: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          client_ip: string
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          client_ip?: string
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
