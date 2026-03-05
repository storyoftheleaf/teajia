import React, { useState } from 'react';
import { useAppStore } from '../store';
import { useToast } from './Toast';
import { Save, RefreshCw, Settings2 } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { aiPromptTemplate, setAiPromptTemplate } = useAppStore();
  const { showToast } = useToast();
  
  const [localPrompt, setLocalPrompt] = useState(aiPromptTemplate);

  const handleSave = () => {
    setAiPromptTemplate(localPrompt);
    showToast("AI Prompt Template saved successfully.", "success");
  };

  const handleReset = () => {
    const defaultPrompt = 'You are a poetic but grounded tea master. Write 2-3 sentences of historical or geographical lore about the tea named "{{productName}}" of type "{{type}}". Provide exactly 3-4 distinct sensory tasting notes. Also, provide the traditional Chinese name for this tea (if applicable) and its specific origin region (e.g., "Anxi, Fujian, China" or "Alishan, Taiwan"). Additionally, provide processing notes (e.g. "Heavy charcoal roast over pine wood."), a mood (e.g. "Grounding & Meditative"), an experience description (e.g. "A deeply centering tea..."), and a liquor color (e.g. "Deep Amber"). Do not be overly pretentious; focus on terroir, history, and clear flavors. Return the response in JSON format.';
    setLocalPrompt(defaultPrompt);
    setAiPromptTemplate(defaultPrompt);
    showToast("AI Prompt Template reset to default.", "info");
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-auto custom-scrollbar bg-tea-bg p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-2xl font-serif text-tea-text flex items-center gap-3">
            <Settings2 size={24} className="text-tea-accent" />
            System Settings
          </h2>
          <p className="text-tea-muted text-sm mt-2">
            Configure application behavior and AI generation parameters.
          </p>
        </div>

        {/* AI Settings Section */}
        <div className="bg-tea-surface border border-tea-border rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-tea-border pb-4">
            <div>
              <h3 className="text-lg font-serif text-tea-text">AI Wisdom Generator</h3>
              <p className="text-tea-muted text-xs mt-1">Customize the prompt used when generating tea lore and tasting notes.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-tea-muted mb-2">Prompt Template</label>
              <textarea
                value={localPrompt}
                onChange={(e) => setLocalPrompt(e.target.value)}
                rows={12}
                className="w-full bg-tea-bg border border-tea-border rounded-lg p-4 text-sm text-tea-text outline-none focus:border-tea-accent transition-colors font-mono leading-relaxed resize-y"
                placeholder="Enter your AI prompt template here..."
              />
              <p className="text-[10px] text-tea-muted mt-2">
                Available variables: <code className="bg-tea-bg px-1 py-0.5 rounded text-tea-accent">{"{{productName}}"}</code>, <code className="bg-tea-bg px-1 py-0.5 rounded text-tea-accent">{"{{type}}"}</code>. The AI must return a JSON object with keys: <code className="text-tea-text">lore, tastingNotes, chineseName, originRegion, processingNotes, mood, experience, liquorColor</code>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-tea-border">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-tea-muted hover:text-tea-text transition-colors"
              >
                <RefreshCw size={14} />
                Reset Default
              </button>
              <button
                onClick={handleSave}
                disabled={localPrompt === aiPromptTemplate}
                className="flex items-center gap-2 px-6 py-2 bg-tea-accent text-tea-bg text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-tea-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                Save Changes
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
