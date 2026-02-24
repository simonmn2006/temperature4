
import React, { useState } from 'react';
import { useBranding } from '../BrandingContext';
import { Settings, Palette, Type, Globe, Edit3, Check, Save } from 'lucide-react';
import { defaultTranslations } from '../defaultTranslations';

export const BrandingPage: React.FC = () => {
  const { settings, updateBranding, language, setLanguage, editMode, setEditMode, t } = useBranding();
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'translations'>('general');

  const handleSaveBranding = async () => {
    await updateBranding(localSettings);
    alert('Branding-Einstellungen gespeichert!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-7 h-7 text-emerald-600" />
            {t('admin.branding')}
          </h2>
          <p className="text-slate-500">Passen Sie das Erscheinungsbild und die Sprache der Anwendung an.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              editMode 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            {t('branding.editMode')} {editMode ? '(AN)' : '(AUS)'}
          </button>
          <button
            onClick={handleSaveBranding}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Save className="w-4 h-4" />
            {t('common.save')}
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('general')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeSubTab === 'general' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Allgemein
        </button>
        <button
          onClick={() => setActiveSubTab('translations')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeSubTab === 'translations' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Übersetzungen
        </button>
      </div>

      {activeSubTab === 'general' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-3">
              <Settings className="w-5 h-5 text-slate-400" />
              Identität
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('branding.appName')}</label>
                <input
                  type="text"
                  value={localSettings.appName}
                  onChange={(e) => setLocalSettings({ ...localSettings, appName: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('branding.logoUrl')}</label>
                <input
                  type="text"
                  value={localSettings.logoUrl}
                  onChange={(e) => setLocalSettings({ ...localSettings, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-3">
              <Palette className="w-5 h-5 text-slate-400" />
              Design & Sprache
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('branding.primaryColor')}</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={localSettings.primaryColor}
                    onChange={(e) => setLocalSettings({ ...localSettings, primaryColor: e.target.value })}
                    className="w-12 h-12 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localSettings.primaryColor}
                    onChange={(e) => setLocalSettings({ ...localSettings, primaryColor: e.target.value })}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('branding.language')}</label>
                <select
                  value={localSettings.defaultLanguage}
                  onChange={(e) => setLocalSettings({ ...localSettings, defaultLanguage: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Globe className="w-5 h-5 text-slate-400" />
              <div className="flex gap-2">
                {['de', 'en', 'fr', 'es'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                      language === lang ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 italic">
              Tipp: Aktivieren Sie den "Bearbeitungsmodus" oben rechts, um Texte direkt in der App zu ändern.
            </p>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4">Schlüssel</th>
                  <th className="px-6 py-4">Standard-Text</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.keys(defaultTranslations['de']).map(key => (
                  <tr key={key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{key}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{defaultTranslations[language]?.[key] || key}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
                        <Check className="w-3 h-3" />
                        Bereit
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
