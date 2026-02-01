'use client';

import { useState, useEffect } from 'react';
import { ContactWithCategory, Category } from '@/lib/types';

interface ContactModalProps {
  contact: ContactWithCategory | null;
  categories: Category[];
  onClose: () => void;
  onSave: (contactId: string, updates: { notes?: string; customName?: string | null; categoryId?: string }) => void;
}

export default function ContactModal({
  contact,
  categories,
  onClose,
  onSave,
}: ContactModalProps) {
  const [notes, setNotes] = useState('');
  const [customName, setCustomName] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (contact) {
      setNotes(contact.notes || '');
      setCustomName(contact.customName || '');
      setCategoryId(contact.categoryId);
    }
  }, [contact]);

  if (!contact) return null;

  const handleSave = () => {
    onSave(contact.id, {
      notes,
      customName: customName || null,
      categoryId,
    });
    onClose();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {contact.customName || contact.displayName || contact.identifier}
              </h2>
              <p className="text-sm text-gray-500">{contact.identifier}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div className="bg-gray-100 rounded-lg px-3 py-2">
                <div className="text-gray-500">Messages</div>
                <div className="font-semibold">{contact.messageCount}</div>
              </div>
              <div className="bg-gray-100 rounded-lg px-3 py-2">
                <div className="text-gray-500">Last Message</div>
                <div className="font-semibold">{formatDate(contact.lastMessageDate)}</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={contact.identifier}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this contact..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
