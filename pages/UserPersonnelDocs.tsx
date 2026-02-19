
import React, { useState, useMemo, useRef } from 'react';
import { TranslationSet, Personnel, PersonnelDocument, PersonnelDocType } from '../types';

interface UserPersonnelDocsProps {
  t: TranslationSet;
  personnel: Personnel[];
  personnelDocs: PersonnelDocument[];
  onUpload: (doc: PersonnelDocument) => void;
  activeFacilityId: string;
}

const DOC_TYPES: { type: PersonnelDocType; icon: string; label: string }[] = [
  { type: 'Gesundheitsausweis', icon: '🩺', label: 'G-Ausweis' },
  { type: 'Infektionsschutzschulung', icon: '🦠', label: 'Infektionssch.' },
  { type: 'Masernschutz', icon: '💉', label: 'Masern' }
];

export const UserPersonnelDocs: React.FC<UserPersonnelDocsProps> = ({ personnel, personnelDocs, onUpload, activeFacilityId }) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState<PersonnelDocType | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const myPersonnel = useMemo(() => {
    return personnel.filter(p => p.status === 'Active' && p.facilityIds.includes(activeFacilityId));
  }, [personnel, activeFacilityId]);

  const selectedPerson = useMemo(() => {
    return myPersonnel.find(p => p.id === selectedPersonId);
  }, [myPersonnel, selectedPersonId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: PersonnelDocType) => {
    if (!selectedPersonId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      const newDoc: PersonnelDocument = {
        id: `PDOC-${Date.now()}`,
        personnelId: selectedPersonId,
        type: type,
        content: base64,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
        visibleToUser: true
      };
      onUpload(newDoc);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async (type: PersonnelDocType) => {
    setCameraType(type);
    setCapturedImage(null);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Kamera konnte nicht gestartet werden.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !selectedPersonId || !cameraType) return;
    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.85);
    setCapturedImage(base64);
    
    // Stop the actual video stream but keep modal open for preview
    if (videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const saveCapturedPhoto = () => {
    if (!capturedImage || !selectedPersonId || !cameraType) return;
    
    const newDoc: PersonnelDocument = {
      id: `PDOC-${Date.now()}`,
      personnelId: selectedPersonId,
      type: cameraType,
      content: capturedImage,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      visibleToUser: true
    };
    
    onUpload(newDoc);
    setIsCameraOpen(false);
    setCapturedImage(null);
    setCameraType(null);
  };

  const retakePhoto = () => {
    if (cameraType) startCamera(cameraType);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
    setCapturedImage(null);
    setCameraType(null);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left pb-20">
      <header className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex-1">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none mb-2">Dokumenten-Tresor</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Compliance-Dokumente & Zertifikate</p>
        </div>
        
        <div className="w-full md:w-80">
           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Mitarbeiter-Auswahl</label>
           <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">👤</span>
              <select 
                value={selectedPersonId || ''} 
                onChange={e => setSelectedPersonId(e.target.value)}
                className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-sm uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
              >
                  <option value="">Namen wählen...</option>
                  {myPersonnel.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
           </div>
        </div>
      </header>

      {selectedPerson ? (
        <div className="space-y-8">
           {DOC_TYPES.filter(dt => selectedPerson.requiredDocs.includes(dt.type)).map(dt => {
              const docs = personnelDocs.filter(d => d.personnelId === selectedPersonId && d.type === dt.type && (d.visibleToUser !== false));
              return (
                <div key={dt.type} className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:flex-row min-h-[300px]">
                   <div className="p-10 lg:w-96 bg-slate-50 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-inner ring-1 ring-slate-100 dark:ring-slate-700">{dt.icon}</div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight mb-2">{dt.label}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dt.type}</p>
                      </div>
                      
                      <div className="mt-10 flex gap-3">
                        <label className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase text-center cursor-pointer hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2">
                           <span>📂</span>
                           <span>Datei</span>
                           <input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => handleFileUpload(e, dt.type)} />
                        </label>
                        <button 
                          onClick={() => startCamera(dt.type)} 
                          className="w-16 h-16 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
                          title="Foto machen"
                        >
                          📸
                        </button>
                      </div>
                   </div>
                   
                   <div className="flex-1 p-10 flex flex-wrap gap-6 items-start content-start bg-white dark:bg-slate-900">
                      {docs.length > 0 ? docs.map(doc => (
                        <div key={doc.id} className="w-36 group">
                           <div className="aspect-[3/4] bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden relative shadow-sm group-hover:shadow-2xl group-hover:scale-105 transition-all">
                              {doc.mimeType.startsWith('image') ? (
                                <img src={doc.content} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800">
                                   <span className="text-4xl mb-2">📄</span>
                                   <span className="text-[10px] font-black text-slate-400">PDF</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4">
                                 <button onClick={() => window.open(doc.content)} className="w-full text-white font-black text-[10px] uppercase tracking-widest border border-white/30 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors">Vorschau</button>
                              </div>
                           </div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 text-center">{new Date(doc.createdAt).toLocaleDateString('de-DE')}</p>
                        </div>
                      )) : (
                        <div className="flex-1 h-full min-h-[160px] flex flex-col items-center justify-center border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] opacity-30">
                           <span className="text-5xl mb-4 grayscale">📥</span>
                           <p className="text-[11px] font-black uppercase tracking-widest">Kein Dokument vorhanden</p>
                        </div>
                      )}
                   </div>
                </div>
              );
           })}
        </div>
      ) : (
        <div className="py-32 text-center bg-white dark:bg-slate-900 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-slate-800 shadow-inner">
           <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner animate-pulse">🆔</div>
           <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Identität Bestätigen</h3>
           <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.2em] mt-4 max-w-sm mx-auto">Wählen Sie Ihren Namen aus der Liste oben rechts, um Ihre Dokumente zu verwalten.</p>
        </div>
      )}

      {/* CAMERA & PREVIEW MODAL */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-950 flex flex-col p-4 md:p-8 animate-in fade-in duration-300">
           <div className="flex justify-between items-center mb-8 text-white max-w-5xl mx-auto w-full">
              <div className="flex items-center gap-4">
                 <span className="text-3xl">📸</span>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">{capturedImage ? 'Foto prüfen' : `${cameraType} erfassen`}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{capturedImage ? 'Entspricht die Qualität Ihren Anforderungen?' : 'Bitte Dokument mittig platzieren'}</p>
                 </div>
              </div>
              <button onClick={stopCamera} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-bold hover:bg-rose-600 transition-all">✕</button>
           </div>

           <div className="flex-1 relative max-w-5xl mx-auto w-full rounded-[3rem] overflow-hidden bg-black border border-white/10 shadow-2xl">
              {!capturedImage ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-contain" playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-[60px] border-black/40 pointer-events-none">
                     <div className="w-full h-full border-2 border-white/20 border-dashed rounded-[1.5rem]" />
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/10 rounded-full pointer-events-none" />
                </>
              ) : (
                <img src={capturedImage} className="w-full h-full object-contain" alt="Vorschau" />
              )}
           </div>

           <div className="py-12 flex justify-center max-w-5xl mx-auto w-full">
              {!capturedImage ? (
                <button 
                  onClick={capturePhoto} 
                  className="w-24 h-24 rounded-full border-8 border-white/20 bg-white shadow-2xl active:scale-90 transition-all flex items-center justify-center"
                >
                   <div className="w-16 h-16 rounded-full border-2 border-slate-100" />
                </button>
              ) : (
                <div className="flex gap-6 w-full max-w-md">
                   <button 
                    onClick={retakePhoto}
                    className="flex-1 py-5 bg-white/10 text-white rounded-[1.75rem] font-black uppercase text-xs tracking-widest hover:bg-white/20 transition-all border border-white/10"
                   >
                     🔄 Abbrechen / Neu
                   </button>
                   <button 
                    onClick={saveCapturedPhoto}
                    className="flex-1 py-5 bg-blue-600 text-white rounded-[1.75rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all"
                   >
                     ✅ Foto Speichern
                   </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};
