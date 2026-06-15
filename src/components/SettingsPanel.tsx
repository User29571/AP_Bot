import React, { useState } from 'react';
import { Settings, DEFAULT_EMOJIS, AP_Emoji } from '../types';
import { Settings as SettingsIcon, Save, HeartOff, RefreshCw, Sparkles, Check, Flame } from 'lucide-react';

interface SettingsPanelProps {
  settings: Settings;
  onSaveSettings: (settings: Settings) => Promise<void>;
}

export default function SettingsPanel({
  settings,
  onSaveSettings
}: SettingsPanelProps) {
  const [startingPoints, setStartingPoints] = useState<Record<string, number>>({ ...settings.startingPoints });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleStartingPointChange = (emoji: string, val: number) => {
    setStartingPoints(prev => ({
      ...prev,
      [emoji]: Math.max(0, val)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const typedStartingPoints = startingPoints as Record<AP_Emoji, number>;
      
      await onSaveSettings({
        startingPoints: typedStartingPoints as any
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-zinc-900/90 rounded-2xl p-6 border border-zinc-850 shadow-md">
      <div className="flex justify-between items-center pb-4 border-b border-zinc-800/80 mb-6">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-1.5">
            <SettingsIcon className="h-4 w-4 text-indigo-400" /> Points Crediting Rules
          </h2>
          <p className="text-xs text-zinc-500">Formulate starting points and automated rewards</p>
        </div>
        <Flame className="h-5 w-5 text-indigo-500" />
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Starting points */}
        <div>
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3">
            Initial Points (Fighter registration)
          </h3>
          <p className="text-[11px] text-zinc-500 mb-4 leading-normal">
            When a player is discovered for the first time in a parsed combat log, they are initialized with the following points:
          </p>
          <div className="grid grid-cols-3 gap-3">
            {DEFAULT_EMOJIS.map(em => (
              <div key={em} className="flex flex-col bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 font-mono">
                <span className="text-xs text-zinc-400 text-center mb-1">{em}</span>
                <input
                  type="number"
                  min="0"
                  value={startingPoints[em] !== undefined ? startingPoints[em] : 0}
                  onChange={(e) => handleStartingPointChange(em, parseInt(e.target.value) || 0)}
                  className="bg-transparent text-center text-sm font-bold text-zinc-200 outline-none w-full"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action button */}
        <div className="pt-4">
          <button
            id="btn-save-settings"
            type="submit"
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
              savedSuccess 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow hover:shadow-lg'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Committing settings...
              </>
            ) : savedSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" /> Credit Rules Saved Successfully!
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Save Configuration
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
