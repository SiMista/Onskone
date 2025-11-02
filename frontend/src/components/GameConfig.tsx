import React, { useState } from 'react';

interface GameSettings {
  questionSelectionDuration: number;
  answeringDuration: number;
  guessingDuration: number;
}

interface GameConfigProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (settings: GameSettings) => void;
}

const GameConfig: React.FC<GameConfigProps> = ({ isOpen, onClose, onStart }) => {
  const [settings, setSettings] = useState<GameSettings>({
    questionSelectionDuration: 30,
    answeringDuration: 60,
    guessingDuration: 90,
  });

  if (!isOpen) return null;

  const presets = [
    { name: 'Rapide ⚡', questionSelection: 20, answering: 45, guessing: 60 },
    { name: 'Standard ⏱️', questionSelection: 30, answering: 60, guessing: 90 },
    { name: 'Relax 🌴', questionSelection: 45, answering: 90, guessing: 120 },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    setSettings({
      questionSelectionDuration: preset.questionSelection,
      answeringDuration: preset.answering,
      guessingDuration: preset.guessing,
    });
  };

  const handleStart = () => {
    onStart(settings);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-2xl max-w-2xl w-full p-8 border border-white/30">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">⚙️ Configuration de la partie</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-3xl font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Presets */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Modes prédéfinis</h3>
          <div className="grid grid-cols-3 gap-4">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetClick(preset)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg p-4
                  transition-all transform hover:scale-105 border-2 border-white/20
                  hover:border-white/50"
              >
                <p className="text-white font-bold text-lg mb-2">{preset.name}</p>
                <p className="text-white/70 text-sm">
                  {preset.questionSelection}s / {preset.answering}s / {preset.guessing}s
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Durées personnalisées */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">⏱️ Durées des phases (en secondes)</h3>

          <div className="space-y-6">
            {/* Sélection de question */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-white font-semibold">
                  1. Sélection de la question
                </label>
                <span className="text-white text-2xl font-bold">
                  {settings.questionSelectionDuration}s
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={settings.questionSelectionDuration}
                onChange={(e) => setSettings({ ...settings, questionSelectionDuration: Number(e.target.value) })}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-white/60 text-xs mt-1">
                <span>10s</span>
                <span>60s</span>
              </div>
            </div>

            {/* Réponse des joueurs */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-white font-semibold">
                  2. Réponse des joueurs
                </label>
                <span className="text-white text-2xl font-bold">
                  {settings.answeringDuration}s
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                step="15"
                value={settings.answeringDuration}
                onChange={(e) => setSettings({ ...settings, answeringDuration: Number(e.target.value) })}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-white/60 text-xs mt-1">
                <span>30s</span>
                <span>120s</span>
              </div>
            </div>

            {/* Devinette du chef */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-white font-semibold">
                  3. Devinette du chef
                </label>
                <span className="text-white text-2xl font-bold">
                  {settings.guessingDuration}s
                </span>
              </div>
              <input
                type="range"
                min="45"
                max="180"
                step="15"
                value={settings.guessingDuration}
                onChange={(e) => setSettings({ ...settings, guessingDuration: Number(e.target.value) })}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-white/60 text-xs mt-1">
                <span>45s</span>
                <span>180s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-lg font-bold text-lg bg-gray-500 hover:bg-gray-600
              text-white transition-all transform hover:scale-105"
          >
            Annuler
          </button>
          <button
            onClick={handleStart}
            className="flex-1 px-6 py-4 rounded-lg font-bold text-lg bg-green-500 hover:bg-green-600
              text-white transition-all transform hover:scale-105"
          >
            Lancer le jeu
          </button>
        </div>

        {/* Info */}
        <p className="text-white/60 text-sm text-center mt-4">
          💡 Les timers s'adaptent automatiquement si le temps expire
        </p>
      </div>
    </div>
  );
};

export default GameConfig;
