import React from 'react';
import { ArrowLeft } from 'lucide-react';

// For now, we import the asset directly.
// In a real Vite app, we might use "import chantSheet from '../assets/chants_sheet.png'"
// or reference it via string path if it's in public.
// Since we put it in "assets" inside the project (not public), proper import is best.
import chantSheet from '../assets/chants_sheet.png';

interface ChantGalleryProps {
    onBack: () => void;
}

export const ChantGallery: React.FC<ChantGalleryProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-[#154734] flex flex-col">
            {/* Header */}
            <div className="bg-[#FFB81C] p-4 flex items-center shadow-lg relative z-10">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-[#154734] font-bold hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                </button>
                <h1 className="flex-1 text-center text-xl font-extrabold text-[#154734] pr-12">
                    Gameday Chants
                </h1>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
                    <img
                        src={chantSheet}
                        alt="Bear Pit Chants"
                        className="w-full h-auto object-contain"
                    />
                </div>
            </div>
        </div>
    );
};
