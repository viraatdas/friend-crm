import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';
import * as path from 'path';
import * as os from 'os';

const CHAT_DB_PATH = path.join(os.homedir(), 'Library/Messages/chat.db');

// User's graduation dates - High School 2018, College 2020
const HIGH_SCHOOL_GRAD_YEAR = 2018;
const COLLEGE_GRAD_YEAR = 2020;

interface UncategorizedContact {
  id: string;
  identifier: string;
  display_name: string | null;
  custom_name: string | null;
}

interface MessageInfo {
  text: string;
  date: Date;
  is_from_me: boolean;
}

function convertAppleTimestamp(timestamp: number): Date {
  const appleEpoch = new Date('2001-01-01T00:00:00Z').getTime();
  const milliseconds = timestamp / 1_000_000 + appleEpoch;
  return new Date(milliseconds);
}

function getRecentMessages(db: Database.Database, identifier: string): MessageInfo[] {
  const query = `
    SELECT m.text, m.date, m.is_from_me
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE h.id = ?
      AND m.text IS NOT NULL
      AND m.text != ''
    ORDER BY m.date DESC
    LIMIT 10
  `;

  const rows = db.prepare(query).all(identifier) as {
    text: string;
    date: number;
    is_from_me: number;
  }[];

  return rows.map((row) => ({
    text: row.text,
    date: convertAppleTimestamp(row.date),
    is_from_me: row.is_from_me === 1,
  }));
}

function getFirstMessageDate(db: Database.Database, identifier: string): Date | null {
  const query = `
    SELECT MIN(m.date) as first_date
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE h.id = ?
      AND m.text IS NOT NULL
  `;

  const row = db.prepare(query).get(identifier) as { first_date: number | null };
  return row?.first_date ? convertAppleTimestamp(row.first_date) : null;
}

function analyzeMessages(
  messages: MessageInfo[],
  firstMessageDate: Date | null
): { category: string | null; reason: string } {
  if (messages.length === 0) {
    return { category: null, reason: 'No messages found' };
  }

  const textContent = messages.map((m) => m.text.toLowerCase()).join(' ');
  const firstDate = firstMessageDate;

  // Keywords that suggest Purdue/college context
  const purdueKeywords = [
    'purdue', 'boiler', 'west lafayette', 'campus', 'dorm', 'class', 'professor',
    'exam', 'midterm', 'final', 'homework', 'study', 'library', 'lecture',
    'corec', 'pmu', 'walc', 'rawls', 'krannert', 'neil armstrong',
    'cs ', 'engineering', 'major', 'freshman', 'sophomore', 'junior', 'senior',
    'internship', 'career fair', 'frat', 'sorority', 'rush'
  ];

  // Keywords that suggest high school context
  const highSchoolKeywords = [
    'high school', 'homecoming', 'prom', 'sat', 'act', 'college app',
    'graduation', 'senior year', 'junior year', 'ap class', 'varsity',
    'jv', 'driver', 'permit', 'license', 'parent', 'grounded'
  ];

  // Check for keyword matches
  const hasPurdueKeyword = purdueKeywords.some((kw) => textContent.includes(kw));
  const hasHighSchoolKeyword = highSchoolKeywords.some((kw) => textContent.includes(kw));

  // Analyze first message date to determine era
  if (firstDate) {
    const year = firstDate.getFullYear();

    // If first contact was during high school years (before 2018)
    if (year < HIGH_SCHOOL_GRAD_YEAR) {
      if (hasPurdueKeyword && !hasHighSchoolKeyword) {
        return { category: 'purdue', reason: `First contact ${year}, but mentions Purdue topics` };
      }
      return { category: 'high-school', reason: `First contact in ${year} (before HS graduation)` };
    }

    // If first contact was during college years (2018-2020)
    if (year >= HIGH_SCHOOL_GRAD_YEAR && year <= COLLEGE_GRAD_YEAR) {
      if (hasHighSchoolKeyword && !hasPurdueKeyword) {
        return { category: 'high-school', reason: `First contact ${year}, but mentions HS topics` };
      }
      return { category: 'purdue', reason: `First contact in ${year} (during college)` };
    }

    // If first contact was after college
    if (year > COLLEGE_GRAD_YEAR) {
      // Can't determine school affiliation from recent contacts
      if (hasPurdueKeyword) {
        return { category: 'purdue', reason: `First contact ${year}, mentions Purdue` };
      }
      if (hasHighSchoolKeyword) {
        return { category: 'high-school', reason: `First contact ${year}, mentions high school` };
      }
      return { category: null, reason: `First contact in ${year} (post-college, no clear affiliation)` };
    }
  }

  // Fallback to keyword analysis if no date
  if (hasPurdueKeyword && !hasHighSchoolKeyword) {
    return { category: 'purdue', reason: 'Message content mentions Purdue topics' };
  }
  if (hasHighSchoolKeyword && !hasPurdueKeyword) {
    return { category: 'high-school', reason: 'Message content mentions high school topics' };
  }

  return { category: null, reason: 'Could not determine category from messages' };
}

function findDuplicates(
  contacts: UncategorizedContact[]
): Map<string, UncategorizedContact[]> {
  const duplicates = new Map<string, UncategorizedContact[]>();

  // Group by normalized identifier
  const byIdentifier = new Map<string, UncategorizedContact[]>();

  for (const contact of contacts) {
    // Normalize phone numbers
    let normalized = contact.identifier;
    if (!contact.identifier.includes('@')) {
      normalized = contact.identifier.replace(/\D/g, '');
      if (normalized.length === 11 && normalized.startsWith('1')) {
        normalized = normalized.slice(1);
      }
    } else {
      normalized = contact.identifier.toLowerCase();
    }

    const existing = byIdentifier.get(normalized) || [];
    existing.push(contact);
    byIdentifier.set(normalized, existing);
  }

  // Find groups with more than one contact
  for (const [identifier, group] of byIdentifier) {
    if (group.length > 1) {
      duplicates.set(identifier, group);
    }
  }

  return duplicates;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const chatDb = new Database(CHAT_DB_PATH, { readonly: true });

  console.log('Fetching uncategorized contacts from Neon...');

  // Get all uncategorized contacts
  const uncategorized = await sql`
    SELECT id, identifier, display_name, custom_name
    FROM contacts
    WHERE category_id = 'uncategorized'
  ` as UncategorizedContact[];

  console.log(`Found ${uncategorized.length} uncategorized contacts\n`);

  // Analyze and categorize
  let categorizedCount = 0;
  const categorizations: { id: string; category: string; name: string; reason: string }[] = [];

  for (const contact of uncategorized) {
    const messages = getRecentMessages(chatDb, contact.identifier);
    const firstDate = getFirstMessageDate(chatDb, contact.identifier);
    const { category, reason } = analyzeMessages(messages, firstDate);

    if (category) {
      categorizations.push({
        id: contact.id,
        category,
        name: contact.custom_name || contact.display_name || contact.identifier,
        reason,
      });
      categorizedCount++;
    }
  }

  // Update categories in database
  console.log(`\nCategorizing ${categorizedCount} contacts...\n`);

  const purdueContacts = categorizations.filter((c) => c.category === 'purdue');
  const hsContacts = categorizations.filter((c) => c.category === 'high-school');

  console.log(`Purdue (${purdueContacts.length}):`);
  for (const c of purdueContacts.slice(0, 10)) {
    console.log(`  - ${c.name}: ${c.reason}`);
    await sql`UPDATE contacts SET category_id = 'purdue', updated_at = NOW() WHERE id = ${c.id}`;
  }
  if (purdueContacts.length > 10) {
    console.log(`  ... and ${purdueContacts.length - 10} more`);
    for (const c of purdueContacts.slice(10)) {
      await sql`UPDATE contacts SET category_id = 'purdue', updated_at = NOW() WHERE id = ${c.id}`;
    }
  }

  console.log(`\nHigh School (${hsContacts.length}):`);
  for (const c of hsContacts.slice(0, 10)) {
    console.log(`  - ${c.name}: ${c.reason}`);
    await sql`UPDATE contacts SET category_id = 'high-school', updated_at = NOW() WHERE id = ${c.id}`;
  }
  if (hsContacts.length > 10) {
    console.log(`  ... and ${hsContacts.length - 10} more`);
    for (const c of hsContacts.slice(10)) {
      await sql`UPDATE contacts SET category_id = 'high-school', updated_at = NOW() WHERE id = ${c.id}`;
    }
  }

  // Find and archive duplicates
  console.log('\n\nLooking for duplicate contacts...');
  const duplicates = findDuplicates(uncategorized);

  if (duplicates.size > 0) {
    console.log(`Found ${duplicates.size} groups of duplicate contacts:`);
    let archivedCount = 0;

    for (const [identifier, group] of duplicates) {
      // Keep the one with the most complete info, archive the rest
      const sorted = group.sort((a, b) => {
        // Prefer ones with display names
        const aHasName = a.custom_name || a.display_name ? 1 : 0;
        const bHasName = b.custom_name || b.display_name ? 1 : 0;
        return bHasName - aHasName;
      });

      const keep = sorted[0];
      const toArchive = sorted.slice(1);

      console.log(`  ${identifier}: keeping "${keep.custom_name || keep.display_name || keep.identifier}"`);

      for (const dup of toArchive) {
        console.log(`    - archiving "${dup.custom_name || dup.display_name || dup.identifier}"`);
        await sql`UPDATE contacts SET category_id = 'archived', updated_at = NOW() WHERE id = ${dup.id}`;
        archivedCount++;
      }
    }

    console.log(`\nArchived ${archivedCount} duplicate contacts`);
  } else {
    console.log('No duplicate contacts found');
  }

  chatDb.close();

  console.log('\n✅ Analysis complete!');
  console.log(`  - Categorized ${purdueContacts.length} as Purdue`);
  console.log(`  - Categorized ${hsContacts.length} as High School`);
}

main().catch(console.error);
