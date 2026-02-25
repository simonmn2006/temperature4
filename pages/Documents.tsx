
import React, { useState } from 'react';
import { TranslationSet, Document, AuditLog, DocumentCategory } from '../types';

interface DocumentsPageProps {
  t: (key: string) => string;
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  onSync: (doc: Document) => void;
  onSyncDelete: (id: string) => void;
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({ t, documents, setDocuments, onSync, onSyncDelete, onLog }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('safety');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('Nur PDF-Dateien sind erlaubt.');
        return;
      }
      setSelectedFile(file);
      if (!docTitle) setDocTitle(file.name.replace('.pdf', ''));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !docTitle.trim()) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Content = e.target?.result as string;
      const newDoc: Document = {
        id: `DOC-${Date.now()}`,
        title: docTitle,
        category: docCategory,
        content: base64Content,
        createdAt: new Date().toISOString()
      };

      setDocuments(prev => [newDoc, ...prev]);
      onSync(newDoc);
      onLog('CREATE', 'DOCUMENTS', `Handbuch "${docTitle}" (${docCategory}) hochgeladen`);
      
      setDocTitle('');
      setSelectedFile(null);
      setIsUploading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Soll das Dokument "${title}" wirklich gelöscht werden?`)) {
      setDocuments(prev => prev.filter(d => d.id !== id));
      onSyncDelete(id);
      onLog('DELETE', 'DOCUMENTS', `Handbuch "${title}" gelöscht`);
    }
  };

  const getCategoryIcon = (cat: DocumentCategory) => {
    if (cat === 'safety') return '🛡️';
    if (cat === 'staff') return '👤';
    if (cat === 'hygiene') return '🧼';
    return '📄';
  };

  const getCategoryColorClass = (cat: DocumentCategory) => {
    if (cat === 'safety') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (cat === 'staff') return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (cat === 'hygiene') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Handbuch-Verwaltung</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">Sicherheitsunterweisungen und Dokumentation für Mitarbeiter</p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase mb-6 flex items-center gap-2">
          <span>📤</span> Upload Center
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Titel des Handbuchs</label>
            <input 
              type="text" 
              value={docTitle} 
              onChange={e => setDocTitle(e.target.value)} 
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none"
              placeholder="Bezeichnung..."
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kategorie</label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl overflow-hidden">
               <button onClick={() => setDocCategory('safety')} className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all ${docCategory === 'safety' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>Sicherheit</button>
               <button onClick={() => setDocCategory('staff')} className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all ${docCategory === 'staff' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Personal</button>
               <button onClick={() => setDocCategory('hygiene')} className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all ${docCategory === 'hygiene' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Hygiene</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Datei (PDF)</label>
            <div className="flex gap-4">
              <label className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest truncate max-w-[150px]">
                  {selectedFile ? selectedFile.name : 'PDF wählen...'}
                </span>
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </label>
              <button onClick={handleUpload} disabled={!selectedFile || !docTitle.trim() || isUploading} className={`px-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${!selectedFile || !docTitle.trim() || isUploading ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Upload</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map(doc => (
          <div key={doc.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all relative overflow-hidden">
             <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${getCategoryColorClass(doc.category)}`}>
                  {getCategoryIcon(doc.category)}
                </div>
                <div className="flex flex-col gap-2">
                   <button onClick={() => setPreviewDoc(doc)} className="p-2.5 bg-slate-50 dark:bg-slate-800 text-blue-600 rounded-xl hover:scale-110 transition-transform shadow-sm">👁️</button>
                   <button onClick={() => handleDelete(doc.id, doc.title)} className="p-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl hover:scale-110 transition-transform shadow-sm">🗑️</button>
                </div>
             </div>
             <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight mb-4 pr-10">{doc.title}</h3>
             <div className="pt-6 border-t border-slate-50 dark:border-slate-800">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stand: {new Date(doc.createdAt).toLocaleDateString('de-DE')}</span>
             </div>
          </div>
        ))}
      </div>

      {previewDoc && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-xl flex flex-col p-4 md:p-10 animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6 text-white max-w-7xl mx-auto w-full">
            <h2 className="text-2xl font-black uppercase tracking-tighter">{previewDoc.title}</h2>
            <button onClick={() => setPreviewDoc(null)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-bold hover:bg-rose-600 transition-all">✕</button>
          </div>
          <div className="flex-1 w-full max-w-7xl mx-auto bg-white rounded-[2rem] overflow-hidden shadow-2xl relative flex items-center justify-center">
            <iframe src={previewDoc.content} className="w-full h-full border-none" title={previewDoc.title} />
          </div>
        </div>
      )}
    </div>
  );
};
