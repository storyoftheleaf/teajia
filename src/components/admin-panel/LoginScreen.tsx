import React, { useState } from 'react';
import { Icons } from '../Icons';

export const LoginScreen: React.FC<{ onLogin: () => void; onClose: () => void }> = ({ onLogin, onClose }) => {
    const [pwd, setPwd] = useState('');
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    const checkLogin = () => {
        onLogin();
    };

    const handleCreateAccount = () => {
        const newKey = 'editor_' + Math.random().toString(36).substr(2, 6);
        const storedKeys = JSON.parse(localStorage.getItem('teajia_access_keys') || '[]');
        localStorage.setItem('teajia_access_keys', JSON.stringify([...storedKeys, newKey]));
        setCreatedKey(newKey);
    };

    return (
        <div className="w-full h-full bg-tea-bg flex items-center justify-center p-6 md:pb-6">
            <button onClick={onClose} className="absolute top-6 left-6 p-2 text-tea-text/80 hover:text-tea-text" aria-label="Close login screen"><Icons.Close className="w-6 h-6" /></button>
            <div className="w-full max-w-xs text-center">
                <div className="w-12 h-12 bg-tea-gold rounded-xl mx-auto mb-8 flex items-center justify-center text-tea-bg font-serif font-bold text-xl">T</div>
                <h2 className="text-tea-text font-serif text-xl mb-6">Editor Access</h2>

                {!createdKey ? (
                    <>
                        <input
                            type="password"
                            value={pwd}
                            onChange={e => setPwd(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && checkLogin()}
                            placeholder="Passkey"
                            className="w-full bg-tea-surface border border-tea-border p-3 text-center text-tea-text tracking-[0.2em] outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold rounded-md mb-4 placeholder:text-tea-text/30"
                        />
                        <button onClick={checkLogin} className="w-full bg-tea-gold text-tea-bg py-3 uppercase tracking-[0.15em] text-xs font-bold hover:bg-tea-gold-lt transition-colors rounded-md mb-6">Enter</button>

                        <div className="border-t border-tea-border pt-6">
                            <p className="text-tea-text/80 text-xs mb-3">No access key?</p>
                            <p className="text-tea-text/70 text-xs mb-4 italic">Try: <span className="text-tea-text/80 font-mono">admin</span>, <span className="text-tea-text/80 font-mono">tea</span>, or <span className="text-tea-text/80 font-mono">passkey1234</span></p>
                            <button
                                onClick={handleCreateAccount}
                                className="text-tea-gold text-xs uppercase tracking-[0.15em] hover:text-tea-text transition-colors border border-tea-border px-4 py-2 rounded-md hover:bg-tea-gold/10"
                            >
                                Generate New Key
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-tea-surface border border-tea-border p-6 rounded-md animate-[fadeIn_0.3s_ease-out]">
                        <Icons.Check className="w-8 h-8 text-tea-gold mx-auto mb-3" />
                        <p className="text-tea-text/80 text-sm mb-2 font-serif italic">Access Granted</p>
                        <p className="text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-1">Your Key</p>
                        <div className="bg-tea-bg border border-tea-border p-3 mb-4 select-all cursor-text">
                            <span className="text-tea-text font-mono text-lg tracking-[0.15em]">{createdKey}</span>
                        </div>
                        <button
                            onClick={() => { setPwd(createdKey); setCreatedKey(null); }}
                            className="w-full bg-tea-gold text-tea-bg py-3 uppercase tracking-[0.15em] text-xs font-bold hover:bg-tea-gold-lt transition-colors rounded-md"
                        >
                            Login Now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
