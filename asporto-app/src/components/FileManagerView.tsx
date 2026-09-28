import { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, FileText, Save, Trash2, Plus, RefreshCw, 
  ChevronRight, Download, Upload, X, 
  Code 
} from 'lucide-react';
import { useToast } from './Toast';

const FILE_MANAGER_URL = (import.meta.env.VITE_FILE_MANAGER_URL as string) || '/api/file-manager';

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export default function FileManagerView() {
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const toast = useToast();

  const getAuthHeader = () => {
    const token = localStorage.getItem('sb-access-token') || 
                  sessionStorage.getItem('sb-access-token');
    return token ? `Bearer ${token}` : '';
  };

  const api = async (action: string, path: string, data?: any) => {
    const res = await fetch(FILE_MANAGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({ action, path, ...data })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('list', currentPath);
      let list = res.files;
      if (!showHidden) {
        list = list.filter((f: FileEntry) => !f.name.startsWith('.'));
      }
      list.sort((a: FileEntry, b: FileEntry) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(list);
    } catch (e) {
      toast.addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Caricamento fallito' });
    } finally {
      setLoading(false);
    }
  }, [currentPath, showHidden, toast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const navigate = (name: string) => {
    if (name === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      setCurrentPath(parts.length ? parts.join('/') : '.');
    } else {
      const next = currentPath === '.' ? name : `${currentPath}/${name}`;
      setCurrentPath(next);
    }
    setSelectedFile(null);
    setEditing(false);
  };

  const openFile = async (file: FileEntry) => {
    setSelectedFile(file);
    try {
      const res = await api('read', `${currentPath}/${file.name}`);
      setFileContent(res.content);
      setEditing(false);
    } catch (e) {
      toast.addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Lettura fallita' });
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      await api('write', `${currentPath}/${selectedFile.name}`, { content: fileContent });
      toast.addToast({ type: 'success', title: 'Salvato', message: `${selectedFile.name} aggiornato` });
      setEditing(false);
    } catch (e) {
      toast.addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Salvataggio fallito' });
    }
  };

  const createFile = async (isDir: boolean) => {
    const name = prompt(isDir ? 'Nome cartella:' : 'Nome file:');
    if (!name) return;
    try {
      if (isDir) {
        await api('mkdir', `${currentPath}/${name}`);
      } else {
        await api('write', `${currentPath}/${name}`, { content: '' });
      }
      toast.addToast({ type: 'success', title: 'Creato', message: `${name} creato` });
      loadFiles();
    } catch (e) {
      toast.addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Creazione fallita' });
    }
  };

  const deleteItem = async (file: FileEntry) => {
    if (!confirm(`Eliminare ${file.name}?`)) return;
    try {
      await api('delete', `${currentPath}/${file.name}`);
      toast.addToast({ type: 'success', title: 'Eliminato', message: `${file.name} rimosso` });
      loadFiles();
      if (selectedFile?.name === file.name) setSelectedFile(null);
    } catch (e) {
      toast.addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Eliminazione fallita' });
    }
  };

  const downloadFile = async (file: FileEntry) => {
    try {
      const res = await api('read', `${currentPath}/${file.name}`);
      const blob = new Blob([res.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Download fallito' });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        await api('upload', `${currentPath}/${file.name}`, { 
          content: base64, 
          encoding: 'base64' 
        });
        toast.addToast({ type: 'success', title: 'Caricato', message: file.name });
        loadFiles();
      } catch (e) {
        toast.addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Upload fallito' });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getIcon = (file: FileEntry) => {
    if (file.isDirectory) return <FolderOpen size={16} className="text-amber-500" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['ts','tsx','js','jsx','json','sql','sh','py','md','yml','yaml','toml','ini','conf','cfg'].includes(ext || '')) 
      return <Code size={16} className="text-sky-500" />;
    if (['txt','log'].includes(ext || '')) return <FileText size={16} className="text-gray-500" />;
    return <FileText size={16} className="text-gray-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)}KB`;
    return `${(bytes/1024/1024).toFixed(1)}MB`;
  };

  const filteredFiles = searchQuery 
    ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  return (
    <div className="h-full flex flex-col bg-charcoal text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 bg-surface border-b border-surface-light shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Path:</span>
          <span className="font-mono text-xs text-gray-300 truncate flex-1">
            /{currentPath === '.' ? '' : currentPath}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <input 
            type="text" 
            placeholder="Cerca..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            className="w-48 bg-charcoal border border-surface-light rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-gold placeholder:text-gray-600"
          />
          <label className="flex items-center gap-1 cursor-pointer p-2 rounded-xl hover:bg-surface-light transition-all" title="Mostra nascosti">
            <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} className="w-4 h-4 accent-gold" />
            <span className="text-[10px] font-black text-gray-500 uppercase">Hidden</span>
          </label>
          <button onClick={loadFiles} disabled={loading} className="p-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gold/50 transition-all disabled:opacity-50" title="Aggiorna">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <input type="file" id="upload-input" onChange={handleUpload} className="hidden" />
          <label htmlFor="upload-input" className="p-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gold/50 transition-all cursor-pointer" title="Carica file">
            <Upload size={16} />
          </label>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-auto split-w-0 relative min-h-0">
        {/* Directory tree */}
        <div className="w-72 border-r border-surface-light bg-surface/50 flex flex-col min-h-0">
          <div className="p-3 border-b border-surface-light bg-charcoal/50">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Directory</span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <div className="p-2 space-y-1">
              {currentPath !== '.' && (
                <button onClick={() => navigate('..')} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-surface-light transition-all text-left">
                  <ChevronRight size={14} className="rotate-180 text-gray-500" />
                  <span className="text-xs font-medium text-gray-400 truncate">.. (su)</span>
                </button>
              )}
              {files.filter(f => f.isDirectory).map(f => (
                <button 
                  key={f.name} 
                  onClick={() => navigate(f.name)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all text-left ${
                    selectedFile?.name === f.name && !editing 
                      ? 'bg-gold/10 text-gold' 
                      : 'hover:bg-surface-light text-white'
                  }`}
                >
                  <FolderOpen size={14} className="text-amber-500" />
                  <span className="text-xs font-medium truncate">{f.name}</span>
                </button>
              ))}
              {files.filter(f => f.isDirectory).length === 0 && currentPath === '.' && (
                <p className="text-[10px] text-gray-600 px-2 py-4 text-center">Nessuna cartella</p>
              )}
            </div>
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-3 border-b border-surface-light bg-charcoal/50 flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              File ({filteredFiles.filter(f => !f.isDirectory).length})
            </span>
            <div className="flex gap-1">
              <button onClick={() => createFile(false)} className="p-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gold/50 transition-all" title="Nuovo file">
                <Plus size={14} />
              </button>
              <button onClick={() => createFile(true)} className="p-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gold/50 transition-all" title="Nuova cartella">
                <FolderOpen size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-surface-light">
                  <th className="pb-3 pr-4 w-8"></th>
                  <th className="pb-3 pr-4">Nome</th>
                  <th className="pb-3 pr-4 text-right w-24">Dimensione</th>
                  <th className="pb-3 text-right w-36">Modificato</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.filter(f => !f.isDirectory).map(file => (
                  <tr key={file.name} className={`border-b border-surface-light/50 hover:bg-surface-light/30 transition-all ${
                    selectedFile?.name === file.name && !editing ? 'bg-gold/5' : ''
                  }`}>
                    <td className="py-2.5 pr-4">
                      {getIcon(file)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <button 
                        onClick={() => openFile(file)}
                        className="flex items-center gap-2 text-sm font-medium truncate w-full text-left hover:text-gold transition-colors"
                      >
                        {getIcon(file)}
                        <span className="truncate">{file.name}</span>
                      </button>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-[10px] font-mono text-gray-500">
                      {formatSize(file.size)}
                    </td>
                    <td className="py-2.5 text-right text-[10px] text-gray-500">
                      {new Date(file.modified).toLocaleString('it-IT', { 
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                      })}
                    </td>
                  </tr>
                ))}
                {filteredFiles.filter(f => !f.isDirectory).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-600 text-sm">
                      Nessun file
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Editor panel */}
        {selectedFile && (
          <div className="w-96 border-l border-surface-light bg-surface flex flex-col min-h-0 animate-in slide-in-from-right-2 duration-200">
            <div className="p-3 border-b border-surface-light bg-charcoal/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {getIcon(selectedFile)}
                <span className="font-mono text-sm truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {!editing && (
                  <>
                    <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gold/50 transition-all" title="Modifica">
                      <Code size={14} />
                    </button>
                    <button onClick={() => downloadFile(selectedFile!)} className="p-1.5 rounded-lg bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gold/50 transition-all" title="Download">
                      <Download size={14} />
                    </button>
                    <button onClick={() => deleteItem(selectedFile!)} className="p-1.5 rounded-lg bg-charcoal border border-surface-light text-gray-400 hover:text-red-500 hover:border-red-500/50 transition-all" title="Elimina">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                {editing && (
                  <>
                    <button onClick={saveFile} className="px-3 py-1.5 bg-gold text-black text-[10px] font-black uppercase rounded-xl hover:bg-gold-hover transition-all" title="Salva (Ctrl+S)">
                      <Save size={12} className="inline mr-1" /> Salva
                    </button>
                    <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gold/50 transition-all" title="Annulla">
                      <X size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <textarea
                value={fileContent}
                onChange={e => setFileContent(e.target.value)}
                disabled={!editing}
                className="w-full h-full font-mono text-xs bg-charcoal border border-surface-light rounded-xl p-3 text-white placeholder-gray-700 outline-none focus:border-gold resize-none"
                spellCheck={false}
                placeholder={editing ? 'Modifica il file...' : 'Clicca "Modifica" per editare'}
              />
            </div>
            {editing && (
              <div className="p-3 border-t border-surface-light bg-charcoal/50 flex items-center justify-end gap-2 shrink-0">
                <span className="text-[10px] font-black text-gray-500 uppercase">Ctrl+S per salvare</span>
                <button onClick={saveFile} className="px-4 py-2 bg-gold text-black text-[10px] font-black uppercase rounded-xl hover:bg-gold-hover transition-all">
                  <Save size={12} className="inline mr-1" /> Salva
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}