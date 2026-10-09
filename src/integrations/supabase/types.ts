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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          closest_topic: string | null
          content: string
          created_at: string
          grounded: boolean
          id: string
          items_added: Json
          match_level: string | null
          match_reason: string | null
          move_id: string
          role: string
          source_label: string | null
          source_last_verified: string | null
          source_links: string[] | null
        }
        Insert: {
          closest_topic?: string | null
          content: string
          created_at?: string
          grounded?: boolean
          id?: string
          items_added?: Json
          match_level?: string | null
          match_reason?: string | null
          move_id: string
          role: string
          source_label?: string | null
          source_last_verified?: string | null
          source_links?: string[] | null
        }
        Update: {
          closest_topic?: string | null
          content?: string
          created_at?: string
          grounded?: boolean
          id?: string
          items_added?: Json
          match_level?: string | null
          match_reason?: string | null
          move_id?: string
          role?: string
          source_label?: string | null
          source_last_verified?: string | null
          source_links?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          added_because: string | null
          added_by_message_id: string | null
          category: string | null
          change_reason: string | null
          created_at: string
          description: string | null
          grounded: boolean
          id: string
          move_id: string
          source_label: string
          status: string
          timing_window: string | null
          title: string
          urgency: string
          version: number
        }
        Insert: {
          added_because?: string | null
          added_by_message_id?: string | null
          category?: string | null
          change_reason?: string | null
          created_at?: string
          description?: string | null
          grounded?: boolean
          id?: string
          move_id: string
          source_label?: string
          status?: string
          timing_window?: string | null
          title: string
          urgency?: string
          version?: number
        }
        Update: {
          added_because?: string | null
          added_by_message_id?: string | null
          category?: string | null
          change_reason?: string | null
          created_at?: string
          description?: string | null
          grounded?: boolean
          id?: string
          move_id?: string
          source_label?: string
          status?: string
          timing_window?: string | null
          title?: string
          urgency?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      corridor_knowledge: {
        Row: {
          content_blob: string | null
          created_at: string
          default_visa_type: string | null
          destination_country: string
          id: string
          last_verified: string | null
          move_type: string
          origin_country: string
          source_links: string[] | null
        }
        Insert: {
          content_blob?: string | null
          created_at?: string
          default_visa_type?: string | null
          destination_country: string
          id?: string
          last_verified?: string | null
          move_type: string
          origin_country: string
          source_links?: string[] | null
        }
        Update: {
          content_blob?: string | null
          created_at?: string
          default_visa_type?: string | null
          destination_country?: string
          id?: string
          last_verified?: string | null
          move_type?: string
          origin_country?: string
          source_links?: string[] | null
        }
        Relationships: []
      }
      modifier_knowledge: {
        Row: {
          content_blob: string | null
          created_at: string
          destination_country: string
          id: string
          last_verified: string | null
          modifier_type: string
          quick_select_label: string | null
          source_links: string[] | null
        }
        Insert: {
          content_blob?: string | null
          created_at?: string
          destination_country: string
          id?: string
          last_verified?: string | null
          modifier_type: string
          quick_select_label?: string | null
          source_links?: string[] | null
        }
        Update: {
          content_blob?: string | null
          created_at?: string
          destination_country?: string
          id?: string
          last_verified?: string | null
          modifier_type?: string
          quick_select_label?: string | null
          source_links?: string[] | null
        }
        Relationships: []
      }
      move_events: {
        Row: {
          created_at: string
          event_text: string
          id: string
          match_level: string | null
          match_reason: string | null
          matched_modifier: string | null
          move_id: string
        }
        Insert: {
          created_at?: string
          event_text: string
          id?: string
          match_level?: string | null
          match_reason?: string | null
          matched_modifier?: string | null
          move_id: string
        }
        Update: {
          created_at?: string
          event_text?: string
          id?: string
          match_level?: string | null
          match_reason?: string | null
          matched_modifier?: string | null
          move_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_events_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      moves: {
        Row: {
          created_at: string
          destination_country: string
          id: string
          move_type: string
          origin_country: string
          target_date: string
          user_id: string
          visa_type: string | null
        }
        Insert: {
          created_at?: string
          destination_country: string
          id?: string
          move_type: string
          origin_country: string
          target_date: string
          user_id: string
          visa_type?: string | null
        }
        Update: {
          created_at?: string
          destination_country?: string
          id?: string
          move_type?: string
          origin_country?: string
          target_date?: string
          user_id?: string
          visa_type?: string | null
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
