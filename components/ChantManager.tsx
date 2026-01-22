
import React, { useState, useEffect } from 'react';
import { Chant } from '../types';
import { supabase } from '../utils/supabaseClient';
import { X, Upload, Music, Loader2, Trash2 } from 'lucide-react';

interface ChantManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ChantManager: React.FC<ChantManagerProps> = ({ isOpen, onClose }) => {
    const [chants, setChants] = useState<Chant[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        if (isOpen) fetchChants();
    }, [isOpen]);

    const fetchChants = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('chants')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching chants:', error);
            alert('Error fetching chants');
        } else {
            // Map snake_case to camelCase if needed, but assuming simple map
            // Our Schema: id, title, image_url, created_at
            const mapped: Chant[] = (data || []).map((c: any) => ({
                id: c.id,
                title: c.title,
                imageUrl: c.image_url,
                createdAt: c.created_at
            }));
            setChants(mapped);
        }
        setIsLoading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file || !title) {
            alert("Please provide a title and select a file.");
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('Chants')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('Chants')
                .getPublicUrl(filePath);

            // 3. Insert into Table
            const { error: dbError } = await supabase
                .from('chants')
                .insert([{ title, image_url: publicUrl }]);

            if (dbError) throw dbError;

            alert("Chant uploaded successfully!");
            setTitle('');
            setFile(null);
            fetchChants();

        } catch (error: any) {
            console.error('Upload error:', error);
            alert('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, imageUrl: string) => {
        if (!confirm("Delete this chant?")) return;

        try {
            // 1. Delete from DB
            const { error: dbError } = await supabase.from('chants').delete().eq('id', id);
            if (dbError) throw dbError;

            // 2. Delete from Storage (Optional, good cleanup)
            const urlParts = imageUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            if (fileName) {
                await supabase.storage.from('Chants').remove([fileName]);
            }

            fetchChants();
        } catch (e: any) {
            alert("Error deleting chant: " + e.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-[#154734] p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Music className="w-5 h-5" /> Manage Chants
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Upload Section */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <h4 className="font-bold text-[#154734] text-sm uppercase tracking-wide">Upload New Chant</h4>
                        <input
                            type="text"
                            placeholder="Chant Title (e.g. 'Sic Em Bears')"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-[#154734] outline-none"
                        />
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-xs file:font-semibold
                                file:bg-[#154734] file:text-white
                                hover:file:bg-[#0f3325]"
                            />
                        </div>
                        <button
                            onClick={handleUpload}
                            disabled={uploading}
                            className="w-full bg-[#154734] text-white py-2 rounded font-bold hover:bg-[#0f3325] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {uploading ? "Uploading..." : "Upload Chant"}
                        </button>
                    </div>

                    {/* List Section */}
                    <div className="space-y-3">
                        <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide border-b pb-2">Existing Chants</h4>
                        {isLoading ? (
                            <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#154734]" /></div>
                        ) : chants.length === 0 ? (
                            <div className="text-gray-400 text-center italic text-sm">No chants uploaded yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {chants.map(chant => (
                                    <div key={chant.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                        <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden shrink-0 border">
                                            <img src={chant.imageUrl} alt={chant.title} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-[#154734] truncate">{chant.title}</p>
                                            <p className="text-xs text-gray-400">{new Date(chant.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(chant.id, chant.imageUrl)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
