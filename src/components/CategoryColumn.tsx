'use client';

import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Category, ContactWithCategory } from '@/lib/types';
import ContactCard from './ContactCard';

interface CategoryColumnProps {
  category: Category;
  contacts: ContactWithCategory[];
  onContactClick: (contact: ContactWithCategory) => void;
  onArchive: (contactId: string) => void;
}

export default function CategoryColumn({
  category,
  contacts,
  onContactClick,
  onArchive,
}: CategoryColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: category.id,
  });

  // Use CSS transform directly for smoother column dragging
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: isDragging ? 'none' : 'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`
        flex flex-col bg-gray-50 rounded-xl min-w-[280px] sm:min-w-[300px] max-w-[280px] sm:max-w-[300px]
        transition-shadow duration-200
        ${isOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
        ${isDragging ? 'shadow-2xl scale-[1.02] rotate-1 opacity-95' : 'shadow-sm'}
      `}
    >
      <div
        {...attributes}
        {...listeners}
        className="p-3 rounded-t-xl flex items-center justify-between cursor-grab active:cursor-grabbing select-none transition-colors duration-150 hover:brightness-95"
        style={{ backgroundColor: category.color + '25' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full transition-transform duration-150 hover:scale-125"
            style={{ backgroundColor: category.color }}
          />
          <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{category.name}</h3>
        </div>
        <span className="text-xs sm:text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">
          {contacts.length}
        </span>
      </div>

      <div
        ref={setDroppableRef}
        className={`
          flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)] min-h-[80px]
          transition-colors duration-150
          ${isOver ? 'bg-blue-50/30' : ''}
        `}
      >
        <LayoutGroup>
          <SortableContext
            items={contacts.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onClick={() => onContactClick(contact)}
                  onArchive={onArchive}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </LayoutGroup>
        {contacts.length === 0 && (
          <div className="text-center text-gray-400 text-xs sm:text-sm py-6 sm:py-8">
            Drag contacts here
          </div>
        )}
      </div>
    </div>
  );
}
