export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          created_at: string
          ensemble_role: Database["public"]["Enums"]["ensemble_role"]
          group_id: string
          id: string
          musician_id: string
          organization_id: string
          part_id: string | null
          section_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ensemble_role: Database["public"]["Enums"]["ensemble_role"]
          group_id: string
          id?: string
          musician_id: string
          organization_id: string
          part_id?: string | null
          section_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ensemble_role?: Database["public"]["Enums"]["ensemble_role"]
          group_id?: string
          id?: string
          musician_id?: string
          organization_id?: string
          part_id?: string | null
          section_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_musician_id_fkey"
            columns: ["musician_id"]
            isOneToOne: false
            referencedRelation: "musicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      event_groups: {
        Row: {
          created_at: string
          event_id: string
          group_id: string
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          group_id: string
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          group_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_musicians: {
        Row: {
          created_at: string
          event_id: string
          id: string
          musician_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          musician_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          musician_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_musicians_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_musicians_musician_id_fkey"
            columns: ["musician_id"]
            isOneToOne: false
            referencedRelation: "musicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_musicians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["event_kind"]
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["event_kind"]
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["event_kind"]
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          location: string | null
          notes: string | null
          organization_id: string
          starts_at: string
          title: string | null
          type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          organization_id: string
          starts_at: string
          title?: string | null
          type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          organization_id?: string
          starts_at?: string
          title?: string | null
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          created_at: string
          created_by_user_id: string
          expires_at: string
          group_id: string
          id: string
          max_uses: number
          organization_id: string
          redeemed_at: string | null
          redeemed_by_user_id: string | null
          revoked_at: string | null
          token: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          expires_at: string
          group_id: string
          id?: string
          max_uses?: number
          organization_id: string
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          revoked_at?: string | null
          token?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          expires_at?: string
          group_id?: string
          id?: string
          max_uses?: number
          organization_id?: string
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          revoked_at?: string | null
          token?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_redeemed_by_user_id_fkey"
            columns: ["redeemed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["group_kind"]
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["group_kind"]
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["group_kind"]
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          access_role: Database["public"]["Enums"]["access_role"]
          created_at: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_role: Database["public"]["Enums"]["access_role"]
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_role?: Database["public"]["Enums"]["access_role"]
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      musicians: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          group_invite_id: string | null
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          group_invite_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          group_invite_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "musicians_group_invite_id_fkey"
            columns: ["group_invite_id"]
            isOneToOne: false
            referencedRelation: "group_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "musicians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "musicians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          image_storage_key: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_storage_key?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_storage_key?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      part_divisions: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          part_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          part_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          part_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_divisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_divisions_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["part_kind"]
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["part_kind"]
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["part_kind"]
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      password_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_recovery_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_file_annotations: {
        Row: {
          author_user_id: string
          color: string
          created_at: string
          geometry: Json
          id: string
          layer: Database["public"]["Enums"]["annotation_layer"]
          organization_id: string
          page_number: number
          piece_file_id: string
          section_id: string | null
          type: Database["public"]["Enums"]["annotation_type"]
          updated_at: string
        }
        Insert: {
          author_user_id: string
          color: string
          created_at?: string
          geometry: Json
          id?: string
          layer: Database["public"]["Enums"]["annotation_layer"]
          organization_id: string
          page_number: number
          piece_file_id: string
          section_id?: string | null
          type: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          color?: string
          created_at?: string
          geometry?: Json
          id?: string
          layer?: Database["public"]["Enums"]["annotation_layer"]
          organization_id?: string
          page_number?: number
          piece_file_id?: string
          section_id?: string | null
          type?: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_file_annotations_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_file_annotations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_file_annotations_piece_file_id_fkey"
            columns: ["piece_file_id"]
            isOneToOne: false
            referencedRelation: "piece_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_file_annotations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_file_part_links: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          part_division_id: string | null
          part_id: string
          piece_file_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          part_division_id?: string | null
          part_id: string
          piece_file_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          part_division_id?: string | null
          part_id?: string
          piece_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_file_part_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_file_part_links_part_division_id_fkey"
            columns: ["part_division_id"]
            isOneToOne: false
            referencedRelation: "part_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_file_part_links_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_file_part_links_piece_file_id_fkey"
            columns: ["piece_file_id"]
            isOneToOne: false
            referencedRelation: "piece_files"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_files: {
        Row: {
          byte_size: number | null
          content_hash: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["piece_file_kind"]
          mime_type: string
          organization_id: string
          original_name: string
          piece_id: string
          storage_key: string
          title: string
          updated_at: string
        }
        Insert: {
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["piece_file_kind"]
          mime_type: string
          organization_id: string
          original_name: string
          piece_id: string
          storage_key: string
          title: string
          updated_at?: string
        }
        Update: {
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["piece_file_kind"]
          mime_type?: string
          organization_id?: string
          original_name?: string
          piece_id?: string
          storage_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_files_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_theme_links: {
        Row: {
          created_at: string
          organization_id: string
          piece_id: string
          theme_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          piece_id: string
          theme_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          piece_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_theme_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_theme_links_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_theme_links_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "piece_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_themes: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_themes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pieces: {
        Row: {
          aliases: string[]
          category_id: string
          composer: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          notes: string | null
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          category_id: string
          composer?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          category_id?: string
          composer?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pieces_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "piece_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pieces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          theme: Database["public"]["Enums"]["theme_preference"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id: string
          theme?: Database["public"]["Enums"]["theme_preference"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          theme?: Database["public"]["Enums"]["theme_preference"]
          updated_at?: string
        }
        Relationships: []
      }
      program_items: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notes: string | null
          organization_id: string
          piece_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          organization_id: string
          piece_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          piece_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_items_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_playlist_items: {
        Row: {
          created_at: string
          id: string
          label: string | null
          notes: string | null
          organization_id: string
          piece_file_id: string
          playlist_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          organization_id: string
          piece_file_id: string
          playlist_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          organization_id?: string
          piece_file_id?: string
          playlist_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_playlist_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_playlist_items_piece_file_id_fkey"
            columns: ["piece_file_id"]
            isOneToOne: false
            referencedRelation: "piece_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "reading_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_playlists: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          owner_user_id: string
          source_event_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          owner_user_id: string
          source_event_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          owner_user_id?: string
          source_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_playlists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_playlists_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_playlists_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      section_parts: {
        Row: {
          created_at: string
          organization_id: string
          part_id: string
          section_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          part_id: string
          section_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          part_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_parts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_event: { Args: { p_event_id: string }; Returns: boolean }
      can_write_event: { Args: { p_event_id: string }; Returns: boolean }
      create_group_invite: {
        Args: { p_expires_at: string; p_group_id: string; p_max_uses?: number }
        Returns: {
          invite_id: string
          token: string
        }[]
      }
      current_musician_id: { Args: { p_org_id: string }; Returns: string }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          group_id: string
          group_name: string
          invite_id: string
          organization_id: string
          organization_image_storage_key: string
          organization_name: string
          organization_slug: string
        }[]
      }
      grant_org_admin: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      has_org_role: {
        Args: {
          p_org_id: string
          p_roles: Database["public"]["Enums"]["access_role"][]
        }
        Returns: boolean
      }
      hash_token: { Args: { p_token: string }; Returns: string }
      is_in_section: {
        Args: { p_org_id: string; p_section_id: string }
        Returns: boolean
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_section_lead_for: {
        Args: { p_org_id: string; p_section_id: string }
        Returns: boolean
      }
      is_teacher_in_org: { Args: { p_org_id: string }; Returns: boolean }
      is_teacher_of_group: {
        Args: { p_group_id: string; p_org_id: string }
        Returns: boolean
      }
      list_group_invites: {
        Args: { p_organization_id: string }
        Returns: {
          created_at: string
          expires_at: string
          group_id: string
          group_name: string
          id: string
          max_uses: number
          redeemed_at: string
          redeemed_musicians: Json
          revoked_at: string
          token: string
          use_count: number
        }[]
      }
      musician_in_teacher_groups: {
        Args: { p_musician_id: string; p_org_id: string }
        Returns: boolean
      }
      redeem_group_invite: {
        Args: { p_birth_date?: string; p_phone?: string; p_token: string }
        Returns: {
          organization_slug: string
        }[]
      }
      revoke_group_invite: { Args: { p_invite_id: string }; Returns: undefined }
      revoke_org_admin: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      seed_event_types: { Args: { p_org_id: string }; Returns: undefined }
      seed_piece_taxonomy: { Args: { p_org_id: string }; Returns: undefined }
      storage_org_id_from_path: { Args: { p_name: string }; Returns: string }
      update_group_invite_expires: {
        Args: { p_expires_at: string; p_invite_id: string }
        Returns: undefined
      }
      update_group_invite_max_uses: {
        Args: { p_invite_id: string; p_max_uses: number }
        Returns: undefined
      }
    }
    Enums: {
      access_role: "owner" | "admin" | "member"
      annotation_layer: "personal" | "section"
      annotation_type: "stroke" | "highlight"
      ensemble_role: "member" | "teacher" | "section_lead" | "conductor"
      event_kind: "rehearsal" | "service" | "class" | "special"
      group_kind: "ensemble" | "choir" | "class" | "other"
      part_kind: "instrument" | "voice"
      piece_file_kind: "score" | "audio"
      theme_preference: "light" | "dark"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_role: ["owner", "admin", "member"],
      annotation_layer: ["personal", "section"],
      annotation_type: ["stroke", "highlight"],
      ensemble_role: ["member", "teacher", "section_lead", "conductor"],
      event_kind: ["rehearsal", "service", "class", "special"],
      group_kind: ["ensemble", "choir", "class", "other"],
      part_kind: ["instrument", "voice"],
      piece_file_kind: ["score", "audio"],
      theme_preference: ["light", "dark"],
    },
  },
} as const

