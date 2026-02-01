import { neon } from '@neondatabase/serverless';

interface Contact {
  id: string;
  identifier: string;
  display_name: string | null;
  custom_name: string | null;
  category_id: string;
  message_count: number;
}

async function findDuplicates() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  // Get all non-archived contacts
  const contacts = await sql`
    SELECT id, identifier, display_name, custom_name, category_id, message_count
    FROM contacts
    WHERE category_id != 'archived'
  ` as Contact[];

  console.log(`Checking ${contacts.length} non-archived contacts for duplicates...\n`);

  // Normalize and group
  const groups = new Map<string, Contact[]>();
  for (const c of contacts) {
    let normalized = c.identifier;
    if (!c.identifier.includes('@')) {
      normalized = c.identifier.replace(/\D/g, '');
      if (normalized.length === 11 && normalized.startsWith('1')) {
        normalized = normalized.slice(1);
      }
    } else {
      normalized = c.identifier.toLowerCase();
    }

    const existing = groups.get(normalized) || [];
    existing.push(c);
    groups.set(normalized, existing);
  }

  // Find and archive duplicates
  let archivedCount = 0;
  for (const [, group] of groups) {
    if (group.length > 1) {
      // Sort by message count, keep highest
      group.sort((a, b) => b.message_count - a.message_count);
      const keep = group[0];
      const dups = group.slice(1);

      const name = keep.custom_name || keep.display_name || keep.identifier;
      console.log(`${name}: keeping ${keep.category_id} (${keep.message_count} msgs), archiving ${dups.length} dups`);

      for (const dup of dups) {
        await sql`UPDATE contacts SET category_id = 'archived', updated_at = NOW() WHERE id = ${dup.id}`;
        archivedCount++;
      }
    }
  }

  console.log(`\nArchived ${archivedCount} duplicate contacts`);

  const counts = await sql`
    SELECT category_id, COUNT(*) as count
    FROM contacts
    GROUP BY category_id
    ORDER BY count DESC
  `;
  console.log('\nFinal counts:');
  for (const row of counts) {
    console.log(`  ${row.category_id}: ${row.count}`);
  }
}

findDuplicates().catch(console.error);
