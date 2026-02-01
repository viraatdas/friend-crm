'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { ContactWithCategory } from '@/lib/types';

interface ContactCardProps {
  contact: ContactWithCategory;
  onClick: () => void;
  onArchive: (contactId: string) => void;
}

export default function ContactCard({ contact, onClick, onArchive }: ContactCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: contact.id,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = contact.customName || contact.displayName || contact.identifier;

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive(contact.id);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      layout
      layoutId={contact.id}
      initial={false}
      animate={{
        scale: isDragging ? 1.05 : 1,
        opacity: isDragging ? 1 : 1,
        backgroundColor: isDragging ? '#EEF2FF' : '#FFFFFF',
        borderColor: isDragging ? '#6366F1' : '#E5E7EB',
      }}
      transition={{
        layout: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
        scale: { duration: 0.15 },
        backgroundColor: { duration: 0.15 },
        borderColor: { duration: 0.15 },
      }}
      whileHover={{ scale: 1.01, backgroundColor: '#F9FAFB' }}
      whileTap={{ scale: 0.98 }}
      className={`
        rounded-lg border-2 p-3 cursor-grab active:cursor-grabbing
        group relative select-none
        ${isDragging ? 'z-50 shadow-xl ring-2 ring-indigo-400' : 'shadow-sm'}
        ${contact.isSavedContact ? 'border-l-4 border-l-green-400' : ''}
      `}
    >
      {contact.categoryId !== 'archived' && (
        <button
          onClick={handleArchive}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
          title="Archive contact"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
      )}
      <div className="font-medium text-gray-900 truncate flex items-center gap-1 pr-6">
        {displayName}
        {contact.isSavedContact && (
          <span className="text-green-500 text-xs" title="Saved contact">●</span>
        )}
      </div>
      <div className="text-sm text-gray-500 mt-1 flex items-center justify-between">
        <span className="truncate text-xs">
          {contact.identifier !== displayName && contact.identifier}
        </span>
        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
          {contact.messageCount} msgs
        </span>
      </div>
      {contact.notes && (
        <div className="text-xs text-gray-400 mt-2 truncate italic">
          {contact.notes}
        </div>
      )}
    </motion.div>
  );
}
