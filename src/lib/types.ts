export interface Contact {
  id: string;
  identifier: string; // phone number or email
  displayName: string | null;
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  lastMessageDate: string | null;
  isSavedContact: boolean;
}

export interface ContactWithCategory extends Contact {
  categoryId: string;
  notes: string;
  customName: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface UserData {
  contacts: {
    [contactId: string]: {
      categoryId: string;
      notes: string;
      customName: string | null;
    };
  };
  categoryOrder: string[];
}

export interface ExtractedContact {
  id: string;
  identifier: string;
  displayName: string | null;
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  lastMessageDate: string | null;
  isSavedContact: boolean;
}
