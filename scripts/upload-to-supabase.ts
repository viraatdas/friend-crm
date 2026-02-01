import { createClient } from '@supabase/supabase-js';
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!fs.existsSync(CONTACTS_PATH)) {
    console.error('No contacts.json found. Run `npm run extract` first.');
    process.exit(1);
  }

  const contacts: ExtractedContact[] = JSON.parse(fs.readFileSync(CONTACTS_PATH, 'utf-8'));
  console.log(`Uploading ${contacts.length} contacts to Supabase...`);

  // Transform to database format
  const dbContacts = contacts.map((c) => ({
    id: c.id,
    identifier: c.identifier,
    display_name: c.displayName,
    message_count: c.messageCount,
    sent_count: c.sentCount,
    received_count: c.receivedCount,
    last_message_date: c.lastMessageDate,
    is_saved_contact: c.isSavedContact,
    category_id: 'uncategorized',
    notes: '',
    custom_name: null,
  }));

  // Upsert in batches of 100
  const batchSize = 100;
  let uploaded = 0;

  for (let i = 0; i < dbContacts.length; i += batchSize) {
    const batch = dbContacts.slice(i, i + batchSize);

    const { error } = await supabase
      .from('contacts')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error('Error uploading batch:', error);
      process.exit(1);
    }

    uploaded += batch.length;
    console.log(`Uploaded ${uploaded}/${dbContacts.length} contacts`);
  }

  console.log('Done! All contacts uploaded to Supabase.');
}

uploadContacts();
