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
            <button onClick={onClose} className="absolute top-6 left-6 text-white/80 hover:text-white" aria-label="Close login screen"><Icons.Close className="w-6 h-6" /></button>
            <div className="w-full max-w-xs text-center">
                <div className="w-12 h-12 bg-tea-gold rounded-[1px] mx-auto mb-8 flex items-center justify-center text-black font-serif font-bold text-xl">T</div>
                <h2 className="text-white font-serif text-xl mb-6">Editor Access</h2>
                
                {!createdKey ? (
                    <>
                        <input
                            type="password"
                            value={pwd}
                            onChange={e => setPwd(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && checkLogin()}
                            placeholder="Passkey"
                            className="w-full bg-[#0f0f0f] border border-white/20 p-3 text-center text-white tracking-[0.2em] outline-none focus:border-tea-gold rounded-sm mb-4 placeholder:text-white/30"
                        />
                        <button onClick={checkLogin} className="w-full bg-tea-bg text-black py-3 uppercase tracking-widest text-xs font-bold hover:bg-white transition-colors rounded-sm mb-6">Enter</button>
                        
                        <div className="border-t border-white/20 pt-6">
                            <p className="text-white/80 text-xs mb-3">No access key?</p>
                            <p className="text-white/70 text-xs mb-4 italic">Try: <span className="text-white/80 font-mono">admin</span>, <span className="text-white/80 font-mono">tea</span>, or <span className="text-white/80 font-mono">passkey1234</span></p>
                            <button
                                onClick={handleCreateAccount}
                                className="text-tea-gold text-xs uppercase tracking-widest hover:text-white transition-colors border border-tea-gold/30 px-4 py-2 rounded-sm hover:bg-tea-gold/10"
                            >
                                Generate New Key
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-[#0f0f0f] border border-tea-gold/40 p-6 rounded-sm animate-[fadeIn_0.3s_ease-out]">
                        <Icons.Check className="w-8 h-8 text-tea-gold mx-auto mb-3" />
                        <p className="text-white/80 text-sm mb-2 font-serif italic">Access Granted</p>
                        <p className="text-xs uppercase tracking-widest text-white/80 mb-1">Your Key</p>
                        <div className="bg-black border border-white/20 p-3 mb-4 select-all cursor-text">
                            <span className="text-white font-mono text-lg tracking-widest">{createdKey}</span>
                        </div>
                        <button 
                            onClick={() => { setPwd(createdKey); setCreatedKey(null); }} 
                            className="w-full bg-tea-bg text-black py-3 uppercase tracking-widest text-xs font-bold hover:bg-white transition-colors rounded-sm"
                        >
                            Login Now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
