import KanbanBoard from '@/components/KanbanBoard';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-full mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Friend CRM</h1>
          <p className="text-sm text-gray-500">Organize your relationships</p>
        </div>
      </header>

      <main className="p-6">
        <KanbanBoard />
      </main>
    </div>
  );
}
