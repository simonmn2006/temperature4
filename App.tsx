
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AdminTab, User, Facility, Refrigerator, Assignment, Menu, FormTemplate, Reading, FormResponse, RefrigeratorType, CookingMethod, FacilityType, Holiday, FacilityException, Alert, AuditLog, ReminderConfig, Document, Personnel, PersonnelDocument } from './types';
import { germanTranslations as t } from './translations';
import { Login } from './pages/Login';
import { DashboardLayout } from './components/DashboardLayout';
import { UserDashboardLayout } from './components/UserDashboardLayout';
import { UsersPage } from './pages/Users';
import { FacilitiesPage } from './pages/Facilities';
import { RefrigeratorsPage } from './pages/Refrigerators';
import { MenusPage } from './pages/Menus';
import { FormCreatorPage } from './pages/FormCreator';
import { AssignmentsPage } from './pages/Assignments';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { BackupSyncPage } from './pages/BackupSync';
import { AuditLogsPage } from './pages/AuditLogs';
import { UserWorkspace } from './pages/UserWorkspace';
import { UserForms } from './pages/UserForms';
import { UserReports } from './pages/UserReports';
import { FacilityAnalyticsPage } from './pages/FacilityAnalytics';
import { RemindersPage } from './pages/Reminders';
import { DocumentsPage } from './pages/Documents';
import { UserLibrary } from './pages/UserLibrary';
import { DashboardPage } from './pages/Dashboard';
import { UserAcademy } from './pages/UserAcademy';
import { PersonnelPage } from './pages/Personnel';
import { UserPersonnelDocs } from './pages/UserPersonnelDocs';

const API_BASE = `http://${window.location.hostname || 'localhost'}:3001/api`;

const openDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('gourmetta_offline_v3', 3);
    request.onupgradeneeded = (event: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('data_cache')) db.createObjectStore('data_cache', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const App: React.FC = () => {
  const [backendError, setBackendError] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);
  const [isSyncingInProgress, setIsSyncingInProgress] = useState<boolean>(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('gourmetta_auth') === 'true' || sessionStorage.getItem('gourmetta_auth') === 'true';
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('gourmetta_user') || sessionStorage.getItem('gourmetta_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [forcedRoleView, setForcedRoleView] = useState<'admin' | 'user' | null>(() => {
    const saved = localStorage.getItem('gourmetta_user') || sessionStorage.getItem('gourmetta_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        const savedView = localStorage.getItem('gourmetta_view') || (['Admin', 'SuperAdmin', 'Manager'].includes(u.role) ? 'admin' : 'user');
        return savedView as 'admin' | 'user';
      } catch (e) { return null; }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedUser = localStorage.getItem('gourmetta_user') || sessionStorage.getItem('gourmetta_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        const view = localStorage.getItem('gourmetta_view') || (['Admin', 'SuperAdmin', 'Manager'].includes(u.role) ? 'admin' : 'user');
        return view === 'admin' ? AdminTab.DASHBOARD : 'user_workspace';
      } catch (e) {}
    }
    return AdminTab.DASHBOARD;
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [fridges, setFridges] = useState<Refrigerator[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [personnelDocs, setPersonnelDocs] = useState<PersonnelDocument[]>([]);
  const [impactStats, setImpactStats] = useState<any>({pagesSaved: 0, tonerSaved: 0});
  const [reminders, setReminders] = useState<ReminderConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [fridgeTypes, setFridgeTypes] = useState<RefrigeratorType[]>([]);
  const [cookingMethods, setCookingMethods] = useState<CookingMethod[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [excludedFacilities, setExcludedFacilities] = useState<FacilityException[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [legalTexts, setLegalTexts] = useState({ imprint: "Gourmetta GmbH", privacy: "Datenschutz" });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveToCache = async (key: string, data: any) => {
    try {
      const db = await openDB();
      const tx = db.transaction('data_cache', 'readwrite');
      tx.objectStore('data_cache').put({ key, data });
    } catch (e) {}
  };

  const getFromCache = async (key: string) => {
    try {
      const db = await openDB();
      return new Promise<any>((resolve) => {
        const tx = db.transaction('data_cache', 'readonly');
        const req = tx.objectStore('data_cache').get(key);
        req.onsuccess = () => resolve(req.result?.data || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  };

  const refreshQueueCount = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const countReq = store.count();
      countReq.onsuccess = () => setSyncQueueCount(countReq.result);
    } catch (e) {}
  }, []);

  useEffect(() => { refreshQueueCount(); }, [refreshQueueCount]);

  useEffect(() => {
    const endpoints: [string, string, (v: any) => void][] = [
      ['users', 'users', setUsers], 
      ['facilities', 'facilities', setFacilities], 
      ['refrigerators', 'refrigerators', setFridges], 
      ['menus', 'menus', setMenus], 
      ['assignments', 'assignments', setAssignments], 
      ['reminders', 'reminders', setReminders],
      ['readings', 'readings', setReadings], 
      ['form-responses', 'form-responses', setFormResponses], 
      ['form-templates', 'forms', setForms], 
      ['documents', 'documents', setDocuments], 
      ['personnel', 'personnel', setPersonnel],
      ['personnel-docs', 'personnelDocs', setPersonnelDocs],
      ['impact-stats', 'impact', setImpactStats], 
      ['audit-logs', 'audit', setAuditLogs], 
      ['alerts', 'alerts', setAlerts],
      ['settings/exceptions', 'exceptions', setExcludedFacilities],
      ['settings/legal', 'legal', setLegalTexts],
      ['settings/holidays', 'holidays', setHolidays], 
      ['settings/fridge-types', 'fridgeTypes', setFridgeTypes], 
      ['settings/cooking-methods', 'cookingMethods', setCookingMethods], 
      ['settings/facility-types', 'facilityTypes', setFacilityTypes]
    ];

    const load = async () => {
      for (const [_, key, setter] of endpoints) {
        const cached = await getFromCache(key);
        if (cached) setter(cached);
      }
      setIsInitialLoadDone(true);
      
      for (const [path, key, setter] of endpoints) {
        try {
          const res = await fetch(`${API_BASE}/${path}`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            if (data !== null) {
              setter(data);
              saveToCache(key, data);
            }
            setBackendError(false);
          }
        } catch (e) { 
          setBackendError(true); 
        }
      }
    };
    load();
  }, []);

  const addToSyncQueue = useCallback(async (endpoint: string, data: any, method: string) => {
    try {
      const db = await openDB();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').add({ endpoint, data, method, createdAt: new Date().toISOString() });
      await refreshQueueCount();
    } catch (e) {}
  }, [refreshQueueCount]);

  const processSyncQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncingInProgress) return;
    try {
      const db = await openDB();
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();
      request.onsuccess = async () => {
        const items = request.result;
        if (items.length === 0) return;
        setIsSyncingInProgress(true);
        for (const item of items) {
          try {
            const url = item.method === 'DELETE' ? `${API_BASE}/${item.endpoint}/${item.data}` : `${API_BASE}/${item.endpoint}`;
            const res = await fetch(url, { method: item.method, headers: item.method === 'POST' ? { 'Content-Type': 'application/json' } : {}, body: item.method === 'POST' ? JSON.stringify(item.data) : null });
            if (res.ok) {
              const delTx = db.transaction('sync_queue', 'readwrite');
              delTx.objectStore('sync_queue').delete(item.id);
            } else break;
          } catch (err) { break; }
        }
        setIsSyncingInProgress(false);
        await refreshQueueCount();
      };
    } catch (e) { setIsSyncingInProgress(false); }
  }, [refreshQueueCount, isSyncingInProgress]);

  useEffect(() => { if (isOnline) processSyncQueue(); }, [isOnline, processSyncQueue]);

  const sync = useCallback(async (endpoint: string, data: any, method: 'POST' | 'DELETE' = 'POST') => {
    const setterMap: Record<string, [string, (v: any) => void]> = {
      'users': ['users', setUsers], 
      'facilities': ['facilities', setFacilities], 
      'refrigerators': ['refrigerators', setFridges], 
      'menus': ['menus', setMenus], 
      'assignments': ['assignments', setAssignments], 
      'reminders': ['reminders', setReminders],
      'readings': ['readings', setReadings], 
      'form-responses': ['form-responses', setFormResponses],
      'form-templates': ['forms', setForms], 
      'documents': ['documents', setDocuments], 
      'personnel': ['personnel', setPersonnel],
      'personnel-docs': ['personnelDocs', setPersonnelDocs],
      'alerts': ['alerts', setAlerts],
      'settings/exceptions': ['exceptions', setExcludedFacilities],
      'settings/legal': ['legal', setLegalTexts],
      'settings/holidays': ['holidays', setHolidays],
      'settings/fridge-types': ['fridgeTypes', setFridgeTypes], 
      'settings/cooking-methods': ['cookingMethods', setCookingMethods],
      'settings/facility-types': ['facilityTypes', setFacilityTypes]
    };

    if (setterMap[endpoint]) {
      const [key, setter] = setterMap[endpoint];
      setter((prev: any) => {
        if (endpoint === 'settings/legal') {
           saveToCache(key, data);
           return data;
        }
        let newList = Array.isArray(prev) ? [...prev] : [];
        if (method === 'DELETE') {
          const idToDelete = typeof data === 'object' ? data.id : data;
          newList = newList.filter((i: any) => i.id !== idToDelete);
        } else {
          const idx = newList.findIndex((i: any) => i.id === data.id);
          if (idx > -1) newList[idx] = data; else newList.unshift(data);
        }
        saveToCache(key, newList);
        return newList;
      });
    }

    if (endpoint === 'form-responses' && method === 'POST') {
       fetch(`${API_BASE}/impact-stats`).then(r => r.json()).then(setImpactStats).catch(() => {});
    }

    if (!navigator.onLine) {
      setBackendError(true);
      addToSyncQueue(endpoint, data, method);
      return;
    }

    try {
      const url = method === 'DELETE' ? `${API_BASE}/${endpoint}/${typeof data === 'object' ? data.id : data}` : `${API_BASE}/${endpoint}`;
      const res = await fetch(url, { method, headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {}, body: method === 'POST' ? JSON.stringify(data) : null });
      if (!res.ok) throw new Error();
      setBackendError(false);
    } catch (err) {
      setBackendError(true);
      addToSyncQueue(endpoint, data, method);
    }
  }, [addToSyncQueue]);

  const handleLogin = (username: string, password?: string, stayLoggedIn?: boolean) => {
    setLoginError(null);
    const u = users.find(x => x.username.toLowerCase() === username.toLowerCase() && x.password === password) || 
            (username === 'super' && password === 'super' ? {id:'U-SUPER', name:'System SuperAdmin', role:'SuperAdmin', status:'Active', username:'super', email:'alarm@gourmetta.de'} : null);
    
    if (u) {
      // Automatically detect view based on role
      const isAdminRole = ['Admin', 'SuperAdmin', 'Manager'].includes(u.role);
      let finalView: 'admin' | 'user' = isAdminRole ? 'admin' : 'user';

      setCurrentUser(u as User);
      setIsAuthenticated(true);
      setForcedRoleView(finalView);
      
      const storage = stayLoggedIn ? localStorage : sessionStorage;
      storage.setItem('gourmetta_auth', 'true');
      storage.setItem('gourmetta_user', JSON.stringify(u));
      storage.setItem('gourmetta_view', finalView);
      
      const destinationTab = (finalView === 'admin') ? AdminTab.DASHBOARD : 'user_workspace';
      setActiveTab(destinationTab);
      sync('audit-logs', { userId: u.id, userName: u.name, action: 'LOGIN', entity: 'SYSTEM', details: `Login detected as ${finalView}` });
    } else {
      setLoginError("Ungültiger Benutzername oder Passwort.");
      setTimeout(() => setLoginError(null), 3000);
    }
  };

  const activeAlerts = useMemo(() => (alerts || []).filter(a => !a.resolved), [alerts]);

  if (!isInitialLoadDone) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto shadow-xl" />
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter">gourmetta</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System-Start...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Login t={t} onLogin={handleLogin} users={users} legalTexts={legalTexts} backendOffline={backendError} loginError={loginError} />;
  }

  const isAdminView = forcedRoleView === 'admin' && ['Admin', 'Manager', 'SuperAdmin'].includes(currentUser.role);

  return (
    <div className="relative min-h-screen">
      {isAdminView ? (
        <DashboardLayout t={t} currentUser={currentUser} activeTab={activeTab as AdminTab} onTabChange={setActiveTab} onLogout={() => { setIsAuthenticated(false); setCurrentUser(null); setForcedRoleView(null); localStorage.clear(); sessionStorage.clear(); }} alerts={activeAlerts} backendOffline={!isOnline || backendError}>
          {activeTab === AdminTab.USERS ? <UsersPage t={t} currentUser={currentUser} users={users} setUsers={setUsers} facilities={facilities} onLog={(a, e, d) => sync('audit-logs', { userId: currentUser.id, userName: currentUser.name, action: a, entity: e, details: d })} onSync={u => sync('users', u)} /> :
           activeTab === AdminTab.FACILITIES ? <FacilitiesPage t={t} facilities={facilities} setFacilities={setFacilities} facilityTypes={facilityTypes} cookingMethods={cookingMethods} users={users} fridges={fridges} onLog={(a, e, d) => sync('audit-logs', { userId: currentUser.id, userName: currentUser.name, action: a, entity: e, details: d })} onSync={f => sync('facilities', f)} onTabChange={setActiveTab as any} /> :
           activeTab === AdminTab.REFRIGERATORS ? <RefrigeratorsPage t={t} facilities={facilities} setFacilities={setFacilities} fridges={fridges} setFridges={setFridges} fridgeTypes={fridgeTypes} users={users} setUsers={setUsers} setAssignments={setAssignments} onLog={(a, e, d) => sync('audit-logs', { userId: currentUser.id, userName: currentUser.name, action: a, entity: e, details: d })} setAlerts={setAlerts} onSync={r => sync('refrigerators', r)} onSyncDelete={id => sync('refrigerators', id, 'DELETE')} /> :
           activeTab === AdminTab.MENUS ? <MenusPage t={t} menus={menus} setMenus={setMenus} onSync={m => sync('menus', m)} onSyncDelete={id => sync('menus', id, 'DELETE')} /> :
           activeTab === AdminTab.FORM_CREATOR ? <FormCreatorPage t={t} forms={forms} setForms={setForms} onSync={f => sync('form-templates', f)} onSyncDelete={id => sync('form-templates', id, 'DELETE')} /> :
           activeTab === AdminTab.DOCUMENTS ? <DocumentsPage t={t} documents={documents} setDocuments={setDocuments} onSync={d => sync('documents', d)} onSyncDelete={id => sync('documents', id, 'DELETE')} onLog={(a, e, d) => sync('audit-logs', { userId: currentUser.id, userName: currentUser.name, action: a, entity: e, details: d })} /> :
           activeTab === AdminTab.PERSONNEL ? <PersonnelPage t={t} personnel={personnel} setPersonnel={setPersonnel} facilities={facilities} personnelDocs={personnelDocs} onSync={p => sync('personnel', p)} onSyncDelete={id => sync('personnel', id, 'DELETE')} onDocDelete={id => sync('personnel-docs', id, 'DELETE')} onDocUpdate={d => sync('personnel-docs', d)} onDocUpload={d => sync('personnel-docs', d)} /> :
           activeTab === AdminTab.ASSIGNMENTS ? <AssignmentsPage t={t} assignments={assignments} setAssignments={setAssignments} users={users} facilities={facilities} forms={forms} menus={menus} facilityTypes={facilityTypes} onTabChange={setActiveTab as any} onSync={a => sync('assignments', a)} onSyncDelete={id => sync('assignments', id, 'DELETE')} /> :
           activeTab === AdminTab.REPORTS ? <ReportsPage t={t} currentUser={currentUser} readings={readings} formResponses={formResponses} menus={menus} fridges={fridges} users={users} facilities={facilities} excludedFacilities={excludedFacilities} forms={forms} assignments={assignments} /> :
           activeTab === AdminTab.FACILITY_ANALYTICS ? <FacilityAnalyticsPage t={t} facilities={facilities} alerts={alerts} readings={readings} facilityTypes={facilityTypes} /> :
           activeTab === AdminTab.REMINDERS ? <RemindersPage t={t} reminders={reminders} setReminders={setReminders} onLog={(a, e, d) => sync('audit-logs', { userId: currentUser.id, userName: currentUser.name, action: a, entity: e, details: d })} onSync={r => sync('reminders', r)} onSyncDelete={id => sync('reminders', id, 'DELETE')} /> :
           activeTab === AdminTab.BACKUP_SYNC ? <BackupSyncPage t={t} users={users} setUsers={setUsers} facilities={facilities} setFacilities={setFacilities} currentUser={currentUser} onLog={(a, e, d) => sync('audit-logs', { userId: currentUser.id, userName: currentUser.name, action: a, entity: e, details: d })} facilityTypes={facilityTypes} cookingMethods={cookingMethods} /> :
           activeTab === AdminTab.AUDIT_LOGS ? <AuditLogsPage t={t} logs={auditLogs} /> :
           activeTab === AdminTab.SETTINGS ? <SettingsPage t={t} facilities={facilities} fridgeTypes={fridgeTypes} setFridgeTypes={setFridgeTypes} cookingMethods={cookingMethods} setCookingMethods={setCookingMethods} facilityTypes={facilityTypes} setFacilityTypes={setFacilityTypes} holidays={holidays} setHolidays={setHolidays} excludedFacilities={excludedFacilities} setExcludedFacilities={setExcludedFacilities} legalTexts={legalTexts} setLegalTexts={setLegalTexts} onSyncHoliday={h => sync('settings/holidays', h)} onSyncFridgeType={ft => sync('settings/fridge-types', ft)} onSyncCooking={cm => sync('settings/cooking-methods', cm)} onSyncFacilityType={ft => sync('settings/facility-types', ft)} onSyncException={ex => sync('settings/exceptions', ex)} onSyncExceptionDelete={id => sync('settings/exceptions', id, 'DELETE')} onSyncLegal={l => sync('settings/legal', l)} /> :
           <DashboardPage t={t} currentUser={currentUser} users={users} facilities={facilities} fridges={fridges} alerts={alerts} setAlerts={setAlerts} impactStats={impactStats} onSyncAlert={a => sync('alerts', a)} />
          }
        </DashboardLayout>
      ) : (
        <UserDashboardLayout t={t} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => { setIsAuthenticated(false); setCurrentUser(null); setForcedRoleView(null); localStorage.clear(); sessionStorage.clear(); }} assignments={assignments} currentUser={currentUser!} forms={forms} formResponses={formResponses} readings={readings} holidays={holidays} isOnline={isOnline && !backendError} isSyncing={isSyncingInProgress} offlineQueueCount={syncQueueCount} facilities={facilities} facilityTypes={facilityTypes}>
          {activeTab === 'user_workspace' ? <UserWorkspace t={t} user={currentUser} fridges={fridges} menus={menus} assignments={assignments} readings={readings} onSave={(d, a) => { setReadings(prev => [d, ...prev]); sync('readings', d); if(a) { setAlerts(prev => [a, ...prev]); sync('alerts', a); } }} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} onViolation={()=>{}} formResponses={formResponses} /> :
           activeTab === 'user_forms' ? <UserForms t={t} user={currentUser} forms={forms} assignments={assignments} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} facilities={facilities} onSave={(d) => { setFormResponses(prev => [d, ...prev]); sync('form-responses', d); }} formResponses={formResponses} /> :
           activeTab === 'user_library' ? <UserLibrary t={t} documents={documents} /> :
           activeTab === 'user_academy' ? <UserAcademy t={t} /> :
           activeTab === 'user_personnel' ? <UserPersonnelDocs t={t} personnel={personnel} personnelDocs={personnelDocs} onUpload={d => sync('personnel-docs', d)} activeFacilityId={currentUser?.facilityId || ''} /> :
           <UserReports t={t} user={currentUser} readings={readings} menus={menus} fridges={fridges} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} assignments={assignments} formResponses={formResponses} excludedFacilities={excludedFacilities} forms={forms} facilityTypes={facilityTypes} lostDays={[]} />}
        </UserDashboardLayout>
      )}
    </div>
  );
};

export default App;
