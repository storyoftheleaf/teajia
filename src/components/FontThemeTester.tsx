import React, { useState, useEffect, memo } from 'react';
import { FONT_THEMES, FONT_SIZE_SCALES, DESIGN_TOKENS } from '../designTokens';
import { Icons } from './Icons';

interface FontTestSettings {
  themeName: keyof typeof FONT_THEMES;
  sizeScale: keyof typeof FONT_SIZE_SCALES;
  customSizes: Record<string, number>;
}

const FontThemeTesterComponent: React.FC = () => {
  const [settings, setSettings] = useState<FontTestSettings>({
    themeName: 'default',
    sizeScale: 'default',
    customSizes: {},
  });

  // Load saved settings from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('teajia_font_test');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
      } catch (e) {
        console.log('Could not load saved font settings');
      }
    }
  }, []);

  // Apply font settings to document
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = FONT_THEMES[settings.themeName];
    const currentScale = FONT_SIZE_SCALES[settings.sizeScale];

    try {
      // Set font families
      root.style.setProperty('--font-serif', currentTheme.serif.join(', '));
      root.style.setProperty('--font-sans', currentTheme.sans.join(', '));
      root.style.setProperty('--font-mono', currentTheme.mono.join(', '));

      // Set only the font sizes that are customized, not all
      ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'].forEach((key) => {
        if (settings.customSizes[key] !== undefined || settings.sizeScale !== 'default') {
          const value = DESIGN_TOKENS.fontSize[key as keyof typeof DESIGN_TOKENS.fontSize];
          const baseSize = parseFloat(value);
          const multiplier = currentScale.multiplier;
          const customMultiplier = settings.customSizes[key] || 1;
          const finalSize = baseSize * multiplier * customMultiplier;
          root.style.setProperty(`--font-size-${key}`, `${finalSize}rem`);
        }
      });
    } catch (e) {
      console.error('Error setting font styles:', e);
    }
  }, [settings]);

  // Save to sessionStorage (debounced to avoid excessive updates)
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem('teajia_font_test', JSON.stringify(settings));
    }, 500);
    return () => clearTimeout(timer);
  }, [settings]);

  const currentTheme = FONT_THEMES[settings.themeName];
  const currentScale = FONT_SIZE_SCALES[settings.sizeScale];

  const handleThemeChange = (themeName: keyof typeof FONT_THEMES) => {
    setSettings(prev => ({ ...prev, themeName }));
  };

  const handleScaleChange = (scale: keyof typeof FONT_SIZE_SCALES) => {
    setSettings(prev => ({ ...prev, sizeScale: scale }));
  };

  const handleSizeAdjust = (sizeKey: string, multiplier: number) => {
    setSettings(prev => ({
      ...prev,
      customSizes: {
        ...prev.customSizes,
        [sizeKey]: multiplier,
      },
    }));
  };

  const handleReset = () => {
    const defaultSettings: FontTestSettings = {
      themeName: 'default',
      sizeScale: 'default',
      customSizes: {},
    };
    setSettings(defaultSettings);
    sessionStorage.removeItem('teajia_font_test');
  };

  const handleLockIn = () => {
    const savedSettings = {
      theme: settings.themeName,
      scale: settings.sizeScale,
      customSizes: settings.customSizes,
      timestamp: new Date().toISOString(),
    };
    const element = document.createElement('a');
    element.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedSettings, null, 2));
    element.download = 'teajia-font-settings.json';
    element.click();
    alert(`Font settings locked! Current theme: ${currentTheme.name}, Scale: ${currentScale.name}\n\nYou can now remove this component from AdminPanel when satisfied.`);
  };

  return (
    <div className="bg-[#0f0f0f] border border-white/10 rounded-sm p-8 space-y-8 animate-[fadeIn_0.3s_ease-out]">
      <div>
        <h3 className="text-lg font-serif text-white mb-2">Typography Testing</h3>
        <p className="text-white/60 text-sm">Explore different font themes and sizes. Changes are temporarily saved in this session.</p>
      </div>

      {/* Font Theme Selection */}
      <div>
        <label className="block text-white/80 text-sm uppercase tracking-wider mb-4">Font Theme</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(FONT_THEMES).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => handleThemeChange(key as keyof typeof FONT_THEMES)}
              className={`px-4 py-3 rounded-sm text-sm uppercase tracking-wider transition-all ${
                settings.themeName === key
                  ? 'bg-tea-seal text-black font-bold'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {theme.name}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size Scale Selection */}
      <div>
        <label className="block text-white/80 text-sm uppercase tracking-wider mb-4">Master Size Scale</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(FONT_SIZE_SCALES).map(([key, scale]) => (
            <button
              key={key}
              onClick={() => handleScaleChange(key as keyof typeof FONT_SIZE_SCALES)}
              className={`px-3 py-2 rounded-sm text-xs uppercase tracking-wider transition-all ${
                settings.sizeScale === key
                  ? 'bg-tea-seal text-black font-bold'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {scale.name}
            </button>
          ))}
        </div>
      </div>

      {/* Individual Size Adjustments - Limited to key sizes */}
      <div>
        <label className="block text-white/80 text-sm uppercase tracking-wider mb-4">Fine-tune Key Sizes</label>
        <div className="space-y-4">
          {['sm', 'base', 'lg', 'xl'].map((sizeKey) => {
            const baseValue = DESIGN_TOKENS.fontSize[sizeKey as keyof typeof DESIGN_TOKENS.fontSize];
            const currentMultiplier = settings.customSizes[sizeKey] || 1;
            const baseSize = parseFloat(baseValue);
            const scaleMultiplier = FONT_SIZE_SCALES[settings.sizeScale].multiplier;
            const finalSize = (baseSize * scaleMultiplier * currentMultiplier).toFixed(3);
            const finalPixels = (baseSize * 16 * scaleMultiplier * currentMultiplier).toFixed(0);

            return (
              <div key={sizeKey} className="bg-white/5 p-3 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-white/80 text-sm font-medium capitalize">
                      text-{sizeKey}
                    </label>
                    <p className="text-white/50 text-xs">
                      {finalSize}rem ({finalPixels}px)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={currentMultiplier}
                      onChange={(e) => handleSizeAdjust(sizeKey, parseFloat(e.target.value))}
                      className="w-20 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-tea-seal"
                    />
                    <span className="text-white/60 text-xs font-mono w-6">
                      {(currentMultiplier * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white/5 border border-white/10 rounded-sm p-6 space-y-4">
        <h4 className="text-white text-sm uppercase tracking-wider font-semibold">Live Preview</h4>
        <p className="text-white/60 text-xs">{currentTheme.name} with {currentScale.name} scale</p>

        {/* Heading Sample */}
        <div style={{ fontFamily: currentTheme.serif.join(', ') }} className="text-white mb-3">
          <h2 className="text-2xl mb-2">Lorem Ipsum Dolor</h2>
          <p className="text-white/70">The quick brown fox jumps over the lazy dog</p>
        </div>

        {/* Body Text Sample */}
        <div style={{ fontFamily: currentTheme.sans.join(', ') }}>
          <p className="text-white/70 text-sm">
            Body text in {currentTheme.name}. This is the primary reading text size. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
        <button
          onClick={handleLockIn}
          className="px-6 py-2 bg-tea-seal hover:bg-tea-seal/90 text-black text-xs uppercase tracking-widest font-bold rounded-sm transition-colors flex items-center gap-2"
        >
          <Icons.Check className="w-4 h-4" />
          Lock In These Fonts
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-widest rounded-sm transition-colors flex items-center gap-2 border border-white/20"
        >
          <Icons.RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
        <div className="ml-auto flex items-center gap-2 text-white/50 text-xs">
          <Icons.Info className="w-4 h-4" />
          <span>Changes saved to session</span>
        </div>
      </div>
    </div>
  );
};

export const FontThemeTester = memo(FontThemeTesterComponent);
