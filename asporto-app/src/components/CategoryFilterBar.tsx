import { useState } from 'react';
import { Edit3, Trash2, ChevronUp, ChevronDown, Plus, PenLine } from 'lucide-react';

interface Props {
  allCategories: string[];
  activeCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  onCategoryRename: (oldName: string, newName: string) => void;
  onCategoryDelete: (cat: string) => void;
  onCategoryMoveUp: (cat: string) => void;
  onCategoryMoveDown: (cat: string) => void;
  onCategoryAdd: (name: string) => void;
  isEmbedded: boolean;
}

export default function CategoryFilterBar({
  allCategories, activeCategory, onCategoryChange,
  onCategoryRename, onCategoryDelete, onCategoryMoveUp, onCategoryMoveDown,
  onCategoryAdd, isEmbedded,
}: Props) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryDraft, setEditCategoryDraft] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="flex gap-2 overflow-x-auto pb-4 mb-6 hide-scrollbar">
      <button
        onClick={() => onCategoryChange(null)}
        className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
          !activeCategory
            ? isEmbedded
              ? 'bg-gold text-black'
              : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
            : isEmbedded
              ? 'bg-surface text-gray-500 hover:text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        Tutte
      </button>
      {allCategories.map(cat => (
        <div key={cat} className="shrink-0 flex items-center gap-0.5">
          <button
            onClick={() => onCategoryChange(activeCategory === cat ? null : cat)}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              activeCategory === cat
                ? isEmbedded
                  ? 'bg-gold text-black'
                  : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : isEmbedded
                  ? 'bg-surface text-gray-500 hover:text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {editingCategory === cat ? (
              <input
                type="text"
                value={editCategoryDraft}
                onChange={e => setEditCategoryDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && editCategoryDraft.trim() && editCategoryDraft.trim() !== cat) {
                    onCategoryRename(cat, editCategoryDraft.trim());
                    setEditingCategory(null);
                  }
                  if (e.key === 'Escape') setEditingCategory(null);
                }}
                onBlur={() => setEditingCategory(null)}
                className="w-20 bg-transparent text-white border-b border-current outline-none text-sm"
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              cat
            )}
          </button>
          {editMode && editingCategory !== cat && (
            <div className="inline-flex items-center gap-0.5 ml-1">
              <button
                onClick={e => { e.stopPropagation(); setEditingCategory(cat); setEditCategoryDraft(cat); }}
                className={`p-1 rounded ${isEmbedded ? 'hover:bg-charcoal text-gray-400' : 'hover:bg-slate-700 text-slate-400'} transition-all`}
                title="Rinomina"
              >
                <Edit3 size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onCategoryDelete(cat); }}
                className={`p-1 rounded hover:bg-red-500/10 text-red-400 transition-all`}
                title="Elimina"
              >
                <Trash2 size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onCategoryMoveUp(cat); }}
                className={`p-1 rounded ${isEmbedded ? 'hover:bg-charcoal text-gray-400' : 'hover:bg-slate-700 text-slate-400'} transition-all`}
                title="Sposta su"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onCategoryMoveDown(cat); }}
                className={`p-1 rounded ${isEmbedded ? 'hover:bg-charcoal text-gray-400' : 'hover:bg-slate-700 text-slate-400'} transition-all`}
                title="Sposta giù"
              >
                <ChevronDown size={12} />
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="shrink-0 flex items-center gap-1 pl-1">
        {editMode ? (
          <button
            onClick={() => setEditMode(false)}
            className={`shrink-0 px-3 py-2 rounded-xl font-bold text-sm transition-all ${isEmbedded ? 'bg-gold text-black' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'} hover:opacity-80`}
          >
            Fine
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className={`p-2 rounded-xl ${isEmbedded ? 'text-gray-400 hover:text-white hover:bg-charcoal' : 'text-slate-500 hover:text-white hover:bg-slate-700'} transition-all`}
            title="Modifica categorie"
          >
            <PenLine size={18} />
          </button>
        )}
        {showNewCatInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newCatName.trim()) {
                  onCategoryAdd(newCatName.trim());
                  setShowNewCatInput(false);
                  setNewCatName('');
                }
                if (e.key === 'Escape') { setShowNewCatInput(false); setNewCatName(''); }
              }}
              placeholder="Nome..."
              className={`w-32 ${isEmbedded ? 'bg-charcoal border-gold/50 focus:border-gold' : 'bg-slate-950 border-indigo-500/50 focus:border-indigo-500'} border rounded-xl py-2 px-3 text-white text-sm outline-none`}
              autoFocus
            />
            <button
              onClick={() => { if (newCatName.trim()) { onCategoryAdd(newCatName.trim()); setShowNewCatInput(false); setNewCatName(''); } }}
              className={`p-2 ${isEmbedded ? 'bg-gold text-black' : 'bg-indigo-500'} rounded-lg text-white`}
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowNewCatInput(true); setEditMode(false); }}
            className={`shrink-0 px-3 py-2 rounded-xl font-bold text-sm ${isEmbedded ? 'bg-surface text-gray-500 hover:bg-charcoal hover:text-white' : 'bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700'} transition-all`}
            title="Aggiungi categoria"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
