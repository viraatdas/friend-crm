import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const rows = await sql`
      SELECT * FROM settings WHERE id = 'default'
    `;

    if (rows.length === 0) {
      return NextResponse.json({ category_order: null });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json({ category_order: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const body = await request.json();
    const { categoryOrder } = body;

    await sql`
      INSERT INTO settings (id, category_order, updated_at)
      VALUES ('default', ${categoryOrder}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        category_order = ${categoryOrder},
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
