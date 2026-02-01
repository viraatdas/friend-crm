import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface RawMessageStats {
  handle_id: number;
  identifier: string;
  total_messages: number;
  sent_messages: number;
  received_messages: number;
  last_message_date: number | null;
}

interface ContactInfo {
  firstName: string | null;
  lastName: string | null;
}

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

const CHAT_DB_PATH = path.join(os.homedir(), 'Library/Messages/chat.db');
const OUTPUT_PATH = path.join(process.cwd(), 'data/contacts.json');

// Find the AddressBook database with actual data
function findAddressBookPath(): string | null {
  const basePath = path.join(os.homedir(), 'Library/Application Support/AddressBook');
  const sourcesPath = path.join(basePath, 'Sources');

  if (fs.existsSync(sourcesPath)) {
    const sources = fs.readdirSync(sourcesPath);
    for (const source of sources) {
      const dbPath = path.join(sourcesPath, source, 'AddressBook-v22.abcddb');
      if (fs.existsSync(dbPath)) {
        return dbPath;
      }
    }
  }

  const mainPath = path.join(basePath, 'AddressBook-v22.abcddb');
  if (fs.existsSync(mainPath)) {
    return mainPath;
  }

  return null;
}

function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');

  // For US numbers, normalize to 10 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+1' + digits.slice(1);
  }
  if (digits.length === 10) {
    return '+1' + digits;
  }

  return hasPlus ? '+' + digits : digits;
}

function loadSavedContacts(): Map<string, ContactInfo> {
  const contacts = new Map<string, ContactInfo>();

  const addressBookPath = findAddressBookPath();
  if (!addressBookPath) {
    console.log('Warning: Could not find AddressBook database');
    return contacts;
  }

  console.log(`Loading contacts from: ${addressBookPath}`);

  try {
    const db = new Database(addressBookPath, { readonly: true });

    // Load phone numbers with names
    const phoneQuery = `
      SELECT
        p.ZFULLNUMBER as phone,
        r.ZFIRSTNAME as firstName,
        r.ZLASTNAME as lastName
      FROM ZABCDPHONENUMBER p
      JOIN ZABCDRECORD r ON p.ZOWNER = r.Z_PK
      WHERE p.ZFULLNUMBER IS NOT NULL
    `;

    const phoneRows = db.prepare(phoneQuery).all() as { phone: string; firstName: string | null; lastName: string | null }[];

    for (const row of phoneRows) {
      const normalized = normalizePhoneNumber(row.phone);
      contacts.set(normalized, { firstName: row.firstName, lastName: row.lastName });
      // Also store with original format for email-style lookups
      contacts.set(row.phone, { firstName: row.firstName, lastName: row.lastName });
    }

    // Load email addresses with names
    const emailQuery = `
      SELECT
        e.ZADDRESSNORMALIZED as email,
        r.ZFIRSTNAME as firstName,
        r.ZLASTNAME as lastName
      FROM ZABCDEMAILADDRESS e
      JOIN ZABCDRECORD r ON e.ZOWNER = r.Z_PK
      WHERE e.ZADDRESSNORMALIZED IS NOT NULL
    `;

    const emailRows = db.prepare(emailQuery).all() as { email: string; firstName: string | null; lastName: string | null }[];

    for (const row of emailRows) {
      contacts.set(row.email.toLowerCase(), { firstName: row.firstName, lastName: row.lastName });
    }

    db.close();
    console.log(`Loaded ${contacts.size} saved contact identifiers`);
  } catch (error) {
    console.error('Error loading contacts:', error);
  }

  return contacts;
}

function convertAppleTimestamp(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const appleEpoch = new Date('2001-01-01T00:00:00Z').getTime();
  const milliseconds = timestamp / 1_000_000 + appleEpoch;
  return new Date(milliseconds).toISOString();
}

function isShortCode(identifier: string): boolean {
  // Short codes are typically 5-6 digit numbers
  const digits = identifier.replace(/\D/g, '');
  return /^\d{5,6}$/.test(digits);
}

function looksLikeBusinessOrBot(identifier: string, stats: RawMessageStats): boolean {
  // Short codes are usually businesses
  if (isShortCode(identifier)) return true;

  // If we only received messages and never sent any, likely a notification service
  if (stats.sent_messages === 0 && stats.received_messages > 0) return true;

  // Numbers with very low engagement ratio (mostly receiving)
  const total = stats.sent_messages + stats.received_messages;
  if (total > 10 && stats.sent_messages / total < 0.05) return true;

  return false;
}

function formatDisplayName(info: ContactInfo | undefined): string | null {
  if (!info) return null;

  const parts = [info.firstName, info.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function extractContacts(): ExtractedContact[] {
  console.log(`Opening iMessage database at: ${CHAT_DB_PATH}`);

  if (!fs.existsSync(CHAT_DB_PATH)) {
    console.error('Error: iMessage database not found at', CHAT_DB_PATH);
    console.error('Make sure you have granted Full Disk Access to your terminal app.');
    process.exit(1);
  }

  // Load saved contacts first
  const savedContacts = loadSavedContacts();

  const db = new Database(CHAT_DB_PATH, { readonly: true });

  // Get message stats per handle, including sent vs received counts
  const query = `
    SELECT
      h.ROWID as handle_id,
      h.id as identifier,
      COUNT(m.ROWID) as total_messages,
      SUM(CASE WHEN m.is_from_me = 1 THEN 1 ELSE 0 END) as sent_messages,
      SUM(CASE WHEN m.is_from_me = 0 THEN 1 ELSE 0 END) as received_messages,
      MAX(m.date) as last_message_date
    FROM handle h
    LEFT JOIN message m ON m.handle_id = h.ROWID
    GROUP BY h.ROWID
    ORDER BY total_messages DESC
  `;

  const rows = db.prepare(query).all() as RawMessageStats[];
  db.close();

  const contacts: ExtractedContact[] = [];
  let skippedShortCodes = 0;
  let skippedBots = 0;
  let skippedLowActivity = 0;

  for (const row of rows) {
    const identifier = row.identifier;
    const normalizedId = identifier.includes('@')
      ? identifier.toLowerCase()
      : normalizePhoneNumber(identifier);

    // Check if this is a saved contact
    const contactInfo = savedContacts.get(normalizedId) || savedContacts.get(identifier);
    const isSavedContact = !!contactInfo;

    // Skip short codes
    if (isShortCode(identifier)) {
      skippedShortCodes++;
      continue;
    }

    // For non-saved contacts, apply stricter filtering
    if (!isSavedContact) {
      // Skip if it looks like a bot/business
      if (looksLikeBusinessOrBot(identifier, row)) {
        skippedBots++;
        continue;
      }

      // Skip if very low message count and no two-way conversation
      if (row.total_messages < 3 || (row.sent_messages === 0 || row.received_messages === 0)) {
        skippedLowActivity++;
        continue;
      }
    }

    contacts.push({
      id: `contact-${row.handle_id}`,
      identifier: row.identifier,
      displayName: formatDisplayName(contactInfo),
      messageCount: row.total_messages,
      sentCount: row.sent_messages,
      receivedCount: row.received_messages,
      lastMessageDate: convertAppleTimestamp(row.last_message_date),
      isSavedContact,
    });
  }

  console.log(`\nFiltering summary:`);
  console.log(`  - Skipped ${skippedShortCodes} short codes (business SMS)`);
  console.log(`  - Skipped ${skippedBots} likely bots/businesses`);
  console.log(`  - Skipped ${skippedLowActivity} low-activity non-contacts`);

  return contacts;
}

function main() {
  console.log('Extracting contacts from iMessage database...\n');

  const contacts = extractContacts();

  // Ensure data directory exists
  const dataDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(contacts, null, 2));

  const savedCount = contacts.filter(c => c.isSavedContact).length;
  const unsavedCount = contacts.filter(c => !c.isSavedContact).length;

  console.log(`\nExtracted ${contacts.length} contacts to ${OUTPUT_PATH}`);
  console.log(`  - ${savedCount} saved contacts (from Address Book)`);
  console.log(`  - ${unsavedCount} unsaved but active contacts`);

  console.log(`\nTop 10 contacts by message count:`);
  contacts.slice(0, 10).forEach((c, i) => {
    const name = c.displayName || c.identifier;
    const saved = c.isSavedContact ? '✓' : ' ';
    console.log(`  ${i + 1}. [${saved}] ${name}: ${c.messageCount} msgs (↑${c.sentCount} ↓${c.receivedCount})`);
  });
}

main();
