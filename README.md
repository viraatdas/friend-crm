# Friend CRM

Keep track of your friends to prioritize who you should be spending more time with.

A Next.js app that reads your iMessage contacts and lets you categorize them on a Kanban-style board with drag-and-drop. Add notes, rename contacts, and organize your relationships.

## Features

- Import contacts from iMessage
- Drag-and-drop Kanban board
- Six categories: Uncategorized, High Yielding, Spend More Time, Get to Know, Not High Yielding, Archived
- Add notes and custom names to contacts
- Search and filter contacts
- Sort by message count, last message, or name

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Grant Full Disk Access to your terminal app (System Preferences > Security & Privacy > Privacy > Full Disk Access)

3. Extract your iMessage contacts:
   ```bash
   npm run extract
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Data Storage

- `data/contacts.json` - Extracted contact data from iMessage (gitignored)
- `data/user-data.json` - Your categories, notes, and custom names (gitignored)

## Categories

- **Uncategorized** - New contacts not yet sorted
- **High Yielding** - Close friends, high value relationships
- **Spend More Time** - People you want to connect with more
- **Get to Know** - New/recent contacts to explore
- **Not High Yielding** - Acquaintances, low priority
- **Archived** - Hidden from main view
