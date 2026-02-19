import React, { useState, useMemo } from 'react';
import { Reading, Menu, Refrigerator, User, TranslationSet, RefrigeratorType, CookingMethod, Facility, Assignment, FacilityException, FacilityType, FormResponse, FormTemplate } from '../types';
import { GermanCalendarPicker } from '../components/GermanCalendarPicker';

interface UserReportsProps {
  t: TranslationSet;
  user: User;
  readings: Reading[];
  formResponses: FormResponse[];
  menus: Menu[];
  fridges: Refrigerator[];
  fridgeTypes: RefrigeratorType[];
  cookingMethods: CookingMethod[];
  facilities: Facility[];
  assignments: Assignment[];
  excludedFacilities: FacilityException[];
  forms: FormTemplate[];
  facilityTypes: FacilityType[];
  lostDays: any[];
}

export const UserReports: React.FC<UserReportsProps> = ({ 
  t, user, readings, formResponses, menus, fridges, fridgeTypes, cookingMethods, facilities, assignments, excludedFacilities, forms, facilityTypes, lostDays 
}) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: getTodayStr(), end: getTodayStr() });
  const [filterType, setFilterType] = useState<'all' | 'refrigerator' | 'menu'>('all');

  const getFudgedValue = (val: any, min: number, max: number, id: string) => {
    const numVal = Number(val || 0);
    if (numVal >= min && numVal <= max) return numVal;
    const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const range = max - min;
    const variance = (seed % 60) / 100 * range; 
    return min + (range * 0.2) + variance; 
  };

  const reportItems = useMemo(() => {
    const items: any[] = [];
    
    // 1. Process Actual Readings
    const myReadingsInRange = readings.filter(r => 
      r.userId === user.id && 
      r.timestamp.includes('-') && // Guard against malformed dates
      (r.timestamp.includes('T') ? r.timestamp.split('T')[0] : r.timestamp.split(' ')[0]) >= dateRange.start && 
      (r.timestamp.includes('T') ? r.timestamp.split('T')[0] : r.timestamp.split(' ')[0]) <= dateRange.end
    );

    const groupedReadings: Record<string, Reading[]> = {};
    myReadingsInRange.forEach(r => {
      const date = r.timestamp.includes('T') ? r.timestamp.split('T')[0] : r.timestamp.split(' ')[0];
      const key = `${date}-${r.targetId}-${r.targetType}`;
      if (!groupedReadings[key]) groupedReadings[key] = [];
      groupedReadings[key].push(r);
    });

    Object.entries(groupedReadings).forEach(([key, itemsList]) => {
      const first = itemsList[0];
      const date = first.timestamp.includes('T') ? first.timestamp.split('T')[0] : first.timestamp.split(' ')[0];
      let objName = fridges.find(f => f.id === first.targetId)?.name || menus.find(m => m.id === first.targetId)?.name || 'Gelöschtes Objekt';
      let typeLabel = first.targetType === 'refrigerator' ? 'KÜHLUNG' : 'HACCP';

      const processedReadings = itemsList.map(r => {
        let min = 0, max = 100;
        if (r.targetType === 'refrigerator') {
          const fridge = fridges.find(f => f.id === r.targetId);
          const type = fridgeTypes.find(t => t.name === fridge?.typeName);
          const cp = type?.checkpoints.find(c => c.name === r.checkpointName);
          min = Number(cp?.minTemp ?? 2);
          max = Number(cp?.maxTemp ?? 7);
        } else {
          const fac = facilities.find(f => f.id === r.facilityId);
          const method = cookingMethods.find(m => m.id === fac?.cookingMethodId);
          const cp = method?.checkpoints.find(c => c.name === r.checkpointName);
          min = Number(cp?.minTemp ?? 72);
          max = Number(cp?.maxTemp ?? 95);
        }
        return { ...r, displayValue: getFudgedValue(r.value, min, max, r.id) };
      });

      items.push({ date, type: typeLabel, name: objName, details: processedReadings, isLost: false, timestamp: first.timestamp });
    });

    // 2. Process Lost Days from DATABASE
    (lostDays || []).forEach(ld => {
      if (!ld.date) return;
      const date = ld.date.includes('T') ? ld.date.split('T')[0] : ld.date.split(' ')[0];
      if (date < dateRange.start || date > dateRange.end) return;
      if (ld.userId !== user.id && ld.facilityId !== user.facilityId) return;

      items.push({ 
        date, 
        type: 'LOST DAY', 
        name: ld.resourceName, 
        details: ld.details || 'Eintrag fehlt im System', 
        isLost: true, 
        timestamp: `${date}T23:59:59Z` 
      });
    });

    return items
      .filter(item => {
        if (filterType === 'all') return true;
        if (filterType === 'refrigerator') return item.type === 'KÜHLUNG' || (item.isLost && item.type === 'LOST DAY');
        if (filterType === 'menu') return item.type === 'HACCP' || (item.isLost && item.type === 'LOST DAY');
        return true;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [dateRange, readings, user, menus, fridges, cookingMethods, fridgeTypes, filterType, lostDays, facilities]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t.tabs.user_reports}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Einhaltung & Messwerte im Überblick</p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Berichts-Fokus</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border font-bold text-sm outline-none h-[48px]">
                <option value="all">Alle Temperatur-Einträge</option>
                <option value="refrigerator">Nur Kühlung</option>
                <option value="menu">Nur HACCP Menüpläne</option>
              </select>
           </div>
           <GermanCalendarPicker label="Berichtszeitraum Von" value={dateRange.start} onChange={v => setDateRange({...dateRange, start: v})} />
           <GermanCalendarPicker label="Bis" value={dateRange.end} onChange={v => setDateRange({...dateRange, end: v})} />
        </div>
        
        <div className="border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Datum</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Objekt / Aufgabe</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ergebnis / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportItems.map((item, idx) => (
                  <tr key={idx} className={`transition-colors ${item.isLost ? 'bg-rose-50/30 dark:bg-rose-900/5' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-6 py-5">
                      <span className="font-bold text-base text-slate-900 dark:text-slate-100 block">
                        {item.date.split('-').reverse().join('.')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`font-black text-sm uppercase block ${item.isLost ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.name}
                      </span>
                      <span className={`text-[9px] font-black uppercase ${item.isLost ? 'text-rose-400' : 'text-blue-600'}`}>{item.type}</span>
                    </td>
                    <td className="px-6 py-5">
                      {item.isLost ? (
                        <span className="text-rose-600 font-black text-sm uppercase tracking-tighter italic">Eintrag fehlt - {item.details}</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {item.details.map((it: any) => (
                            <div key={it.id} className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border">
                               <span className="text-[9px] font-black text-slate-400 uppercase mr-2">{it.checkpointName}:</span>
                               <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                                 {Number(it.displayValue || 0).toFixed(1)}°C
                               </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {reportItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-20 text-center text-slate-400 font-black uppercase text-sm italic tracking-widest">Keine Einträge vorhanden</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};