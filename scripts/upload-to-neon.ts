import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const CONTACTS_PATH = path.join(process.cwd(), 'data/contacts.json');

interface ExtractedContact {
  id: string;
  identifier: string;
  displayName: string | null;
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  lastMessageDate: string | null;
  isSavedContact: boolean;
}

async function uploadContacts() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  if (!fs.existsSync(CONTACTS_PATH)) {
    console.error('No contacts.json found. Run `npm run extract` first.');
    process.exit(1);
  }

  const contacts: ExtractedContact[] = JSON.parse(fs.readFileSync(CONTACTS_PATH, 'utf-8'));
  console.log(`Uploading ${contacts.length} contacts to Neon...`);

  // Create tables if they don't exist
  console.log('Creating tables...');
  await sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      display_name TEXT,
      message_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      received_count INTEGER DEFAULT 0,
      last_message_date TIMESTAMPTZ,
      is_saved_contact BOOLEAN DEFAULT false,
      category_id TEXT DEFAULT 'uncategorized',
      notes TEXT DEFAULT '',
      custom_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      category_order TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Upload contacts in batches
  const batchSize = 50;
  let uploaded = 0;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);

    for (const c of batch) {
      await sql`
        INSERT INTO contacts (
          id, identifier, display_name, message_count, sent_count, received_count,
          last_message_date, is_saved_contact, category_id, notes, custom_name
        ) VALUES (
          ${c.id}, ${c.identifier}, ${c.displayName}, ${c.messageCount},
          ${c.sentCount}, ${c.receivedCount}, ${c.lastMessageDate},
          ${c.isSavedContact}, 'uncategorized', '', NULL
        )
        ON CONFLICT (id) DO UPDATE SET
          identifier = ${c.identifier},
          display_name = COALESCE(contacts.custom_name, ${c.displayName}),
          message_count = ${c.messageCount},
          sent_count = ${c.sentCount},
          received_count = ${c.receivedCount},
          last_message_date = ${c.lastMessageDate},
          is_saved_contact = ${c.isSavedContact},
          updated_at = NOW()
      `;
    }

    uploaded += batch.length;
    console.log(`Uploaded ${uploaded}/${contacts.length} contacts`);
  }

  console.log('Done! All contacts uploaded to Neon.');
}

uploadContacts().catch(console.error);
