
import React, { useRef } from 'react';
import { X, Download } from 'lucide-react';

interface QRCodeDisplayProps {
    isOpen: boolean;
    onClose: () => void;
    publicUrl?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ isOpen, onClose, publicUrl }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    if (!isOpen) return null;

    const baseUrl = publicUrl || window.location.origin;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    // Point to the landing page/root as requested
    const qrDataUrl = cleanBaseUrl;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrDataUrl)}`;

    const handleDownload = async () => {
        try {
            const response = await fetch(qrApiUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'BearPit_QR_Code.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed", error);
            alert("Failed to download QR code. Try right-clicking the image.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full text-center overflow-hidden flex flex-col">
                <div className="bg-[#154734] p-6 flex justify-between items-center text-white shrink-0">
                    <h2 className="font-bold text-xl uppercase tracking-wider">Bear Pit QR Code</h2>
                    <button onClick={onClose} className="hover:bg-white/10 rounded-full p-1 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center gap-6 overflow-y-auto">
                    <div className="bg-white p-4 rounded-2xl border-4 border-[#FFB81C] shadow-inner">
                        <img
                            src={qrApiUrl}
                            alt="QR Code"
                            className="w-56 h-56"
                            crossOrigin="anonymous"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-[#154734] font-bold text-lg">Direct Access</p>
                        <p className="text-gray-500 text-sm">
                            Scan to open the Bear Pit Landing Page for chants and attendance.
                        </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-xs text-gray-400 break-all w-full font-mono">
                        {qrDataUrl}
                    </div>

                    <button
                        onClick={handleDownload}
                        className="w-full bg-[#154734] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#0f3325] transition-all transform hover:scale-[1.02] shadow-lg"
                    >
                        <Download className="w-5 h-5" />
                        Download PNG for Jumbotron
                    </button>
                </div>

                <div className="bg-gray-50 p-4 border-t border-gray-100 italic text-[10px] text-gray-400">
                    QR generated for landing page visibility.
                </div>
            </div>
        </div>
    );
};
