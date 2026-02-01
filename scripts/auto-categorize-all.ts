import { neon } from '@neondatabase/serverless';

interface Contact {
  id: string;
  identifier: string;
  display_name: string | null;
  custom_name: string | null;
  message_count: number;
  last_message_date: string | null;
}

async function autoCategorize() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  // Get all uncategorized contacts (excluding purdue/high-school which are school-based)
  const uncategorized = await sql`
    SELECT id, identifier, display_name, custom_name, message_count, last_message_date
    FROM contacts
    WHERE category_id = 'uncategorized'
    ORDER BY message_count DESC
  ` as Contact[];

  console.log(`Processing ${uncategorized.length} uncategorized contacts...\n`);

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

  const categorizations: { id: string; category: string; name: string; reason: string }[] = [];

  for (const contact of uncategorized) {
    const name = contact.custom_name || contact.display_name || contact.identifier;
    const msgs = contact.message_count;
    const lastDate = contact.last_message_date ? new Date(contact.last_message_date) : null;
    const isRecent = lastDate && lastDate > oneYearAgo;
    const isSomewhatRecent = lastDate && lastDate > twoYearsAgo;
    const isOld = !lastDate || lastDate < threeYearsAgo;

    let category: string | null = null;
    let reason = '';

    // Skip weird identifiers
    if (contact.identifier.includes('urn:') || contact.identifier.includes('p:+')) {
      category = 'archived';
      reason = 'Business/system identifier';
    }
    // High message count + recent = mid-yielding (user can promote)
    else if (msgs >= 500 && isRecent) {
      category = 'mid-yielding';
      reason = `${msgs} msgs, recent activity`;
    }
    // High message count but not recent = out-of-reach
    else if (msgs >= 500 && !isRecent) {
      category = 'out-of-reach';
      reason = `${msgs} msgs but no recent activity`;
    }
    // Medium message count + recent = not-high-yielding
    else if (msgs >= 100 && isRecent) {
      category = 'not-high-yielding';
      reason = `${msgs} msgs, recent activity`;
    }
    // Medium message count + somewhat recent = not-high-yielding
    else if (msgs >= 100 && isSomewhatRecent) {
      category = 'not-high-yielding';
      reason = `${msgs} msgs, somewhat recent`;
    }
    // Medium message count but old = out-of-reach
    else if (msgs >= 100 && !isSomewhatRecent) {
      category = 'out-of-reach';
      reason = `${msgs} msgs but old`;
    }
    // Low message count + recent = not-high-yielding (might be new friend)
    else if (msgs >= 20 && isRecent) {
      category = 'not-high-yielding';
      reason = `${msgs} msgs, recent - possible new contact`;
    }
    // Low message count + old = archive
    else if (msgs < 20 || isOld) {
      category = 'archived';
      reason = `Low engagement (${msgs} msgs) or old`;
    }
    // Everything else = not-high-yielding as default
    else {
      category = 'not-high-yielding';
      reason = `${msgs} msgs - default bucket`;
    }

    if (category) {
      categorizations.push({ id: contact.id, category, name, reason });
    }
  }

  // Group by category for display
  const byCategory = new Map<string, typeof categorizations>();
  for (const c of categorizations) {
    const existing = byCategory.get(c.category) || [];
    existing.push(c);
    byCategory.set(c.category, existing);
  }

  // Display and update
  for (const [category, contacts] of byCategory) {
    console.log(`\n${category.toUpperCase()} (${contacts.length}):`);
    for (const c of contacts.slice(0, 10)) {
      console.log(`  - ${c.name}: ${c.reason}`);
    }
    if (contacts.length > 10) {
      console.log(`  ... and ${contacts.length - 10} more`);
    }

    // Update database
    for (const c of contacts) {
      await sql`UPDATE contacts SET category_id = ${category}, updated_at = NOW() WHERE id = ${c.id}`;
    }
  }

  // Final counts
  const counts = await sql`
    SELECT category_id, COUNT(*) as count
    FROM contacts
    GROUP BY category_id
    ORDER BY count DESC
  `;

  console.log('\n\n✅ Auto-categorization complete!\n');
  console.log('Final counts:');
  for (const row of counts) {
    console.log(`  ${row.category_id}: ${row.count}`);
  }
}

autoCategorize().catch(console.error);
