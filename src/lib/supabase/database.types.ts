export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string | null
          company_id: string | null
          contact_id: string | null
          id: number
          lead_id: string | null
          occurred_at: string
          organization_id: string
          payload: NonNullable<Json>
          type: string
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          id?: never
          lead_id?: string | null
          occurred_at?: string
          organization_id: string
          payload?: NonNullable<Json>
          type: string
        }
        Update: {
          actor_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          id?: never
          lead_id?: string | null
          occurred_at?: string
          organization_id?: string
          payload?: NonNullable<Json>
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          scopes: string[]
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          scopes: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_rules: {
        Row: {
          config: NonNullable<Json>
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          pipeline_id: string
          strategy: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          config?: NonNullable<Json>
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          pipeline_id: string
          strategy: string
          updated_at?: string
        }
        Update: {
          config?: NonNullable<Json>
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          pipeline_id?: string
          strategy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_organization_id_pipeline_id_fkey"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          dedupe_key: string
          entity_id: string | null
          entity_type: string | null
          error: string | null
          event_id: number | null
          finished_at: string | null
          id: number
          organization_id: string
          result: NonNullable<Json>
          started_at: string
          status: string
        }
        ComputedFields: never
        Insert: {
          automation_id: string
          dedupe_key: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_id?: number | null
          finished_at?: string | null
          id?: never
          organization_id: string
          result?: NonNullable<Json>
          started_at?: string
          status?: string
        }
        Update: {
          automation_id?: string
          dedupe_key?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_id?: number | null
          finished_at?: string | null
          id?: never
          organization_id?: string
          result?: NonNullable<Json>
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_organization_id_automation_id_fkey"
            columns: ["organization_id", "automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: NonNullable<Json>
          conditions: NonNullable<Json>
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          pipeline_id: string | null
          state: NonNullable<Json>
          trigger_config: NonNullable<Json>
          trigger_type: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          actions: NonNullable<Json>
          conditions?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          pipeline_id?: string | null
          state?: NonNullable<Json>
          trigger_config?: NonNullable<Json>
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: NonNullable<Json>
          conditions?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          pipeline_id?: string | null
          state?: NonNullable<Json>
          trigger_config?: NonNullable<Json>
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_organization_id_pipeline_id_fkey"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      channels: {
        Row: {
          config: NonNullable<Json>
          created_at: string
          has_webhook_secret: boolean | null
          id: string
          name: string
          organization_id: string
          provider: string
          status: string
          updated_at: string
          vault_secret_id: string | null
          webhook_secret_hash: string | null
        }
        ComputedFields: never
        Insert: {
          config?: NonNullable<Json>
          created_at?: string
          has_webhook_secret?: never
          id?: string
          name: string
          organization_id: string
          provider: string
          status?: string
          updated_at?: string
          vault_secret_id?: string | null
          webhook_secret_hash?: string | null
        }
        Update: {
          config?: NonNullable<Json>
          created_at?: string
          has_webhook_secret?: never
          id?: string
          name?: string
          organization_id?: string
          provider?: string
          status?: string
          updated_at?: string
          vault_secret_id?: string | null
          webhook_secret_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: NonNullable<Json>
          created_at: string
          created_by: string | null
          custom_fields: NonNullable<Json>
          deleted_at: string | null
          email: string | null
          id: string
          industry: string | null
          name: string
          organization_id: string
          owner_id: string | null
          phone: string | null
          phone_normalized: string | null
          search_text: string | null
          updated_at: string
          website: string | null
        }
        ComputedFields: never
        Insert: {
          address?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          custom_fields?: NonNullable<Json>
          deleted_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          name: string
          organization_id: string
          owner_id?: string | null
          phone?: string | null
          phone_normalized?: never
          search_text?: never
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          custom_fields?: NonNullable<Json>
          deleted_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          name?: string
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          phone_normalized?: never
          search_text?: never
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_organization_id_owner_id_fkey"
            columns: ["organization_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      company_tags: {
        Row: {
          company_id: string
          organization_id: string
          tag_id: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          company_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tags_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "company_tags_organization_id_tag_id_fkey"
            columns: ["organization_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contact_identities: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          organization_id: string
          type: string
          value: string
          value_normalized: string | null
        }
        ComputedFields: never
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          organization_id: string
          type: string
          value: string
          value_normalized?: never
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          type?: string
          value?: string
          value_normalized?: never
        }
        Relationships: [
          {
            foreignKeyName: "contact_identities_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          organization_id: string
          tag_id: string
        }
        ComputedFields: never
        Insert: {
          contact_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "contact_tags_organization_id_tag_id_fkey"
            columns: ["organization_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: NonNullable<Json>
          company_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: NonNullable<Json>
          deleted_at: string | null
          first_name: string
          full_name: string | null
          id: string
          last_name: string
          organization_id: string
          owner_id: string | null
          position: string | null
          search_text: string | null
          source_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          address?: NonNullable<Json>
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: NonNullable<Json>
          deleted_at?: string | null
          first_name?: string
          full_name?: never
          id?: string
          last_name?: string
          organization_id: string
          owner_id?: string | null
          position?: string | null
          search_text?: never
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: NonNullable<Json>
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: NonNullable<Json>
          deleted_at?: string | null
          first_name?: string
          full_name?: never
          id?: string
          last_name?: string
          organization_id?: string
          owner_id?: string | null
          position?: string | null
          search_text?: never
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_owner_id_fkey"
            columns: ["organization_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "contacts_organization_id_source_id_fkey"
            columns: ["organization_id", "source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_message_id: number
          organization_id: string
          read_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          conversation_id: string
          last_read_message_id?: number
          organization_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_message_id?: number
          organization_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          organization_id: string
          tag_id: string
        }
        ComputedFields: never
        Insert: {
          conversation_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversation_tags_organization_id_tag_id_fkey"
            columns: ["organization_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      conversations: {
        Row: {
          assignee_id: string | null
          channel_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          display_name: string
          external_thread_id: string
          id: string
          last_message_at: string
          last_message_direction: string | null
          last_message_id: number | null
          last_message_preview: string
          lead_id: string | null
          organization_id: string
          search_text: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          channel_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          external_thread_id?: string
          id?: string
          last_message_at?: string
          last_message_direction?: string | null
          last_message_id?: number | null
          last_message_preview?: string
          lead_id?: string | null
          organization_id: string
          search_text?: never
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          channel_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          external_thread_id?: string
          id?: string
          last_message_at?: string
          last_message_direction?: string | null
          last_message_id?: number | null
          last_message_preview?: string
          lead_id?: string | null
          organization_id?: string
          search_text?: never
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_assignee_id_fkey"
            columns: ["organization_id", "assignee_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_channel_id_fkey"
            columns: ["organization_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          entity: string
          id: string
          is_required: boolean
          key: string
          label: string
          options: NonNullable<Json>
          organization_id: string
          position: number
          type: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          entity: string
          id?: string
          is_required?: boolean
          key: string
          label: string
          options?: NonNullable<Json>
          organization_id: string
          position?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: string
          is_required?: boolean
          key?: string
          label?: string
          options?: NonNullable<Json>
          organization_id?: string
          position?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          actor_id: string | null
          attempts: number
          automation_depth: number
          caused_by_automation_id: string | null
          dedupe_key: string | null
          entity_id: string
          entity_type: string
          id: number
          last_error: string | null
          locked_until: string | null
          occurred_at: string
          organization_id: string
          payload: NonNullable<Json>
          processed_at: string | null
          type: string
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          attempts?: number
          automation_depth?: number
          caused_by_automation_id?: string | null
          dedupe_key?: string | null
          entity_id: string
          entity_type: string
          id?: never
          last_error?: string | null
          locked_until?: string | null
          occurred_at?: string
          organization_id: string
          payload?: NonNullable<Json>
          processed_at?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          attempts?: number
          automation_depth?: number
          caused_by_automation_id?: string | null
          dedupe_key?: string | null
          entity_id?: string
          entity_type?: string
          id?: never
          last_error?: string | null
          locked_until?: string | null
          occurred_at?: string
          organization_id?: string
          payload?: NonNullable<Json>
          processed_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          lead_id: string | null
          message_id: number | null
          mime_type: string
          organization_id: string
          size_bytes: number
          storage_path: string
        }
        ComputedFields: never
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          lead_id?: string | null
          message_id?: number | null
          mime_type: string
          organization_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          lead_id?: string | null
          message_id?: number | null
          mime_type?: string
          organization_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "files_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "files_organization_id_message_id_fkey"
            columns: ["organization_id", "message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          entity: string
          errors: NonNullable<Json>
          failed_count: number
          file_name: string
          finished_at: string | null
          id: string
          mapping: NonNullable<Json>
          ok_count: number
          options: NonNullable<Json>
          organization_id: string
          processed_rows: number
          skipped_count: number
          status: string
          total_rows: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          entity: string
          errors?: NonNullable<Json>
          failed_count?: number
          file_name: string
          finished_at?: string | null
          id?: string
          mapping?: NonNullable<Json>
          ok_count?: number
          options?: NonNullable<Json>
          organization_id: string
          processed_rows?: number
          skipped_count?: number
          status?: string
          total_rows: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity?: string
          errors?: NonNullable<Json>
          failed_count?: number
          file_name?: string
          finished_at?: string | null
          id?: string
          mapping?: NonNullable<Json>
          ok_count?: number
          options?: NonNullable<Json>
          organization_id?: string
          processed_rows?: number
          skipped_count?: number
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          revoked_at: string | null
          role_id: string
          team_id: string | null
          token_hash: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          revoked_at?: string | null
          role_id: string
          team_id?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          revoked_at?: string | null
          role_id?: string
          team_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_role_id_fkey"
            columns: ["organization_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invitations_organization_id_team_id_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          contact_id: string
          created_at: string
          is_primary: boolean
          lead_id: string
          organization_id: string
          role: string | null
        }
        ComputedFields: never
        Insert: {
          contact_id: string
          created_at?: string
          is_primary?: boolean
          lead_id: string
          organization_id: string
          role?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          is_primary?: boolean
          lead_id?: string
          organization_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_contacts_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          channel: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          position: number
        }
        ComputedFields: never
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          position?: number
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage_id: string | null
          id: number
          lead_id: string
          organization_id: string
          pipeline_id: string | null
          time_in_previous: string | null
          to_stage_id: string | null
        }
        ComputedFields: never
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage_id?: string | null
          id?: never
          lead_id: string
          organization_id: string
          pipeline_id?: string | null
          time_in_previous?: string | null
          to_stage_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage_id?: string | null
          id?: never
          lead_id?: string
          organization_id?: string
          pipeline_id?: string | null
          time_in_previous?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_stage_history_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          lead_id: string
          organization_id: string
          tag_id: string
        }
        ComputedFields: never
        Insert: {
          lead_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_tags_organization_id_tag_id_fkey"
            columns: ["organization_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      leads: {
        Row: {
          closed_at: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          custom_fields: NonNullable<Json>
          deleted_at: string | null
          description: string | null
          id: string
          last_activity_at: string
          loss_comment: string | null
          loss_reason_id: string | null
          next_task_due_at: string | null
          organization_id: string
          pipeline_id: string
          position: number
          priority: Database["public"]["Enums"]["lead_priority"]
          responsible_id: string | null
          search_text: string | null
          source_id: string | null
          stage_entered_at: string
          stage_id: string
          status: Database["public"]["Enums"]["stage_kind"]
          team_id: string | null
          title: string
          updated_at: string
          value: number
          won_amount: number | null
        }
        ComputedFields: never
        Insert: {
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          custom_fields?: NonNullable<Json>
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_activity_at?: string
          loss_comment?: string | null
          loss_reason_id?: string | null
          next_task_due_at?: string | null
          organization_id: string
          pipeline_id: string
          position?: number
          priority?: Database["public"]["Enums"]["lead_priority"]
          responsible_id?: string | null
          search_text?: never
          source_id?: string | null
          stage_entered_at?: string
          stage_id: string
          status?: Database["public"]["Enums"]["stage_kind"]
          team_id?: string | null
          title: string
          updated_at?: string
          value?: number
          won_amount?: number | null
        }
        Update: {
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_fields?: NonNullable<Json>
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_activity_at?: string
          loss_comment?: string | null
          loss_reason_id?: string | null
          next_task_due_at?: string | null
          organization_id?: string
          pipeline_id?: string
          position?: number
          priority?: Database["public"]["Enums"]["lead_priority"]
          responsible_id?: string | null
          search_text?: never
          source_id?: string | null
          stage_entered_at?: string
          stage_id?: string
          status?: Database["public"]["Enums"]["stage_kind"]
          team_id?: string | null
          title?: string
          updated_at?: string
          value?: number
          won_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_loss_reason_id_fkey"
            columns: ["organization_id", "loss_reason_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_id_pipeline_id_stage_id_fkey"
            columns: ["organization_id", "pipeline_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "pipeline_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_id_responsible_id_fkey"
            columns: ["organization_id", "responsible_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "leads_organization_id_source_id_fkey"
            columns: ["organization_id", "source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_id_team_id_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          position: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "loss_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          title?: string | null
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
            foreignKeyName: "memberships_organization_id_role_id_fkey"
            columns: ["organization_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organization_id", "id"]
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
      messages: {
        Row: {
          body: string
          content_type: string
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string
          error: string | null
          external_message_id: string | null
          id: number
          kind: string
          organization_id: string
          sender_user_id: string | null
          sent_at: string
        }
        ComputedFields: never
        Insert: {
          body?: string
          content_type?: string
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          error?: string | null
          external_message_id?: string | null
          id?: never
          kind?: string
          organization_id: string
          sender_user_id?: string | null
          sent_at?: string
        }
        Update: {
          body?: string
          content_type?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          error?: string | null
          external_message_id?: string | null
          id?: never
          kind?: string
          organization_id?: string
          sender_user_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          lead_id: string | null
          organization_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          body: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          lead_id?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          lead_id?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notes_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          in_app: boolean
          organization_id: string
          type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          in_app?: boolean
          organization_id: string
          type: string
          user_id: string
        }
        Update: {
          in_app?: boolean
          organization_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          link: string | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          link?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          link?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string
          created_at: string
          currency: string
          default_locale: string
          fiscal_code: string | null
          id: string
          legal_name: string | null
          logo_path: string | null
          name: string
          settings: NonNullable<Json>
          slug: string
          timezone: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          default_locale?: string
          fiscal_code?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          name: string
          settings?: NonNullable<Json>
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          default_locale?: string
          fiscal_code?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          name?: string
          settings?: NonNullable<Json>
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["stage_kind"]
          name: string
          organization_id: string
          pipeline_id: string
          position: number
          probability: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          color?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["stage_kind"]
          name: string
          organization_id: string
          pipeline_id: string
          position?: number
          probability?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["stage_kind"]
          name?: string
          organization_id?: string
          pipeline_id?: string
          position?: number
          probability?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_pipeline_id_fkey"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      pipelines: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          organization_id: string
          position: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          owner_id: string | null
          shortcut: string | null
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          owner_id?: string | null
          shortcut?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          shortcut?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_replies_organization_id_owner_id_fkey"
            columns: ["organization_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          organization_id: string
          permissions: string[]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          organization_id: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        ComputedFields: never
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_types: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_system: boolean
          key: string
          name: string
          organization_id: string
          position: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          organization_id: string
          position?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          all_day: boolean
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          duration_minutes: number | null
          id: string
          lead_id: string | null
          organization_id: string
          overdue_notified_at: string | null
          priority: Database["public"]["Enums"]["lead_priority"]
          reminder_at: string | null
          reminder_sent_at: string | null
          responsible_id: string | null
          result: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          all_day?: boolean
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at: string
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          organization_id: string
          overdue_notified_at?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          reminder_at?: string | null
          reminder_sent_at?: string | null
          responsible_id?: string | null
          result?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type_id: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          overdue_notified_at?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          reminder_at?: string | null
          reminder_sent_at?: string | null
          responsible_id?: string | null
          result?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_lead_id_fkey"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_responsible_id_fkey"
            columns: ["organization_id", "responsible_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_type_id_fkey"
            columns: ["organization_id", "type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          organization_id: string
          team_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          organization_id: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_team_id_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "team_members_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_manager_id_fkey"
            columns: ["organization_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          channel_id: string | null
          error: string | null
          external_event_id: string
          id: number
          organization_id: string | null
          payload: NonNullable<Json>
          processed_at: string | null
          provider: string
          received_at: string
          signature_valid: boolean
        }
        ComputedFields: never
        Insert: {
          channel_id?: string | null
          error?: string | null
          external_event_id: string
          id?: never
          organization_id?: string | null
          payload: NonNullable<Json>
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_valid: boolean
        }
        Update: {
          channel_id?: string | null
          error?: string | null
          external_event_id?: string
          id?: never
          organization_id?: string | null
          payload?: NonNullable<Json>
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
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
      accept_invitation: { Args: { p_token: string }; Returns: string }
      active_automations: {
        Args: { p_orgs: string[] }
        Returns: {
          actions: NonNullable<Json>
          conditions: NonNullable<Json>
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          pipeline_id: string | null
          state: NonNullable<Json>
          trigger_config: NonNullable<Json>
          trigger_type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      assign_conversation: {
        Args: { p_assignee?: string; p_conversation: string }
        Returns: undefined
      }
      authenticate_api_key: {
        Args: { p_hash: string }
        Returns: {
          created_by: string
          key_id: string
          organization_id: string
          scopes: string[]
        }[]
      }
      automation_execute: {
        Args: {
          p_actions: Json
          p_contact?: string
          p_depth: number
          p_lead?: string
          p_run: number
          p_task?: string
        }
        Returns: Json
      }
      automation_finish_run: {
        Args: { p_error?: string; p_result?: Json; p_run: number; p_status: string }
        Returns: undefined
      }
      automation_snapshot: { Args: { p_lead?: string; p_task?: string }; Returns: Json }
      automation_start_run: {
        Args: {
          p_automation: string
          p_dedupe_key: string
          p_entity_id: string
          p_entity_type: string
          p_event: number
        }
        Returns: number
      }
      claim_domain_events: {
        Args: { p_limit?: number }
        Returns: {
          actor_id: string | null
          attempts: number
          automation_depth: number
          caused_by_automation_id: string | null
          dedupe_key: string | null
          entity_id: string
          entity_type: string
          id: number
          last_error: string | null
          locked_until: string | null
          occurred_at: string
          organization_id: string
          payload: NonNullable<Json>
          processed_at: string | null
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "domain_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_domain_event: { Args: { p_error?: string; p_id: number }; Returns: undefined }
      complete_domain_events: { Args: { p_ids: number[] }; Returns: undefined }
      create_organization: { Args: { p_name: string }; Returns: string }
      find_company_duplicates: {
        Args: {
          p_email?: string
          p_exclude?: string
          p_name: string
          p_org: string
          p_phone?: string
        }
        Returns: {
          company_id: string
          is_visible: boolean
          matched_type: string
          name: string
        }[]
      }
      find_contact_duplicates: {
        Args: { p_exclude?: string; p_identities: Json; p_org: string }
        Returns: {
          contact_id: string
          full_name: string
          is_visible: boolean
          matched_type: string
          matched_value: string
        }[]
      }
      finish_import: { Args: { p_job: string; p_status: string }; Returns: undefined }
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          is_valid: boolean
          organization_name: string
          role_name: string
        }[]
      }
      import_rows: { Args: { p_errors?: Json; p_job: string; p_rows: Json }; Returns: Json }
      inbox_unread_counts: {
        Args: { p_ids: string[] }
        Returns: {
          conversation_id: string
          unread: number
        }[]
      }
      inbox_unread_total: { Args: { p_org: string }; Returns: number }
      ingest_inbound_message: { Args: { p_channel: string; p_message: Json }; Returns: Json }
      mark_conversation_read: { Args: { p_conversation: string }; Returns: undefined }
      merge_contacts: { Args: { p_keep: string; p_remove: string }; Returns: string }
      pipeline_summary: {
        Args: {
          p_pipeline: string
          p_priority?: Database["public"]["Enums"]["lead_priority"]
          p_responsible?: string
          p_search?: string
        }
        Returns: {
          lead_count: number
          stage_id: string
          total: number
        }[]
      }
      report_activities: {
        Args: { p_from: string; p_org: string; p_responsible?: string; p_to: string }
        Returns: {
          done: number
          name: string
          overdue: number
          planned: number
          type_id: string
        }[]
      }
      report_by_responsible: {
        Args: {
          p_from: string
          p_org: string
          p_pipeline?: string
          p_source?: string
          p_team?: string
          p_to: string
        }
        Returns: {
          lost_count: number
          name: string
          new_leads: number
          open_leads: number
          open_value: number
          tasks_done: number
          tasks_overdue: number
          user_id: string
          won_amount: number
          won_count: number
        }[]
      }
      report_by_source: {
        Args: {
          p_from: string
          p_org: string
          p_pipeline?: string
          p_responsible?: string
          p_team?: string
          p_to: string
        }
        Returns: {
          name: string
          new_leads: number
          source_id: string
          won_amount: number
          won_count: number
        }[]
      }
      report_funnel: {
        Args: {
          p_from: string
          p_org: string
          p_pipeline: string
          p_responsible?: string
          p_source?: string
          p_team?: string
          p_to: string
        }
        Returns: {
          color: string
          current_count: number
          current_value: number
          kind: string
          name: string
          reached: number
          stage_id: string
          stage_position: number
        }[]
      }
      report_kpis: {
        Args: {
          p_from: string
          p_org: string
          p_pipeline?: string
          p_responsible?: string
          p_source?: string
          p_team?: string
          p_to: string
        }
        Returns: {
          active_leads: number
          active_value: number
          avg_cycle_days: number
          lost_count: number
          new_leads: number
          tasks_overdue: number
          tasks_today: number
          win_rate: number
          won_amount: number
          won_count: number
        }[]
      }
      report_loss_reasons: {
        Args: {
          p_from: string
          p_org: string
          p_pipeline?: string
          p_responsible?: string
          p_source?: string
          p_team?: string
          p_to: string
        }
        Returns: {
          lost_count: number
          lost_value: number
          name: string
          reason_id: string
        }[]
      }
      report_timeseries: {
        Args: {
          p_bucket: string
          p_from: string
          p_org: string
          p_pipeline?: string
          p_responsible?: string
          p_source?: string
          p_team?: string
          p_to: string
        }
        Returns: {
          bucket: string
          lost_count: number
          new_leads: number
          won_amount: number
          won_count: number
        }[]
      }
    }
    Enums: {
      lead_priority: "low" | "normal" | "high" | "urgent"
      membership_status: "active" | "disabled"
      stage_kind: "open" | "won" | "lost"
      task_status: "new" | "in_progress" | "done" | "cancelled"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      lead_priority: ["low", "normal", "high", "urgent"],
      membership_status: ["active", "disabled"],
      stage_kind: ["open", "won", "lost"],
      task_status: ["new", "in_progress", "done", "cancelled"],
    },
  },
} as const
