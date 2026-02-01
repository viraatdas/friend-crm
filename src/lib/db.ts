import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export { sql };

export interface DbContact {
  id: string;
  identifier: string;
  display_name: string | null;
  message_count: number;
  sent_count: number;
  received_count: number;
  last_message_date: string | null;
  is_saved_contact: boolean;
  category_id: string;
  notes: string;
  custom_name: string | null;
  created_at?: string;
  updated_at?: string;
}
