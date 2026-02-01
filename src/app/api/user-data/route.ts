import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const body = await request.json();
    const { contactId, categoryId, notes, customName } = body;

    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    // Update each field separately to work with tagged template literals
    if (categoryId !== undefined) {
      await sql`
        UPDATE contacts
        SET category_id = ${categoryId}, updated_at = NOW()
        WHERE id = ${contactId}
      `;
    }

    if (notes !== undefined) {
      await sql`
        UPDATE contacts
        SET notes = ${notes}, updated_at = NOW()
        WHERE id = ${contactId}
      `;
    }

    if (customName !== undefined) {
      await sql`
        UPDATE contacts
        SET custom_name = ${customName}, updated_at = NOW()
        WHERE id = ${contactId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving user data:', error);
    return NextResponse.json({ error: 'Failed to save user data' }, { status: 500 });
  }
}
