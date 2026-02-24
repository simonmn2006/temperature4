
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { defaultTranslations } from './defaultTranslations';

interface BrandingSettings {
  appName: string;
  primaryColor: string;
  logoUrl: string;
  defaultLanguage: string;
}

interface Translation {
  lang: string;
  tkey: string;
  tvalue: string;
}

interface BrandingContextType {
  settings: BrandingSettings;
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  updateTranslation: (key: string, value: string) => Promise<void>;
  updateBranding: (settings: BrandingSettings) => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<BrandingSettings>({
    appName: 'Gourmetta',
    primaryColor: '#10b981',
    logoUrl: '',
    defaultLanguage: 'de'
  });
  const [language, setLanguage] = useState('de');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/branding');
      if (res.ok) {
        const data = await res.json();
        if (data.appName) {
          setSettings(data);
          setLanguage(data.defaultLanguage || 'de');
        }
      }
    } catch (e) {}
  }, []);

  const fetchTranslations = useCallback(async (lang: string) => {
    try {
      const res = await fetch(`/api/translations/${lang}`);
      if (res.ok) {
        const data: Translation[] = await res.json();
        const map: Record<string, string> = {};
        data.forEach(item => {
          map[item.tkey] = item.tvalue;
        });
        setTranslations(map);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  useEffect(() => {
    fetchTranslations(language);
  }, [language, fetchTranslations]);

  const t = (key: string) => {
    return translations[key] || defaultTranslations[language]?.[key] || key;
  };

  const updateTranslation = async (key: string, value: string) => {
    try {
      const res = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: language, tkey: key, tvalue: value })
      });
      if (res.ok) {
        setTranslations(prev => ({ ...prev, [key]: value }));
      }
    } catch (e) {}
  };

  const updateBranding = async (newSettings: BrandingSettings) => {
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        setSettings(newSettings);
      }
    } catch (e) {}
  };

  // Apply primary color to CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
    // Generate lighter/darker versions if needed, or just use opacity in tailwind
  }, [settings.primaryColor]);

  return (
    <BrandingContext.Provider value={{ 
      settings, 
      language, 
      setLanguage, 
      t, 
      editMode, 
      setEditMode, 
      updateTranslation,
      updateBranding
    }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding must be used within a BrandingProvider');
  return context;
};

export const T: React.FC<{ tkey: string }> = ({ tkey }) => {
  const { t, editMode, updateTranslation } = useBranding();
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(t(tkey));

  useEffect(() => {
    setVal(t(tkey));
  }, [t, tkey]);

  if (editMode) {
    if (isEditing) {
      return (
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            updateTranslation(tkey, val);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              updateTranslation(tkey, val);
            }
          }}
          autoFocus
          className="border border-blue-500 px-1 rounded text-black"
        />
      );
    }
    return (
      <span 
        onClick={() => setIsEditing(true)}
        className="cursor-pointer hover:bg-blue-100 border-b border-dashed border-blue-400"
        title="Click to edit translation"
      >
        {val}
      </span>
    );
  }

  return <>{val}</>;
};
