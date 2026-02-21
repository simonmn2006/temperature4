
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, User, Facility, AuditLog } from '../types';

interface UsersPageProps {
  t: TranslationSet;
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  facilities: Facility[];
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
  onSync: (user: User) => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({ t, currentUser, users, setUsers, facilities, onLog, onSync }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<Partial<User>>({
    name: '', username: '', email: '', password: '', role: 'User', status: 'Active', facilityId: '', managedFacilityIds: []
  });

  const [facilitySearch, setFacilitySearch] = useState('');
  const [managedSearch, setManagedSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isManagedDropdownOpen, setIsManagedDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const managedDropdownRef = useRef<HTMLDivElement>(null);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (currentUser.role === 'Manager') return matchesSearch && u.role === 'User';
      return matchesSearch;
    });
  }, [users, searchTerm, currentUser.role]);

  const filteredFacilities = useMemo(() => facilities.filter(f => f.name.toLowerCase().includes(facilitySearch.toLowerCase())), [facilities, facilitySearch]);
  const managedFilteredFacilities = useMemo(() => facilities.filter(f => f.name.toLowerCase().includes(managedSearch.toLowerCase()) && !formData.managedFacilityIds?.includes(f.id)), [facilities, managedSearch, formData.managedFacilityIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
      if (managedDropdownRef.current && !managedDropdownRef.current.contains(event.target as Node)) setIsManagedDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showAlert = (text: string, type: 'error' | 'success' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const isFieldDisabled = (fieldName: string) => {
    if (currentUser.role === 'SuperAdmin') return false; 
    if (currentUser.role === 'Admin') return false; 
    if (currentUser.role === 'Manager') return !['name', 'password', 'email'].includes(fieldName);
    return true;
  };

  const getFieldClass = (fieldName: string) => {
    const base = "w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border font-bold text-sm outline-none transition-all";
    if (invalidFields.has(fieldName)) {
      return `${base} border-rose-500 ring-4 ring-rose-500/10 animate-shake`;
    }
    return `${base} border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10`;
  };

  const openModal = (user?: User) => {
    setAlertMsg(null);
    setInvalidFields(new Set());
    if (user) {
      setEditingUser(user);
      setFormData({ ...user, password: '', managedFacilityIds: user.managedFacilityIds || [] }); 
      setFacilitySearch(facilities.find(f => f.id === user.facilityId)?.name || '');
    } else {
      setEditingUser(null);
      setFormData({
        name: '', username: '', email: '', password: '', role: 'User', status: 'Active',
        facilityId: currentUser.role === 'Manager' ? currentUser.facilityId : '',
        managedFacilityIds: []
      });
      setFacilitySearch(currentUser.role === 'Manager' ? (facilities.find(f => f.id === currentUser.facilityId)?.name || '') : '');
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const errors = new Set<string>();
    if (!formData.name?.trim()) errors.add('name');
    if (!formData.username?.trim()) errors.add('username');
    if (!editingUser && !formData.password?.trim()) errors.add('password');

    // Only require email for non-User roles
    if (formData.role !== 'User' && !formData.email?.trim()) {
        errors.add('email');
    }

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert("Bitte Pflichtfelder ausfüllen.", 'error');
      return;
    }

    const finalUser = {
      ...(editingUser || {}),
      ...formData,
      // Clear email if role is standard User to keep DB clean
      email: formData.role === 'User' ? '' : formData.email,
      id: editingUser?.id || `U-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      password: formData.password ? formData.password : editingUser?.password
    } as User;

    if (editingUser) setUsers(prev => prev.map(u => u.id === editingUser.id ? finalUser : u));
    else setUsers(prev => [...prev, finalUser]);
    
    onSync(finalUser);
    onLog(editingUser ? 'UPDATE' : 'CREATE', 'USERS', `Nutzer ${finalUser.name} bearbeitet`);
    setIsModalOpen(false);
  };

  const removeManagedId = (id: string) => {
    setFormData({ ...formData, managedFacilityIds: (formData.managedFacilityIds || []).filter(mid => mid !== id) });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {alertMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-3`}>
             <span className="text-xl">⚠️</span><span className="font-black text-xs uppercase">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Benutzer-Stamm</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Verwaltung von Mitarbeitern und Administration</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl uppercase text-xs">+ Nutzer hinzufügen</button>
      </div>

      <div className="relative w-full max-w-2xl text-left">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input type="text" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm h-[52px]" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Nutzer</th>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Zuweisung</th>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-8 py-6">
                  <span className="font-bold text-slate-900 dark:text-white block">{user.name}</span>
                  <span className={`text-[10px] font-black uppercase ${user.role === 'SuperAdmin' ? 'text-rose-600' : 'text-blue-600'}`}>@{user.username} • {user.role}</span>
                  {user.role !== 'User' && user.email && (
                    <span className="block text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">{user.email}</span>
                  )}
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-wrap gap-1">
                     <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                       Heimat: {facilities.find(f => f.id === user.facilityId)?.name || 'Global'}
                     </span>
                     {user.role === 'Manager' && user.managedFacilityIds?.map(fid => (
                        <span key={fid} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded text-[9px] font-black text-blue-600 uppercase">
                          {facilities.find(f => f.id === fid)?.name || fid}
                        </span>
                     ))}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => openModal(user)} className="p-2 text-blue-600 hover:scale-110 transition-transform">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl flex flex-col relative text-left">
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-8 italic tracking-tighter">
                {editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
            </h3>
            
            <div className="space-y-6 overflow-y-auto max-h-[65vh] pr-2 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Anzeigename</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={getFieldClass('name')} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Rolle</label>
                  <select 
                    disabled={isFieldDisabled('role') && editingUser?.role !== 'SuperAdmin'} 
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value as any})} 
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 font-bold text-sm outline-none"
                  >
                     <option value="User">Standard-User</option>
                     <option value="Manager">Manager</option>
                     <option value="Admin">Administrator</option>
                     {(currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin') && <option value="SuperAdmin">SuperAdmin</option>}
                  </select>
                </div>
              </div>

              {formData.role !== 'User' && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">E-Mail Adresse (Pflicht für Admin/Manager)</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    className={getFieldClass('email')} 
                    placeholder="name@gourmetta.de" 
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Username</label>
                   <input type="text" disabled={isFieldDisabled('username')} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className={getFieldClass('username')} />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Passwort</label>
                   <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={getFieldClass('password')} placeholder="Nur bei Änderung ausfüllen..." />
                 </div>
              </div>

              <div className="relative" ref={dropdownRef}>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Heimat-Standort</label>
                <div className="relative">
                  <input type="text" disabled={isFieldDisabled('facilityId')} value={facilitySearch} onChange={(e) => { setFacilitySearch(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} placeholder="Standort suchen..." className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 font-bold text-sm outline-none disabled:opacity-50" />
                </div>
                {isDropdownOpen && !isFieldDisabled('facilityId') && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    <button onClick={() => { setFormData({...formData, facilityId: ''}); setFacilitySearch('Kein Standort'); setIsDropdownOpen(false); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 font-bold text-sm border-b">Kein Standort (Global)</button>
                    {filteredFacilities.map(f => (
                      <button key={f.id} onClick={() => { setFormData({...formData, facilityId: f.id}); setFacilitySearch(f.name); setIsDropdownOpen(false); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 font-bold text-sm border-b">{f.name}</button>
                    ))}
                  </div>
                )}
              </div>

              {formData.role === 'Manager' && (
                <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-800 space-y-4 animate-in slide-in-from-top-2">
                  <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">Zusätzliche Verwaltung</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.managedFacilityIds?.map(fid => (
                      <button key={fid} onClick={() => removeManagedId(fid)} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center space-x-2">
                        <span>{facilities.find(f => f.id === fid)?.name || fid}</span>
                        <span>✕</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative" ref={managedDropdownRef}>
                    <input type="text" value={managedSearch} onChange={e => { setManagedSearch(e.target.value); setIsManagedDropdownOpen(true); }} onFocus={() => setIsManagedDropdownOpen(true)} className="w-full px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 font-bold text-xs outline-none" placeholder="Weitere Standorte hinzufügen..." />
                    {isManagedDropdownOpen && managedFilteredFacilities.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 rounded-xl shadow-xl z-[60] max-h-48 overflow-y-auto custom-scrollbar">
                        {managedFilteredFacilities.map(f => (
                          <button key={f.id} onClick={() => { setFormData({...formData, managedFacilityIds: [...(formData.managedFacilityIds || []), f.id]}); setIsManagedDropdownOpen(false); setManagedSearch(''); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs uppercase border-b last:border-0 border-slate-50 dark:border-slate-800">{f.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10 flex justify-end space-x-4">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-black uppercase text-xs">Abbrechen</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl uppercase text-xs tracking-widest hover:scale-105 transition-transform">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
