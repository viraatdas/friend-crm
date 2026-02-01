import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { ContactWithCategory } from '@/lib/types';
import { DEFAULT_CATEGORY_ID } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const rows = await sql`
      SELECT * FROM contacts
      ORDER BY message_count DESC
    `;

    const contacts: ContactWithCategory[] = rows.map((row) => ({
      id: row.id,
      identifier: row.identifier,
      displayName: row.custom_name || row.display_name || null,
      messageCount: row.message_count,
      sentCount: row.sent_count || 0,
      receivedCount: row.received_count || 0,
      lastMessageDate: row.last_message_date,
      isSavedContact: row.is_saved_contact || false,
      categoryId: row.category_id || DEFAULT_CATEGORY_ID,
      notes: row.notes || '',
      customName: row.custom_name || null,
    }));

    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Error loading contacts:', error);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}
