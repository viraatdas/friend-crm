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

interface MessageStats {
  firstDate: Date | null;
  lastDate: Date | null;
  totalMessages: number;
  messagesByYear: Map<number, number>;
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

function getMessageStats(db: Database.Database, identifier: string): MessageStats {
  const query = `
    SELECT m.date
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE h.id = ?
      AND m.date IS NOT NULL
    ORDER BY m.date ASC
  `;

  const rows = db.prepare(query).all(identifier) as { date: number }[];

  const messagesByYear = new Map<number, number>();
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  for (const row of rows) {
    const date = convertAppleTimestamp(row.date);
    const year = date.getFullYear();

    if (!firstDate) firstDate = date;
    lastDate = date;

    messagesByYear.set(year, (messagesByYear.get(year) || 0) + 1);
  }

  return {
    firstDate,
    lastDate,
    totalMessages: rows.length,
    messagesByYear,
  };
}

function analyzeContact(
  messages: MessageInfo[],
  stats: MessageStats
): { category: string | null; reason: string } {
  if (stats.totalMessages === 0) {
    return { category: null, reason: 'No messages found' };
  }

  const textContent = messages.map((m) => m.text.toLowerCase()).join(' ');

  // Keywords that suggest Purdue/college context
  const purdueKeywords = [
    'purdue', 'boiler', 'west lafayette', 'campus', 'dorm', 'professor',
    'exam', 'midterm', 'final', 'homework', 'study', 'library', 'lecture',
    'corec', 'pmu', 'walc', 'rawls', 'krannert', 'neil armstrong',
    'cs ', 'engineering', 'major', 'freshman', 'sophomore', 'junior', 'senior',
    'internship', 'career fair', 'frat', 'sorority', 'rush', 'chauncey'
  ];

  // Keywords that suggest high school context
  const highSchoolKeywords = [
    'high school', 'homecoming', 'prom', 'sat', 'act', 'college app',
    'senior year', 'junior year', 'ap class', 'varsity',
    'jv', 'grounded', 'monta vista', 'mvhs', 'cupertino'
  ];

  // Check for keyword matches
  const hasPurdueKeyword = purdueKeywords.some((kw) => textContent.includes(kw));
  const hasHighSchoolKeyword = highSchoolKeywords.some((kw) => textContent.includes(kw));

  const firstYear = stats.firstDate?.getFullYear();

  // Calculate message concentration in different eras
  let hsMessages = 0;  // Before 2018
  let collegeMessages = 0;  // 2018-2020
  let postCollegeMessages = 0;  // After 2020

  for (const [year, count] of stats.messagesByYear) {
    if (year < HIGH_SCHOOL_GRAD_YEAR) {
      hsMessages += count;
    } else if (year >= HIGH_SCHOOL_GRAD_YEAR && year <= COLLEGE_GRAD_YEAR) {
      collegeMessages += count;
    } else {
      postCollegeMessages += count;
    }
  }

  const total = stats.totalMessages;
  const hsRatio = hsMessages / total;
  const collegeRatio = collegeMessages / total;
  const postCollegeRatio = postCollegeMessages / total;

  // Strong keyword signals override everything
  if (hasPurdueKeyword && !hasHighSchoolKeyword) {
    return { category: 'purdue', reason: 'Message content mentions Purdue topics' };
  }
  if (hasHighSchoolKeyword && !hasPurdueKeyword) {
    return { category: 'high-school', reason: 'Message content mentions high school topics' };
  }

  // First contact date analysis
  if (firstYear) {
    // Clear high school era contact
    if (firstYear < HIGH_SCHOOL_GRAD_YEAR) {
      // If mostly HS-era messages, it's a HS friend
      if (hsRatio > 0.3 || (collegeRatio < 0.5 && postCollegeRatio < 0.5)) {
        return { category: 'high-school', reason: `First contact ${firstYear}, ${Math.round(hsRatio * 100)}% HS-era msgs` };
      }
      // If they kept messaging through college, could be either
      if (collegeRatio > 0.4) {
        return { category: 'purdue', reason: `First contact ${firstYear}, but ${Math.round(collegeRatio * 100)}% college-era msgs` };
      }
      return { category: 'high-school', reason: `First contact ${firstYear} (before HS graduation)` };
    }

    // Clear college era contact
    if (firstYear >= HIGH_SCHOOL_GRAD_YEAR && firstYear <= COLLEGE_GRAD_YEAR) {
      return { category: 'purdue', reason: `First contact ${firstYear} (during college)` };
    }

    // Post-college contact - check if they have any college-era history
    if (firstYear > COLLEGE_GRAD_YEAR) {
      if (collegeRatio > 0.2) {
        return { category: 'purdue', reason: `First msg ${firstYear}, but ${Math.round(collegeRatio * 100)}% college-era msgs` };
      }
      // These are genuinely post-college contacts, leave uncategorized
      return { category: null, reason: `First contact ${firstYear} (post-college, no school affiliation)` };
    }
  }

  return { category: null, reason: 'Could not determine category from messages' };
}

function findDuplicates(
  contacts: UncategorizedContact[]
): Map<string, UncategorizedContact[]> {
  const duplicates = new Map<string, UncategorizedContact[]>();
  const byIdentifier = new Map<string, UncategorizedContact[]>();

  for (const contact of contacts) {
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

  const uncategorized = await sql`
    SELECT id, identifier, display_name, custom_name
    FROM contacts
    WHERE category_id = 'uncategorized'
  ` as UncategorizedContact[];

  console.log(`Found ${uncategorized.length} uncategorized contacts\n`);

  const categorizations: { id: string; category: string; name: string; reason: string }[] = [];
  let skipped = 0;

  for (const contact of uncategorized) {
    // Skip business/bot identifiers
    if (contact.identifier.includes('urn:biz:') ||
        contact.identifier.includes('p:') ||
        /^\d{5,6}$/.test(contact.identifier.replace(/\D/g, ''))) {
      skipped++;
      continue;
    }

    const messages = getRecentMessages(chatDb, contact.identifier);
    const stats = getMessageStats(chatDb, contact.identifier);
    const { category, reason } = analyzeContact(messages, stats);

    if (category) {
      categorizations.push({
        id: contact.id,
        category,
        name: contact.custom_name || contact.display_name || contact.identifier,
        reason,
      });
    }
  }

  console.log(`Skipped ${skipped} business/bot identifiers\n`);

  const purdueContacts = categorizations.filter((c) => c.category === 'purdue');
  const hsContacts = categorizations.filter((c) => c.category === 'high-school');

  console.log(`Categorizing ${categorizations.length} contacts...\n`);

  console.log(`Purdue (${purdueContacts.length}):`);
  for (const c of purdueContacts.slice(0, 15)) {
    console.log(`  - ${c.name}: ${c.reason}`);
  }
  if (purdueContacts.length > 15) {
    console.log(`  ... and ${purdueContacts.length - 15} more`);
  }

  // Update Purdue contacts
  for (const c of purdueContacts) {
    await sql`UPDATE contacts SET category_id = 'purdue', updated_at = NOW() WHERE id = ${c.id}`;
  }

  console.log(`\nHigh School (${hsContacts.length}):`);
  for (const c of hsContacts.slice(0, 15)) {
    console.log(`  - ${c.name}: ${c.reason}`);
  }
  if (hsContacts.length > 15) {
    console.log(`  ... and ${hsContacts.length - 15} more`);
  }

  // Update High School contacts
  for (const c of hsContacts) {
    await sql`UPDATE contacts SET category_id = 'high-school', updated_at = NOW() WHERE id = ${c.id}`;
  }

  // Find and archive duplicates
  console.log('\n\nLooking for duplicate contacts...');
  const duplicates = findDuplicates(uncategorized);

  if (duplicates.size > 0) {
    console.log(`Found ${duplicates.size} groups of duplicate contacts`);
    let archivedCount = 0;

    for (const [, group] of duplicates) {
      const sorted = group.sort((a, b) => {
        const aHasName = a.custom_name || a.display_name ? 1 : 0;
        const bHasName = b.custom_name || b.display_name ? 1 : 0;
        return bHasName - aHasName;
      });

      const toArchive = sorted.slice(1);
      for (const dup of toArchive) {
        await sql`UPDATE contacts SET category_id = 'archived', updated_at = NOW() WHERE id = ${dup.id}`;
        archivedCount++;
      }
    }

    console.log(`Archived ${archivedCount} duplicate contacts`);
  } else {
    console.log('No duplicate contacts found');
  }

  chatDb.close();

  // Get final counts
  const finalCounts = await sql`
    SELECT category_id, COUNT(*) as count
    FROM contacts
    GROUP BY category_id
    ORDER BY count DESC
  `;

  console.log('\n✅ Analysis complete!\n');
  console.log('Final category counts:');
  for (const row of finalCounts) {
    console.log(`  ${row.category_id}: ${row.count}`);
  }
}

main().catch(console.error);
