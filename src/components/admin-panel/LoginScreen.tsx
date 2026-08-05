import React, { useState } from 'react';
import { Icons } from '../Icons';
import { LogoEmblem } from '../Logos';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors placeholder-tea-text-dim";

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
        <div className="relative w-full h-full bg-tea-bg overflow-y-auto">
            <button
                onClick={onClose}
                className="absolute top-4 left-4 p-2 tap-target text-tea-text-sec hover:text-tea-text transition-colors"
                aria-label="Close login screen"
            >
                <Icons.Close className="w-5 h-5" />
            </button>

            <div className="max-w-md mx-auto px-4 pt-16 pb-24">
                <div className="flex flex-col items-center mb-8">
                    <LogoEmblem size={56} color="var(--tea-gold)" className="mb-5" />
                    <h2 className="h2">Editor access</h2>
                    <p className="subtitle mt-2">Enter your passkey to continue.</p>
                </div>

                {!createdKey ? (
                    <>
                        <div className="space-y-4">
                            <input
                                type="password"
                                value={pwd}
                                onChange={e => setPwd(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && checkLogin()}
                                placeholder="Passkey"
                                className={inputClass}
                                autoFocus
                            />
                            <button
                                onClick={checkLogin}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md cta-solid text-xs font-semibold transition-colors"
                            >
                                Enter
                            </button>
                        </div>

                        <div className="mt-8 pt-6 border-t border-tea-border text-center">
                            <p className="text-ui-12 text-tea-text-sec mb-2">No access key?</p>
                            <p className="text-ui-12 text-tea-text-dim mb-4 font-body italic">
                                Try: <span className="font-mono text-tea-text-sec">admin</span>,{' '}
                                <span className="font-mono text-tea-text-sec">tea</span>, or{' '}
                                <span className="font-mono text-tea-text-sec">passkey1234</span>
                            </p>
                            <button
                                onClick={handleCreateAccount}
                                className="link-text hover:opacity-80 transition-opacity"
                            >
                                Generate new key
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-tea-surface border border-tea-border p-6 rounded-xl animate-[fadeIn_0.3s_ease-out]">
                        <div className="text-center mb-5">
                            <Icons.Check className="w-7 h-7 text-tea-gold mx-auto mb-2" />
                            <p className="h3">Access granted</p>
                        </div>
                        <p className="label-caps text-tea-text-dim mb-2">Your key</p>
                        <div className="bg-tea-bg border border-tea-border rounded-md p-3 mb-5 select-all cursor-text text-center">
                            <span className="text-tea-text font-mono text-ui-17 tracking-[0.12em]">{createdKey}</span>
                        </div>
                        <button
                            onClick={() => { setPwd(createdKey); setCreatedKey(null); }}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md cta-solid text-xs font-semibold transition-colors"
                        >
                            Login Now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
