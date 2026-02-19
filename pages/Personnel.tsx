
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, Personnel, Facility, PersonnelDocType, PersonnelDocument } from '../types';

interface PersonnelPageProps {
  t: TranslationSet;
  personnel: Personnel[];
  setPersonnel: React.Dispatch<React.SetStateAction<Personnel[]>>;
  facilities: Facility[];
  personnelDocs: PersonnelDocument[];
  onSync: (p: Personnel) => void;
  onSyncDelete: (id: string) => void;
  onDocDelete: (id: string) => void;
  onDocUpdate?: (doc: PersonnelDocument) => void;
  onDocUpload?: (doc: PersonnelDocument) => void;
}

const DOC_TYPES: { type: PersonnelDocType; icon: string; label: string }[] = [
  { type: 'Gesundheitsausweis', icon: '🩺', label: 'G-Ausweis' },
  { type: 'Infektionsschutzschulung', icon: '🦠', label: 'Infektionssch.' },
  { type: 'Masernschutz', icon: '💉', label: 'Masern' }
];

export const PersonnelPage: React.FC<PersonnelPageProps> = ({ 
  t, personnel, setPersonnel, facilities, personnelDocs, onSync, onSyncDelete, onDocDelete, onDocUpdate, onDocUpload 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [facilityFilterSearch, setFacilityFilterSearch] = useState('');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Personnel | null>(null);
  const [viewingDocsPerson, setViewingDocsPerson] = useState<Personnel | null>(null);
  const [docToDelete, setDocToDelete] = useState<PersonnelDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PersonnelDocument | null>(null);
  
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<Partial<Personnel>>({
    firstName: '',
    lastName: '',
    facilityIds: [],
    requiredDocs: ['Gesundheitsausweis', 'Infektionsschutzschulung', 'Masernschutz'],
    status: 'Active'
  });

  const [facilitySearch, setFacilitySearch] = useState('');
  const [isFacDropdownOpen, setIsFacDropdownOpen] = useState(false);
  
  const facDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const filteredPersonnel = useMemo(() => {
    return personnel.filter(p => {
      const matchesSearch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFacility = facilityFilter === 'all' || p.facilityIds.includes(facilityFilter);
      const matchesStatus = showInactive ? true : p.status === 'Active';
      return matchesSearch && matchesFacility && matchesStatus;
    });
  }, [personnel, searchTerm, facilityFilter, showInactive]);

  const filteredFacilitiesList = useMemo(() => {
    return facilities.filter(f => f.name.toLowerCase().includes(facilityFilterSearch.toLowerCase()));
  }, [facilities, facilityFilterSearch]);

  const modalFilteredFacilities = useMemo(() => {
    return facilities.filter(f => f.name.toLowerCase().includes(facilitySearch.toLowerCase()) && !formData.facilityIds?.includes(f.id));
  }, [facilities, facilitySearch, formData.facilityIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (facDropdownRef.current && !facDropdownRef.current.contains(event.target as Node)) {
        setIsFacDropdownOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownload = (doc: PersonnelDocument) => {
    const link = document.createElement('a');
    link.href = doc.content;
    const extension = doc.mimeType.split('/')[1] || 'bin';
    link.download = `${doc.type}_${viewingDocsPerson?.lastName || 'Dokument'}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (doc: PersonnelDocument) => {
    const win = window.open('', '_blank');
    if (!win) return;
    
    if (doc.mimeType.includes('pdf')) {
      win.location.href = doc.content;
      // Note: PDF printing in new window usually uses browser controls
    } else {
      win.document.write(`
        <html>
          <body style="margin:0; display:flex; align-items:center; justify-content:center;">
            <img src="${doc.content}" style="max-width:100%; max-height:100vh; object-contain;" onload="window.print();window.close();" />
          </body>
        </html>
      `);
    }
  };

  const openModal = (person?: Personnel) => {
    setFormError(null);
    setInvalidFields(new Set());
    if (person) {
      setEditingPerson(person);
      setFormData({ ...person });
    } else {
      setEditingPerson(null);
      setFormData({
        firstName: '',
        lastName: '',
        facilityIds: [],
        requiredDocs: ['Gesundheitsausweis', 'Infektionsschutzschulung', 'Masernschutz'],
        status: 'Active'
      });
    }
    setFacilitySearch('');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setFormError(null);
    const errors = new Set<string>();
    
    if (!formData.firstName?.trim()) errors.add('firstName');
    if (!formData.lastName?.trim()) errors.add('lastName');

    if (errors.size > 0) {
      setInvalidFields(errors);
      setFormError("Vorname und Nachname sind erforderlich.");
      return;
    }

    const finalPerson: Personnel = {
      id: editingPerson?.id || `P-${Date.now()}`,
      firstName: formData.firstName!.trim(),
      lastName: formData.lastName!.trim(),
      facilityIds: formData.facilityIds || [],
      requiredDocs: formData.requiredDocs || [],
      status: formData.status || 'Active'
    };

    if (editingPerson) {
      setPersonnel(prev => prev.map(p => p.id === editingPerson.id ? finalPerson : p));
    } else {
      setPersonnel(prev => [...prev, finalPerson]);
    }

    onSync(finalPerson);
    setIsModalOpen(false);
  };

  const handleAdminFileUpload = (e: React.ChangeEvent<HTMLInputElement>, personnelId: string, type: PersonnelDocType) => {
    if (!e.target.files?.[0] || !onDocUpload) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      const newDoc: PersonnelDocument = {
        id: `PDOC-${Date.now()}`,
        personnelId: personnelId,
        type: type,
        content: base64,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
        visibleToUser: true
      };
      onDocUpload(newDoc);
    };
    reader.readAsDataURL(file);
  };

  const toggleDocRequirement = (doc: PersonnelDocType) => {
    const current = formData.requiredDocs || [];
    const next = current.includes(doc) ? current.filter(d => d !== doc) : [...current, doc];
    setFormData({ ...formData, requiredDocs: next });
  };

  const removeFacilityId = (id: string) => {
    setFormData({ ...formData, facilityIds: (formData.facilityIds || []).filter(fid => fid !== id) });
  };

  const toggleDocVisibility = (doc: PersonnelDocument) => {
    if (onDocUpdate) {
      onDocUpdate({ ...doc, visibleToUser: !doc.visibleToUser });
    }
  };

  const getFieldClass = (fieldName: string) => {
    const base = "w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border font-bold text-sm outline-none transition-all";
    if (invalidFields.has(fieldName)) {
      return `${base} border-rose-500 ring-4 ring-rose-500/10 animate-shake`;
    }
    return `${base} border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10`;
  };

  const confirmDeleteDoc = () => {
    if (docToDelete) {
      onDocDelete(docToDelete.id);
      setDocToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Personal & Compliance</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Stammdaten & Pflichtdokumente</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
           <button 
             onClick={() => setShowInactive(!showInactive)}
             className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${showInactive ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
           >
             {showInactive ? '✅ Inaktive eingeblendet' : '👁️ Inaktive einblenden'}
           </button>
           <button onClick={() => openModal()} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl shadow-blue-500/20 uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-transform">+ Person anlegen</button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="relative flex-1">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">🔍</span>
          <input 
            type="text" 
            placeholder="Nach Namen suchen..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 outline-none font-bold text-base shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all" 
          />
        </div>
        
        <div className="relative w-full lg:w-80" ref={filterDropdownRef}>
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">🏢</span>
          <div 
            onClick={() => setIsFilterDropdownOpen(true)}
            className="w-full pl-14 pr-10 py-4 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 outline-none font-black text-xs shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer flex items-center uppercase"
          >
            {facilityFilter === 'all' ? 'Alle Standorte' : facilities.find(f => f.id === facilityFilter)?.name || 'Alle Standorte'}
          </div>
          {isFilterDropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.75rem] shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2">
               <div className="p-3 border-b border-slate-50 dark:border-slate-800">
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Standort filtern..."
                    value={facilityFilterSearch}
                    onChange={e => setFacilityFilterSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-xs outline-none"
                  />
               </div>
               <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  <button 
                    onClick={() => { setFacilityFilter('all'); setFacilityFilterSearch(''); setIsFilterDropdownOpen(false); }}
                    className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-0 border-slate-50 dark:border-slate-800 ${facilityFilter === 'all' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500'}`}
                  >
                    Alle Standorte
                  </button>
                  {filteredFacilitiesList.map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => { setFacilityFilter(f.id); setFacilityFilterSearch(''); setIsFilterDropdownOpen(false); }}
                      className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-0 border-slate-50 dark:border-slate-800 ${facilityFilter === f.id ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500'}`}
                    >
                      {f.name}
                    </button>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPersonnel.map(p => (
          <div key={p.id} className={`bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden ${p.status === 'Inactive' ? 'opacity-60 grayscale' : ''}`}>
             <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">
                  {p.status === 'Active' ? '👨‍💼' : '🌑'}
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setViewingDocsPerson(p)} className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl hover:scale-110 transition-transform shadow-sm" title="Dokumente prüfen">👁️</button>
                   <button onClick={() => openModal(p)} className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl hover:scale-110 transition-transform shadow-sm">✏️</button>
                   <button onClick={() => setPersonToDelete(p)} className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl hover:scale-110 transition-transform shadow-sm">🗑️</button>
                </div>
             </div>
             
             <div className="mb-6">
               <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">{p.firstName} {p.lastName}</h3>
               {p.status === 'Inactive' && (
                 <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase border border-slate-200">Personal Inaktiv</span>
               )}
             </div>

             <div className="flex flex-wrap gap-2 mb-8 min-h-[40px]">
                {p.facilityIds.length > 0 ? p.facilityIds.map(fid => (
                   <span key={fid} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase border border-blue-100 dark:border-blue-800">
                      {facilities.find(f => f.id === fid)?.name || fid}
                   </span>
                )) : (
                   <span className="text-[10px] font-bold text-slate-400 uppercase italic">Kein Standort zugewiesen</span>
                )}
             </div>

             <div className="pt-8 border-t border-slate-50 dark:border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Compliance Status</p>
                </div>
                <div className="flex gap-3">
                   {DOC_TYPES.map(doc => {
                     const isRequired = p.requiredDocs.includes(doc.type);
                     const docs = personnelDocs.filter(d => d.personnelId === p.id && d.type === doc.type);
                     const hasDoc = docs.length > 0;
                     return (
                        <div key={doc.type} title={`${doc.type}${hasDoc ? ' (Vorhanden)' : ' (Fehlt)'}`} className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border transition-all ${isRequired ? (hasDoc ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-rose-50 text-rose-500 border-rose-100 shadow-sm') : 'bg-slate-50 text-slate-200 border-slate-100 grayscale'}`}>
                           {hasDoc ? '✅' : doc.icon}
                        </div>
                     );
                   })}
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* COMPLIANCE MANAGEMENT MODAL (EYE ICON) */}
      {viewingDocsPerson && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 text-left relative">
            <div className="p-10 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
               <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner">📄</div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Compliance-Management</h3>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{viewingDocsPerson.firstName} {viewingDocsPerson.lastName}</p>
                  </div>
               </div>
               <button onClick={() => setViewingDocsPerson(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold hover:scale-110 transition-all">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
               {DOC_TYPES.filter(dt => viewingDocsPerson.requiredDocs.includes(dt.type)).map(dt => {
                  const docs = personnelDocs.filter(d => d.personnelId === viewingDocsPerson.id && d.type === dt.type);
                  return (
                    <div key={dt.type} className="bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800">
                       <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-4">
                             <span className="text-3xl">{dt.icon}</span>
                             <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{dt.type}</h4>
                          </div>
                          <label className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer shadow-lg hover:bg-blue-700 transition-colors">
                             + Upload
                             <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => handleAdminFileUpload(e, viewingDocsPerson.id, dt.type)} />
                          </label>
                       </div>

                       <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6">
                          {docs.map(doc => (
                            <div key={doc.id} className="group relative cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                               <div className={`aspect-[3/4] bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden shadow-sm group-hover:shadow-xl relative ${doc.visibleToUser ? 'border-slate-200' : 'border-amber-400 opacity-75 grayscale'}`}>
                                  {doc.mimeType.startsWith('image') ? (
                                    <img src={doc.content} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl font-black opacity-20">PDF</div>
                                  )}
                                  
                                  <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 p-4">
                                     <button className="w-full bg-white text-slate-900 font-black text-[9px] uppercase tracking-widest py-2 rounded-xl">Ansehen</button>
                                     <button 
                                       onClick={(e) => { e.stopPropagation(); toggleDocVisibility(doc); }}
                                       className={`w-full font-black text-[9px] uppercase tracking-widest py-2 rounded-xl transition-colors ${doc.visibleToUser ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                                     >
                                       {doc.visibleToUser ? 'Verbergen' : 'Einblenden'}
                                     </button>
                                     <button 
                                       onClick={(e) => { e.stopPropagation(); setDocToDelete(doc); }}
                                       className="w-full bg-rose-600 text-white font-black text-[9px] uppercase tracking-widest py-2 rounded-xl hover:bg-rose-700 transition-colors"
                                     >
                                       Löschen
                                     </button>
                                  </div>
                               </div>
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 text-center">{new Date(doc.createdAt).toLocaleDateString('de-DE')}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  );
               })}
            </div>
          </div>
        </div>
      )}

      {/* EDIT/ADD MODAL (PENCIL/PLUS ICON) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] shadow-2xl flex flex-col relative text-left border border-white/10 overflow-hidden">
            <div className="p-10 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">{editingPerson ? 'Personen-Stamm bearbeiten' : 'Neue Person anlegen'}</h3>
            </div>
            
            <div className="p-10 space-y-10 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {formError && (
                 <div className="p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest animate-shake">
                   ⚠️ {formError}
                 </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vorname</label>
                   <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className={getFieldClass('firstName')} placeholder="Vorname..." />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nachname</label>
                   <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className={getFieldClass('lastName')} placeholder="Nachname..." />
                </div>
              </div>

              {/* RESTORED DOCUMENT REQUIREMENT ICONS */}
              <div className="space-y-6">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Erforderliche Dokumente</label>
                 <div className="grid grid-cols-3 gap-4">
                    {DOC_TYPES.map(dt => (
                      <button 
                        key={dt.type}
                        type="button"
                        onClick={() => toggleDocRequirement(dt.type)}
                        className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center text-center gap-3 ${formData.requiredDocs?.includes(dt.type) ? 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-slate-50 border-slate-100 grayscale opacity-40'}`}
                      >
                         <span className="text-4xl">{dt.icon}</span>
                         <span className={`text-[9px] font-black uppercase tracking-tighter leading-tight ${formData.requiredDocs?.includes(dt.type) ? 'text-blue-600' : 'text-slate-400'}`}>{dt.label}</span>
                         <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.requiredDocs?.includes(dt.type) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'}`}>
                            {formData.requiredDocs?.includes(dt.type) && <span className="text-[10px]">✓</span>}
                         </div>
                      </button>
                    ))}
                 </div>
              </div>

              {/* RESTORED SEARCHABLE FACILITY DROPDOWN */}
              <div className="space-y-4" ref={facDropdownRef}>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Zugeordnete Standorte</label>
                 <div className="flex flex-wrap gap-2 mb-3">
                    {formData.facilityIds?.map(fid => (
                       <button key={fid} onClick={() => removeFacilityId(fid)} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center space-x-2 shadow-sm hover:bg-rose-500 transition-colors">
                          <span>{facilities.find(f => f.id === fid)?.name || fid}</span>
                          <span>✕</span>
                       </button>
                    ))}
                 </div>
                 <div className="relative">
                    <input 
                      type="text" 
                      value={facilitySearch} 
                      onChange={e => { setFacilitySearch(e.target.value); setIsFacDropdownOpen(true); }}
                      onFocus={() => setIsFacDropdownOpen(true)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none text-sm shadow-inner"
                      placeholder="Standorte suchen & hinzufügen..."
                    />
                    {isFacDropdownOpen && modalFilteredFacilities.length > 0 && (
                      <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-[60] max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2">
                        {modalFilteredFacilities.map(f => (
                          <button key={f.id} onClick={() => { setFormData({...formData, facilityIds: [...(formData.facilityIds || []), f.id]}); setIsFacDropdownOpen(false); setFacilitySearch(''); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs uppercase border-b last:border-0 border-slate-50 dark:border-slate-800">{f.name}</button>
                        ))}
                      </div>
                    )}
                 </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Beschäftigungsstatus</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{formData.status === 'Active' ? 'Im Unternehmen aktiv' : 'Inaktiv / Ehemalig'}</p>
                 </div>
                 <button 
                   onClick={() => setFormData({...formData, status: formData.status === 'Active' ? 'Inactive' : 'Active'})}
                   className={`w-16 h-8 rounded-full transition-all relative ${formData.status === 'Active' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-300'}`}
                 >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${formData.status === 'Active' ? 'left-9' : 'left-1'}`} />
                 </button>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end space-x-4">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-500 font-black uppercase text-xs">Abbrechen</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-12 py-4 rounded-[1.25rem] font-black shadow-xl hover:scale-105 active:scale-95 transition-transform uppercase text-xs">Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* INTERNAL DOCUMENT PREVIEWER WITH SAVE & PRINT */}
      {previewDoc && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/95 backdrop-blur-2xl flex flex-col p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
           <div className="flex justify-between items-center mb-6 text-white max-w-7xl mx-auto w-full">
              <div className="flex items-center gap-5">
                 <span className="text-3xl">📄</span>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter leading-tight">{previewDoc.type} Vorschau</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Erfasst am {new Date(previewDoc.createdAt).toLocaleDateString('de-DE')}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => handleDownload(previewDoc)} 
                  className="px-6 py-4 bg-white/10 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-blue-600 transition-all flex items-center gap-3 border border-white/5"
                 >
                   <span>💾</span> <span>Speichern</span>
                 </button>
                 <button 
                  onClick={() => handlePrint(previewDoc)} 
                  className="px-6 py-4 bg-white/10 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-3 border border-white/5"
                 >
                   <span>🖨️</span> <span>Drucken</span>
                 </button>
                 <button 
                  onClick={() => setPreviewDoc(null)} 
                  className="px-6 py-4 bg-white/10 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-rose-600 transition-all flex items-center gap-3 border border-white/5 ml-4"
                 >
                   <span>✕</span> <span>Schließen</span>
                 </button>
              </div>
           </div>
           <div className="flex-1 w-full max-w-7xl mx-auto bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative flex items-center justify-center">
              {previewDoc.mimeType.startsWith('image') ? (
                <img src={previewDoc.content} className="max-w-full max-h-full object-contain" alt="Dokument" />
              ) : (
                <iframe src={previewDoc.content} className="w-full h-full border-none" title="PDF Vorschau" />
              )}
           </div>
        </div>
      )}

      {/* DELETE DIALOGS */}
      {personToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 z-[200] animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] p-12 text-center shadow-2xl relative overflow-hidden border border-rose-500/20">
              <div className="w-24 h-24 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner animate-pulse">☢️</div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tighter">Person löschen?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-10 font-bold leading-relaxed text-base">Dauerhaft aus dem System entfernen?</p>
              <div className="flex flex-col gap-4">
                 <button onClick={() => { setPersonnel(prev => prev.filter(p => p.id !== personToDelete.id)); onSyncDelete(personToDelete.id); setPersonToDelete(null); }} className="w-full bg-rose-600 text-white font-black py-5 rounded-[1.75rem] uppercase text-sm tracking-widest shadow-xl shadow-rose-500/20 hover:bg-rose-700 transition-colors">JA, LÖSCHEN</button>
                 <button onClick={() => setPersonToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-5 rounded-[1.75rem] uppercase text-sm tracking-widest hover:bg-slate-200 transition-colors">Abbrechen</button>
              </div>
           </div>
        </div>
      )}

      {docToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 z-[300] animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 text-center shadow-2xl relative border border-rose-500/20">
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Dokument löschen?</h3>
              <div className="flex flex-col gap-3">
                 <button onClick={confirmDeleteDoc} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs tracking-widest">Löschen</button>
                 <button onClick={() => setDocToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-2xl uppercase text-xs tracking-widest">Abbrechen</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
