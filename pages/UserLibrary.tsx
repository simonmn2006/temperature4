
import React, { useState, useMemo } from 'react';
import { Document, DocumentCategory, TranslationSet } from '../types';

interface UserLibraryProps {
  t: TranslationSet;
  documents: Document[];
}

export const UserLibrary: React.FC<UserLibraryProps> = ({ t, documents }) => {
  const [activeTab, setActiveTab] = useState<DocumentCategory>('safety');
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);

  const safetyDocs = useMemo(() => documents.filter(d => d.category === 'safety'), [documents]);
  const staffDocs = useMemo(() => documents.filter(d => d.category === 'staff'), [documents]);
  const hygieneDocs = useMemo(() => documents.filter(d => d.category === 'hygiene'), [documents]);

  const categories = [
    { id: 'safety', icon: '🛡️', color: 'blue', label: 'Sicherheit', docs: safetyDocs },
    { id: 'staff', icon: '👤', color: 'indigo', label: 'Personal', docs: staffDocs },
    { id: 'hygiene', icon: '🧼', color: 'emerald', label: 'Hygiene', docs: hygieneDocs }
  ] as const;

  const currentDocs = categories.find(c => c.id === activeTab)?.docs || [];
  const currentCategory = categories.find(c => c.id === activeTab)!;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Handbuch Bibliothek</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">Alle wichtigen Unterlagen an einem Ort.</p>
        </div>
        
        {/* ICON ONLY CATEGORY TABS */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-[2.5rem] w-full md:w-auto shadow-inner gap-2">
           {categories.map(cat => (
             <button 
              key={cat.id}
              onClick={() => setActiveTab(cat.id as DocumentCategory)}
              title={cat.label}
              className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl transition-all relative ${
                activeTab === cat.id 
                  ? `bg-white dark:bg-slate-700 text-${cat.color}-600 shadow-lg scale-110` 
                  : 'text-slate-300 hover:text-slate-500 dark:text-slate-600'
              }`}
             >
               {cat.icon}
               {cat.docs.length > 0 && (
                 <span className={`absolute -top-1 -right-1 w-5 h-5 bg-${cat.color}-100 text-${cat.color}-600 rounded-full flex items-center justify-center text-[8px] font-black border border-white dark:border-slate-800`}>
                   {cat.docs.length}
                 </span>
               )}
             </button>
           ))}
        </div>
      </header>

      {/* CATEGORY BANNER */}
      <div className={`p-8 rounded-[3.5rem] border-l-[12px] bg-white dark:bg-slate-900 border-${currentCategory.color}-100 dark:border-${currentCategory.color}-900/30 flex items-center gap-6 shadow-sm`}>
         <span className="text-6xl">{currentCategory.icon}</span>
         <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{currentCategory.label}</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">{currentCategory.docs.length} verfügbare Handbücher</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {currentDocs.map(doc => (
          <div 
            key={doc.id} 
            onClick={() => setActiveDoc(doc)}
            className={`group p-10 rounded-[3.5rem] border shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between min-h-[260px] relative overflow-hidden bg-white dark:bg-slate-900 ${
              activeTab === 'safety' ? 'border-blue-50 hover:border-blue-200' : 
              activeTab === 'staff' ? 'border-indigo-50 hover:border-indigo-200' :
              'border-emerald-50 hover:border-emerald-200'
            }`}
          >
            {/* Visual background hint */}
            <div className={`absolute -right-4 -bottom-4 text-9xl opacity-[0.03] transition-transform group-hover:scale-110 text-${currentCategory.color}-600`}>
               {currentCategory.icon}
            </div>

            <div className="flex justify-between items-start relative z-10">
               <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner group-hover:animate-bounce transition-all ${
                 activeTab === 'safety' ? 'bg-blue-50 text-blue-600' : 
                 activeTab === 'staff' ? 'bg-indigo-50 text-indigo-600' :
                 'bg-emerald-50 text-emerald-600'
               }`}>
                 📖
               </div>
               <span className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest">Digital PDF</span>
            </div>
            <div className="mt-8 relative z-10">
               <h3 className={`text-2xl font-black uppercase tracking-tight leading-tight transition-colors text-slate-900 dark:text-white group-hover:text-${currentCategory.color}-600`}>{doc.title}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-3">Ansehen &rarr;</p>
            </div>
          </div>
        ))}

        {currentDocs.length === 0 && (
          <div className="col-span-full py-32 text-center flex flex-col items-center opacity-40">
             <span className="text-7xl mb-8">{currentCategory.icon}</span>
             <p className="text-lg font-black uppercase tracking-[0.2em] text-slate-400">Keine Dokumente in dieser Kategorie</p>
          </div>
        )}
      </div>

      {activeDoc && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/95 backdrop-blur-2xl flex flex-col p-2 md:p-6 animate-in zoom-in-95 duration-200">
           <div className="flex justify-between items-center mb-4 px-6 text-white">
              <div className="flex items-center gap-5">
                 <span className="text-3xl">{activeDoc.category === 'hygiene' ? '🧼' : activeDoc.category === 'staff' ? '👤' : '🛡️'}</span>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter leading-tight">{activeDoc.title}</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Handbuch: {activeDoc.category}</p>
                 </div>
              </div>
              <button 
                onClick={() => setActiveDoc(null)} 
                className="px-8 py-4 bg-white/10 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-rose-600 transition-all flex items-center gap-3 border border-white/5"
              >
                <span>✕</span> <span>Verlassen</span>
              </button>
           </div>
           <div className="flex-1 w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative">
              <iframe 
                src={activeDoc.content} 
                className="w-full h-full border-none" 
                title={activeDoc.title}
              />
           </div>
        </div>
      )}
    </div>
  );
};
