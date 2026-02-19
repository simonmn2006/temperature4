
import React, { useState, useMemo, useEffect } from 'react';
import { User, Refrigerator, Menu, Assignment, Reading, TranslationSet, RefrigeratorType, CookingMethod, Facility, Checkpoint, FacilityException, Alert, FormResponse, FacilityType } from '../types';

interface GroupedItem {
  id: string;
  name: string;
  type: 'refrigerator' | 'menu';
  checkpoints: any[];
  colorClass: string;
}

interface UserWorkspaceProps {
  t: TranslationSet;
  user: User;
  fridges: Refrigerator[];
  menus: Menu[];
  assignments: Assignment[];
  readings: Reading[];
  onSave: (reading: Reading, alert?: Alert) => void;
  fridgeTypes: RefrigeratorType[];
  cookingMethods: CookingMethod[];
  facilities: Facility[];
  excludedFacilities: FacilityException[];
  facilityTypes: FacilityType[];
  onViolation: (alert: Alert) => void;
  formResponses: FormResponse[];
}

export const UserWorkspace: React.FC<UserWorkspaceProps> = ({ 
  t, user, fridges, menus, assignments, readings, onSave, fridgeTypes, cookingMethods, facilities, excludedFacilities, facilityTypes, onViolation, formResponses
}) => {
  const [now, setNow] = useState(new Date());
  const [draftTemps, setDraftTemps] = useState<Record<string, string>>({});
  const [draftReasons, setDraftReasons] = useState<Record<string, string>>({});
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());

  // Site Switching logic for Managers
  const availableFacilityIds = useMemo(() => {
    const list = new Set<string>();
    if (user.facilityId) list.add(user.facilityId);
    if (user.managedFacilityIds) user.managedFacilityIds.forEach(id => list.add(id));
    return Array.from(list);
  }, [user.facilityId, user.managedFacilityIds]);

  const [activeFacilityId, setActiveFacilityId] = useState<string>(user.facilityId || availableFacilityIds[0] || '');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const isWeekend = useMemo(() => [0, 6].includes(now.getDay()), [now]);

  const activeFacility = useMemo(() => facilities.find(f => f.id === activeFacilityId), [facilities, activeFacilityId]);

  const activeExclusion = useMemo(() => {
    if (!activeFacilityId) return null;
    return (excludedFacilities || []).find(ex => 
      ex.facilityIds.includes(activeFacilityId) && 
      todayStr >= ex.startDate && todayStr <= ex.endDate
    );
  }, [excludedFacilities, activeFacilityId, todayStr]);

  const groupedActiveItems = useMemo(() => {
    if (!user || !activeFacilityId || activeExclusion) return [];
    
    const assignedFridges = isWeekend ? [] : (fridges || []).filter(f => f.facilityId === activeFacilityId);
    
    // Unique Menu assignments per day - ensures a menu assigned multiple ways only shows once
    const assignedMenuIdsSet = new Set((assignments || [])
      .filter(a => {
        if (a.resourceType !== 'menu') return false;
        const isUserMatch = a.targetType === 'user' && a.targetId === user.id;
        const isFacMatch = a.targetType === 'facility' && a.targetId === activeFacilityId;
        const isTypeMatch = a.targetType === 'facilityType' && a.targetId === activeFacility?.typeId;
        if (!(isUserMatch || isFacMatch || isTypeMatch)) return false;
        const isActive = todayStr >= a.startDate && todayStr <= a.endDate;
        const isSkippedWeekend = a.skipWeekend && isWeekend;
        return isActive && !isSkippedWeekend;
      })
      .map(a => a.resourceId));

    const assignedMenuIds = Array.from(assignedMenuIdsSet);
    const groups: Record<string, GroupedItem> = {};

    assignedFridges.forEach(f => {
      const type = fridgeTypes.find(t => t.name === f.typeName);
      const cps = type?.checkpoints || [{ name: 'Temperatur', minTemp: 2, maxTemp: 7 }];
      const activeCps = cps.filter(cp => {
        // LEAVING SCREEN logic: check if a reading was already saved TODAY for this checkpoint
        return !(readings || []).some(r => {
          const rDate = r.timestamp.includes('T') ? r.timestamp.split('T')[0] : r.timestamp.split(' ')[0];
          return r.targetId === f.id && r.checkpointName === cp.name && rDate === todayStr;
        });
      }).map(cp => ({ ...cp, uniqueKey: `fridge-${f.id}-${cp.name}` }));
      
      if (activeCps.length > 0) {
        groups[f.id] = { id: f.id, name: f.name, type: 'refrigerator', checkpoints: activeCps, colorClass: 'border-slate-400 bg-slate-100 text-slate-700' };
      }
    });

    assignedMenuIds.forEach(mId => {
      const menu = menus.find(m => m.id === mId);
      if (!menu) return;
      const method = cookingMethods.find(m => m.id === activeFacility?.cookingMethodId);
      const cps = method?.checkpoints || [{ name: 'Kern-Temperatur', minTemp: 72, maxTemp: 95 }];
      const activeCps = cps.filter(cp => {
        // LEAVING SCREEN logic: check if reading exists for TODAY
        return !(readings || []).some(r => {
          const rDate = r.timestamp.includes('T') ? r.timestamp.split('T')[0] : r.timestamp.split(' ')[0];
          return r.targetId === menu.id && r.checkpointName === cp.name && rDate === todayStr;
        });
      }).map(cp => ({ ...cp, uniqueKey: `menu-${menu.id}-${cp.name}` }));

      if (activeCps.length > 0) {
        groups[menu.id] = { id: menu.id, name: menu.name, type: 'menu', checkpoints: activeCps, colorClass: 'border-blue-500 bg-blue-50 text-blue-700' };
      }
    });
    
    return Object.values(groups);
  }, [fridges, assignments, menus, user, activeFacilityId, activeFacility, fridgeTypes, cookingMethods, readings, todayStr, activeExclusion, isWeekend]);

  const updateTemp = (key: string, delta: number, baseValue: number) => {
    const currentStr = draftTemps[key] ?? baseValue.toString();
    const nextVal = Math.round((parseFloat(currentStr) + delta) * 10) / 10;
    setDraftTemps({ ...draftTemps, [key]: nextVal.toString() });
  };

  const lockReading = (parent: GroupedItem, cp: any) => {
    if (lockingIds.has(cp.uniqueKey)) return;

    const val = draftTemps[cp.uniqueKey] ? parseFloat(draftTemps[cp.uniqueKey]) : parseFloat(cp.minTemp.toString());
    const min = parseFloat(cp.minTemp.toString());
    const max = parseFloat(cp.maxTemp.toString());
    const isOutOfRange = val < min || val > max;
    const reason = draftReasons[cp.uniqueKey] || '';

    if (isOutOfRange && !reason.trim()) {
      alert("Bitte geben Sie einen Grund für die Temperatur-Abweichung an.");
      return;
    }

    setLockingIds(prev => {
      const next = new Set(prev);
      next.add(cp.uniqueKey);
      return next;
    });
    
    const timestamp = new Date().toISOString();
    const reading: Reading = { 
      id: `READ-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, 
      targetId: parent.id, 
      targetType: parent.type, 
      checkpointName: cp.name, 
      value: val, 
      timestamp, 
      userId: user.id, 
      facilityId: activeFacilityId, 
      isLocked: true, 
      reason: isOutOfRange ? reason : undefined 
    };

    let alertData: Alert | undefined = isOutOfRange ? { 
      id: `ALRT-${Date.now()}`, 
      facilityId: activeFacilityId, 
      facilityName: activeFacility?.name || '?', 
      targetName: parent.name, 
      checkpointName: cp.name, 
      value: val, 
      min, 
      max, 
      timestamp, 
      userId: user.id, 
      userName: user.name, 
      resolved: false 
    } : undefined;

    // IMMEDIATE SAVE: Triggers state update in App.tsx which re-filters and removes this card
    onSave(reading, alertData);

    // Reset local drafting states
    const nextDraftTemps = { ...draftTemps };
    delete nextDraftTemps[cp.uniqueKey];
    setDraftTemps(nextDraftTemps);

    const nextDraftReasons = { ...draftReasons };
    delete nextDraftReasons[cp.uniqueKey];
    setDraftReasons(nextDraftReasons);

    setLockingIds(prev => {
      const next = new Set(prev);
      next.delete(cp.uniqueKey);
      return next;
    });
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
           <div className="flex items-center space-x-6">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">📍</div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Aktueller Standort</p>
                 {availableFacilityIds.length > 1 ? (
                   <select 
                     value={activeFacilityId} 
                     onChange={e => setActiveFacilityId(e.target.value)}
                     className="bg-transparent border-none font-black text-xl lg:text-2xl text-slate-900 dark:text-white uppercase tracking-tighter outline-none cursor-pointer hover:text-blue-600 transition-colors"
                   >
                      {availableFacilityIds.map(fid => (
                        <option key={fid} value={fid} className="text-sm">{facilities.find(f => f.id === fid)?.name || fid}</option>
                      ))}
                   </select>
                 ) : (
                   <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{activeFacility?.name || 'Kein Standort'}</h2>
                 )}
              </div>
           </div>
        </div>
        <div className="flex-1 bg-slate-900 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-2xl">
           <div className="space-y-0.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Digitale HACCP-Uhr</p>
              <h2 className="text-3xl font-black font-mono tracking-tighter text-blue-400">{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</h2>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{now.toLocaleDateString('de-DE', { weekday: 'long' })}</p>
              <p className="text-sm font-bold">{now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}</p>
           </div>
        </div>
      </div>

      <div className="space-y-10">
        {activeExclusion ? (
          <div className="bg-white dark:bg-slate-900 min-h-[300px] rounded-[3.5rem] border border-slate-100 flex flex-col items-center justify-center p-12 text-center shadow-xl">
             <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">🚫</div>
             <h2 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Betriebspause</h2>
             <p className="text-slate-500 font-medium max-w-sm">{activeExclusion.reason}</p>
          </div>
        ) : groupedActiveItems.length > 0 ? (
          groupedActiveItems.map((group) => (
            <div key={group.id} className={`bg-white dark:bg-slate-900 rounded-[3rem] border-l-[12px] shadow-xl overflow-hidden ${group.colorClass.split(' ')[0]}`}>
               <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/20">
                  <div className="flex items-center space-x-4">
                     <span className="text-3xl">{group.type === 'refrigerator' ? '❄️' : '🍽️'}</span>
                     <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{group.name}</h2>
                  </div>
               </div>
               <div className="p-8 space-y-10">
                  {group.checkpoints.map(cp => {
                     const val = parseFloat(draftTemps[cp.uniqueKey] ?? cp.minTemp.toString());
                     const isOutOfRange = val < parseFloat(cp.minTemp) || val > parseFloat(cp.maxTemp);
                     const isLocking = lockingIds.has(cp.uniqueKey);
                     
                     return (
                       <div key={cp.uniqueKey} className={`p-8 rounded-[2.5rem] border-2 transition-all ${isOutOfRange ? 'bg-rose-50/20 border-rose-200' : 'bg-white border-slate-100 dark:border-slate-800'}`}>
                          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                             <div>
                                <h4 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{cp.name}</h4>
                                <span className="px-4 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Bereich: {cp.minTemp}° - {cp.maxTemp}°C</span>
                             </div>
                             <div className="flex items-center space-x-6">
                                <div className={`flex items-center bg-white dark:bg-slate-800 rounded-3xl p-3 border-2 shadow-xl ${isOutOfRange ? 'border-rose-500' : 'border-slate-50'}`}>
                                   <button onClick={() => updateTemp(cp.uniqueKey, -0.5, parseFloat(cp.minTemp))} className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 text-blue-600 text-3xl font-black shadow-sm">-</button>
                                   <input type="text" value={draftTemps[cp.uniqueKey] ?? cp.minTemp} onChange={e => setDraftTemps({...draftTemps, [cp.uniqueKey]: e.target.value})} className={`w-36 text-center bg-transparent border-none font-black text-5xl font-mono ${isOutOfRange ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`} />
                                   <button onClick={() => updateTemp(cp.uniqueKey, 0.5, parseFloat(cp.minTemp))} className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 text-blue-600 text-3xl font-black shadow-sm">+</button>
                                </div>
                                <button 
                                  onClick={() => lockReading(group, cp)} 
                                  disabled={isLocking || (isOutOfRange && !draftReasons[cp.uniqueKey]?.trim())} 
                                  className={`w-20 h-20 rounded-3xl flex items-center justify-center text-2xl transition-all shadow-xl ${isLocking ? 'bg-slate-400 animate-pulse' : (isOutOfRange && !draftReasons[cp.uniqueKey]?.trim() ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:scale-110 active:scale-95')}`}
                                >
                                   {isLocking ? '⏳' : (isOutOfRange && !draftReasons[cp.uniqueKey]?.trim() ? '⚠️' : '🔒')}
                                </button>
                          </div>
                          </div>
                          {isOutOfRange && (
                            <div className="mt-8 animate-in slide-in-from-top-4">
                               <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 px-1">Pflichtfeld: Begründung für Grenzwert-Abweichung</label>
                               <textarea 
                                 value={draftReasons[cp.uniqueKey] || ''} 
                                 onChange={e => setDraftReasons({...draftReasons, [cp.uniqueKey]: e.target.value})} 
                                 placeholder="Warum weicht die Temperatur ab? (z.B. Abtauphase, Tür offen, etc.)" 
                                 className="w-full p-6 rounded-[2rem] bg-rose-50/50 border-2 border-rose-100 font-bold text-slate-900 outline-none focus:border-rose-500 transition-all min-h-[120px]" 
                               />
                            </div>
                          )}
                       </div>
                     );
                  })}
               </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[3.5rem] border-4 border-dashed border-slate-100">
             <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner animate-bounce">🏆</div>
             <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Bereit für heute</h3>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Alle Messungen für diesen Standort wurden erfasst.</p>
          </div>
        )}
      </div>
    </div>
  );
};
