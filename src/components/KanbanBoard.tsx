'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { ContactWithCategory, Category } from '@/lib/types';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import CategoryColumn from './CategoryColumn';
import ContactCard from './ContactCard';
import ContactModal from './ContactModal';
import SearchBar from './SearchBar';

export default function KanbanBoard() {
  const [contacts, setContacts] = useState<ContactWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactWithCategory | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'contact' | 'column' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'messageCount' | 'lastMessage' | 'name'>('messageCount');
  const [showArchived, setShowArchived] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('uncategorized');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchSettings();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/contacts');
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.category_order) {
          setCategoryOrder(data.category_order);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const saveCategoryOrder = async (order: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryOrder: order }),
      });
    } catch (err) {
      console.error('Failed to save category order:', err);
    }
  };

  const updateContactCategory = async (contactId: string, categoryId: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, categoryId } : c))
    );

    try {
      await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, categoryId }),
      });
    } catch (err) {
      console.error('Failed to update category:', err);
      fetchContacts();
    }
  };

  const updateContact = async (
    contactId: string,
    updates: { notes?: string; customName?: string | null; categoryId?: string }
  ) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              notes: updates.notes ?? c.notes,
              customName: updates.customName ?? c.customName,
              categoryId: updates.categoryId ?? c.categoryId,
            }
          : c
      )
    );

    try {
      await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, ...updates }),
      });
    } catch (err) {
      console.error('Failed to update contact:', err);
      fetchContacts();
    }
  };

  const filteredContacts = useMemo(() => {
    let result = contacts;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.identifier.toLowerCase().includes(query) ||
          c.customName?.toLowerCase().includes(query) ||
          c.displayName?.toLowerCase().includes(query) ||
          c.notes?.toLowerCase().includes(query)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'messageCount':
          return b.messageCount - a.messageCount;
        case 'lastMessage':
          if (!a.lastMessageDate) return 1;
          if (!b.lastMessageDate) return -1;
          return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
        case 'name':
          const nameA = (a.customName || a.displayName || a.identifier).toLowerCase();
          const nameB = (b.customName || b.displayName || b.identifier).toLowerCase();
          return nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });

    return result;
  }, [contacts, searchQuery, sortBy]);

  const orderedCategories = useMemo(() => {
    let cats = showArchived
      ? DEFAULT_CATEGORIES
      : DEFAULT_CATEGORIES.filter((c) => c.id !== 'archived');

    if (categoryOrder.length > 0) {
      cats = [...cats].sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a.id);
        const bIndex = categoryOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }

    return cats;
  }, [showArchived, categoryOrder]);

  const contactsByCategory = useMemo(() => {
    const result: Record<string, ContactWithCategory[]> = {};
    orderedCategories.forEach((cat) => {
      result[cat.id] = filteredContacts.filter((c) => c.categoryId === cat.id);
    });
    return result;
  }, [filteredContacts, orderedCategories]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);

    if (orderedCategories.find((c) => c.id === id)) {
      setActiveType('column');
    } else {
      setActiveType('contact');
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (activeType !== 'contact') return;

    const { active, over } = event;
    if (!over) return;

    const activeContact = contacts.find((c) => c.id === active.id);
    if (!activeContact) return;

    const overId = over.id as string;

    const overCategory = orderedCategories.find((c) => c.id === overId);
    if (overCategory && activeContact.categoryId !== overCategory.id) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === activeContact.id ? { ...c, categoryId: overCategory.id } : c
        )
      );
    }

    const overContact = contacts.find((c) => c.id === overId);
    if (overContact && activeContact.categoryId !== overContact.categoryId) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === activeContact.id ? { ...c, categoryId: overContact.categoryId } : c
        )
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (activeType === 'column' && over) {
      const oldIndex = orderedCategories.findIndex((c) => c.id === active.id);
      const newIndex = orderedCategories.findIndex((c) => c.id === over.id);

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(
          orderedCategories.map((c) => c.id),
          oldIndex,
          newIndex
        );
        setCategoryOrder(newOrder);
        saveCategoryOrder(newOrder);
      }
    } else if (activeType === 'contact' && over) {
      const activeContact = contacts.find((c) => c.id === active.id);
      if (activeContact) {
        updateContactCategory(activeContact.id, activeContact.categoryId);
      }
    }

    setActiveId(null);
    setActiveType(null);
  };

  const handleArchive = (contactId: string) => {
    updateContactCategory(contactId, 'archived');
  };

  const activeContact = activeType === 'contact' && activeId
    ? contacts.find((c) => c.id === activeId)
    : null;

  const activeCategory = activeType === 'column' && activeId
    ? orderedCategories.find((c) => c.id === activeId)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <div className="text-red-500 text-center">{error}</div>
        <p className="text-gray-500 text-sm text-center">
          Make sure your Supabase database is set up and contacts are uploaded.
        </p>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <div className="text-gray-500">No contacts found</div>
        <p className="text-gray-400 text-sm text-center">
          Run the extract and upload scripts to import your contacts.
        </p>
      </div>
    );
  }

  // Mobile view - show one category at a time
  if (isMobile) {
    const currentCategory = orderedCategories.find((c) => c.id === selectedCategoryId) || orderedCategories[0];
    const currentContacts = contactsByCategory[currentCategory.id] || [];

    return (
      <div className="px-4">
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
        />

        <div className="mb-4">
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-lg font-medium"
            style={{ backgroundColor: currentCategory.color + '20' }}
          >
            {orderedCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({contactsByCategory[cat.id]?.length || 0})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {currentContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={`
                bg-white rounded-lg shadow-sm border border-gray-200 p-4
                ${contact.isSavedContact ? 'border-l-4 border-l-green-400' : ''}
              `}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {contact.customName || contact.displayName || contact.identifier}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {contact.identifier}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                    {contact.messageCount} msgs
                  </span>
                  {contact.categoryId !== 'archived' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(contact.id);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {contact.notes && (
                <div className="text-xs text-gray-400 mt-2 truncate italic">
                  {contact.notes}
                </div>
              )}
            </div>
          ))}
          {currentContacts.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              No contacts in this category
            </div>
          )}
        </div>

        <ContactModal
          contact={selectedContact}
          categories={orderedCategories}
          onClose={() => setSelectedContact(null)}
          onSave={updateContact}
        />
      </div>
    );
  }

  // Desktop view - full Kanban board
  return (
    <div>
      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      <p className="text-xs text-gray-400 mb-2">Tip: Drag columns to reorder them</p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedCategories.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {orderedCategories.map((category) => (
              <CategoryColumn
                key={category.id}
                category={category}
                contacts={contactsByCategory[category.id] || []}
                onContactClick={setSelectedContact}
                onArchive={handleArchive}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        }}>
          <AnimatePresence>
            {activeContact && (
              <motion.div
                initial={{ scale: 1, rotate: 0, opacity: 0.8 }}
                animate={{ scale: 1.03, rotate: 2, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                className="shadow-2xl"
              >
                <ContactCard contact={activeContact} onClick={() => {}} onArchive={() => {}} />
              </motion.div>
            )}
            {activeCategory && (
              <motion.div
                initial={{ scale: 1, rotate: 0, opacity: 0.8 }}
                animate={{ scale: 1.02, rotate: 2, opacity: 0.95 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                className="bg-gray-50 rounded-xl min-w-[300px] p-4 shadow-2xl border border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: activeCategory.color }}
                  />
                  <span className="font-semibold text-gray-800">{activeCategory.name}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DragOverlay>
      </DndContext>

      <ContactModal
        contact={selectedContact}
        categories={orderedCategories}
        onClose={() => setSelectedContact(null)}
        onSave={updateContact}
      />
    </div>
  );
}
