
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
      if (facDropdownRef.current && !facDropdownRef.current.contains(event.target as Node)) setIsFacDropdownOpen(false);
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) setIsFilterDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openModal = (person?: Personnel) => {
    setFormError(null);
    setInvalidFields(new Set());
    if (person) {
      setEditingPerson(person);
      setFormData({ ...person });
    } else {
      setEditingPerson(null);
      setFormData({ firstName: '', lastName: '', facilityIds: [], requiredDocs: ['Gesundheitsausweis', 'Infektionsschutzschulung', 'Masernschutz'], status: 'Active' });
    }
    setFacilitySearch('');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setFormError(null);
    const errors = new Set<string>();
    if (!formData.firstName?.trim()) errors.add('firstName');
    if (!formData.lastName?.trim()) errors.add('lastName');
    if (errors.size > 0) { setInvalidFields(errors); setFormError("Pflichtfelder fehlen."); return; }
    const finalPerson: Personnel = {
      id: editingPerson?.id || `P-${Date.now()}`,
      firstName: formData.firstName!.trim(),
      lastName: formData.lastName!.trim(),
      facilityIds: formData.facilityIds || [],
      requiredDocs: formData.requiredDocs || [],
      status: formData.status || 'Active'
    };
    if (editingPerson) setPersonnel(prev => prev.map(p => p.id === editingPerson.id ? finalPerson : p));
    else setPersonnel(prev => [...prev, finalPerson]);
    onSync(finalPerson);
    setIsModalOpen(false);
  };

  const handleAdminFileUpload = (e: React.ChangeEvent<HTMLInputElement>, personnelId: string, type: PersonnelDocType) => {
    if (!e.target.files?.[0] || !onDocUpload) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      const newDoc: PersonnelDocument = { id: `PDOC-${Date.now()}`, personnelId: personnelId, type: type, content: base64, mimeType: file.type, createdAt: new Date().toISOString(), visibleToUser: true };
      onDocUpload(newDoc);
    };
    reader.readAsDataURL(file);
  };

  const removeFacilityId = (id: string) => setFormData({ ...formData, facilityIds: (formData.facilityIds || []).filter(fid => fid !== id) });
  const toggleDocVisibility = (doc: PersonnelDocument) => onDocUpdate && onDocUpdate({ ...doc, visibleToUser: !doc.visibleToUser });

  const currentFilterName = useMemo(() => {
    if (facilityFilter === 'all') return 'Alle Standorte';
    return facilities.find(f => f.id === facilityFilter)?.name || 'Alle Standorte';
  }, [facilityFilter, facilities]);

  const confirmDeleteDoc = () => { if (docToDelete) { onDocDelete(docToDelete.id); setDocToDelete(null); } };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Personal & Compliance</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Stammdaten & Pflichtdokumente</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
           <button onClick={() => setShowInactive(!showInactive)} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border ${showInactive ? 'bg-slate-900 text-white' : 'bg-white text-slate-400'}`}>{showInactive ? '✅ Inaktive aktiv' : '👁️ Inaktive zeigen'}</button>
           <button onClick={() => openModal()} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl uppercase text-xs tracking-widest">+ Person anlegen</button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        <input type="text" placeholder="Suche..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-6 py-4 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 outline-none font-bold shadow-sm" />
        <div className="relative w-full lg:w-80" ref={filterDropdownRef}>
          <div onClick={() => setIsFilterDropdownOpen(true)} className="w-full px-6 py-4 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 font-black text-xs shadow-sm cursor-pointer flex items-center uppercase">{currentFilterName}</div>
          {isFilterDropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 rounded-[1.75rem] shadow-2xl z-[60] overflow-hidden">
               <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  <button onClick={() => { setFacilityFilter('all'); setIsFilterDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase hover:bg-slate-50">Alle Standorte</button>
                  {filteredFacilitiesList.map(f => <button key={f.id} onClick={() => { setFacilityFilter(f.id); setIsFilterDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase hover:bg-slate-50">{f.name}</button>)}
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPersonnel.map(p => (
          <div key={p.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group">
             <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner">👨‍💼</div>
                <div className="flex gap-2">
                   <button onClick={() => setViewingDocsPerson(p)} className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:scale-110 shadow-sm">👁️</button>
                   <button onClick={() => openModal(p)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:scale-110 shadow-sm">✏️</button>
                   <button onClick={() => setPersonToDelete(p)} className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:scale-110 shadow-sm">🗑️</button>
                </div>
             </div>
             <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{p.firstName} {p.lastName}</h3>
             <div className="pt-8 mt-6 border-t border-slate-50 flex gap-3">
                {DOC_TYPES.map(doc => {
                  const hasDoc = personnelDocs.some(d => d.personnelId === p.id && d.type === doc.type);
                  return <div key={doc.type} className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border ${hasDoc ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg' : 'bg-rose-50 text-rose-500 border-rose-100 shadow-sm'}`}>{hasDoc ? '✅' : doc.icon}</div>;
                })}
             </div>
          </div>
        ))}
      </div>

      {viewingDocsPerson && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden text-left relative">
            <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center">
               <h3 className="text-2xl font-black uppercase tracking-tighter">Compliance: {viewingDocsPerson.firstName} {viewingDocsPerson.lastName}</h3>
               <button onClick={() => setViewingDocsPerson(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-200 text-slate-500 font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
               {DOC_TYPES.map(dt => {
                  const docs = personnelDocs.filter(d => d.personnelId === viewingDocsPerson.id && d.type === dt.type);
                  return (
                    <div key={dt.type} className="bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] p-8 border border-slate-100">
                       <div className="flex items-center justify-between mb-8">
                          <h4 className="text-xl font-black uppercase tracking-tight">{dt.type}</h4>
                          <label className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase cursor-pointer">Upload<input type="file" className="hidden" onChange={(e) => handleAdminFileUpload(e, viewingDocsPerson.id, dt.type)} /></label>
                       </div>
                       <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6">
                          {docs.map(doc => (
                            <div key={doc.id} onClick={() => setPreviewDoc(doc)} className="cursor-pointer group relative">
                               <div className="aspect-[3/4] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 overflow-hidden relative shadow-sm group-hover:shadow-xl">
                                  {doc.mimeType.startsWith('image') ? <img src={doc.content} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black opacity-20">PDF</div>}
                                  <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 p-4">
                                     <button className="w-full bg-white text-slate-900 font-black text-[8px] uppercase tracking-widest py-2 rounded-xl">Vorschau</button>
                                     <button onClick={(e) => { e.stopPropagation(); toggleDocVisibility(doc); }} className="w-full bg-amber-500 text-white font-black text-[8px] uppercase tracking-widest py-2 rounded-xl">{doc.visibleToUser ? 'Verbergen' : 'Zeigen'}</button>
                                     <button onClick={(e) => { e.stopPropagation(); setDocToDelete(doc); }} className="w-full bg-rose-600 text-white font-black text-[8px] uppercase tracking-widest py-2 rounded-xl">Löschen</button>
                                  </div>
                               </div>
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

      {/* ROBUST INTERNAL PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/95 backdrop-blur-2xl flex flex-col p-4 md:p-10 animate-in zoom-in-95">
           <div className="flex justify-between items-center mb-6 text-white max-w-7xl mx-auto w-full">
              <h2 className="text-xl font-black uppercase tracking-tighter">{previewDoc.type} Vorschau</h2>
              <button onClick={() => setPreviewDoc(null)} className="px-8 py-4 bg-white/10 rounded-2xl font-black uppercase text-xs hover:bg-rose-600 transition-all">Schließen</button>
           </div>
           <div className="flex-1 w-full max-w-7xl mx-auto bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex items-center justify-center">
              {previewDoc.mimeType.startsWith('image') ? <img src={previewDoc.content} className="max-w-full max-h-full object-contain" /> : <iframe src={previewDoc.content} className="w-full h-full border-none" />}
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3.5rem] shadow-2xl flex flex-col relative text-left border border-white/10 overflow-hidden">
            <div className="p-10 border-b bg-slate-50/50"><h3 className="text-2xl font-black uppercase tracking-tighter italic">{editingPerson ? 'Bearbeiten' : 'Neu anlegen'}</h3></div>
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold" placeholder="Vorname" />
                <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold" placeholder="Nachname" />
              </div>
            </div>
            <div className="p-8 border-t bg-slate-50/50 flex justify-end space-x-4">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-500 font-black uppercase text-xs">Abbrechen</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-12 py-4 rounded-[1.25rem] font-black uppercase text-xs">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
