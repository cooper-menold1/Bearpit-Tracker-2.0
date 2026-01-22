
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, X, Maximize2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { Chant } from '../types';

interface ChantGalleryProps {
    onBack: () => void;
}

export const ChantGallery: React.FC<ChantGalleryProps> = ({ onBack }) => {
    const [chants, setChants] = useState<Chant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedChant, setSelectedChant] = useState<Chant | null>(null);

    useEffect(() => {
        const fetchChants = async () => {
            try {
                const { data, error } = await supabase
                    .from('chants')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                const mapped: Chant[] = (data || []).map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    imageUrl: c.image_url,
                    createdAt: c.created_at
                }));
                setChants(mapped);
            } catch (error) {
                console.error("Error fetching chants:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChants();
    }, []);

    return (
        <div className="flex flex-col h-screen bg-[#154734] text-white">
            {/* Header */}
            <div className="p-4 flex items-center gap-4 border-b border-green-800/50 shrink-0">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <h2 className="text-xl font-bold text-[#FFB81C]">Gameday Chants</h2>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center gap-6 pb-20">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-green-200">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p>Loading Chants...</p>
                    </div>
                ) : chants.length === 0 ? (
                    <div className="text-center text-green-200 mt-10">
                        <p>No chants found.</p>
                    </div>
                ) : (
                    chants.map(chant => (
                        <div
                            key={chant.id}
                            onClick={() => setSelectedChant(chant)}
                            className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden relative group cursor-pointer active:scale-[0.98] transition-all"
                        >
                            <img src={chant.imageUrl} alt={chant.title} className="w-full h-auto" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <Maximize2 className="text-white opacity-0 group-hover:opacity-100 w-10 h-10 drop-shadow-lg transition-opacity" />
                            </div>
                            {chant.title && (
                                <div className="absolute bottom-0 left-0 right-0 bg-[#154734]/90 text-[#FFB81C] p-3 text-center font-bold text-sm">
                                    {chant.title}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Fullscreen Lightbox */}
            {selectedChant && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center overflow-auto p-2 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedChant(null)}
                >
                    <button
                        className="fixed top-4 right-4 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white z-[110] transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChant(null);
                        }}
                    >
                        <X className="w-8 h-8" />
                    </button>

                    <div
                        className="w-full h-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={selectedChant.imageUrl}
                            alt={selectedChant.title}
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
                        />
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-center">
                        <h3 className="text-xl font-bold text-[#FFB81C] drop-shadow-md">{selectedChant.title}</h3>
                        <p className="text-white/60 text-sm mt-1">Tap anywhere outside to close</p>
                    </div>
                </div>
            )}
        </div>
    );
};
