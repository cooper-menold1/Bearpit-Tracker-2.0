import React, { useState, useEffect } from 'react';
import { X, Globe, Save, Server } from 'lucide-react';

interface InstructionsProps {
    isOpen: boolean;
    onClose: () => void;
    sheetUrl: string; // Deprecated, kept for prop compatibility
    adminPassword?: string;
    publicUrl?: string;
    onSaveUrl: (url: string) => void;
    onSaveSettings: (password: string, publicUrl: string) => void;
}

export const Instructions: React.FC<InstructionsProps> = ({
    isOpen,
    onClose,
    sheetUrl,
    adminPassword = '',
    publicUrl = '',
    onSaveUrl,
    onSaveSettings
}) => {
    const [urlInput, setUrlInput] = useState(publicUrl);

    useEffect(() => {
        setUrlInput(publicUrl);
    }, [publicUrl, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSaveSettings(adminPassword, urlInput);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#154734] rounded-t-xl">
                    <div className="flex items-center gap-2 text-white">
                        <Server className="w-6 h-6" />
                        <h2 className="text-xl font-bold">System Connection</h2>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6 bg-gray-50">

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-[#FFB81C]" /> Public URL
                        </h3>

                        <div>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#154734] bg-white"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="https://your-app.vercel.app"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Enter the deployed URL of this application. This is used to generate the correct <strong>Check-in QR Code</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-bold text-green-800 text-sm mb-1">Database Status</h4>
                        <p className="text-green-700 text-xs">
                            Your application is currently connected to <strong>Supabase</strong>. All data is automatically synced to the cloud.
                        </p>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-white rounded-b-xl">
                    <button
                        onClick={handleSave}
                        className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] shadow-md flex items-center justify-center gap-2"
                    >
                        <Save className="w-5 h-5" /> Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};
