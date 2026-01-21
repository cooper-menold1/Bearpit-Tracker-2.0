
import React from 'react';
import { X } from 'lucide-react';

interface QRCodeDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  publicUrl?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ isOpen, onClose, publicUrl }) => {
  if (!isOpen) return null;

  // Use the configured public URL if available, otherwise fallback to current origin
  const baseUrl = publicUrl || window.location.origin;
  
  // Ensure no double slashes if publicUrl ends with /
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const formUrl = `${cleanBaseUrl}?mode=form`;
  
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(formUrl)}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full text-center overflow-hidden">
        <div className="bg-[#154734] p-4 flex justify-between items-center">
            <h2 className="text-white font-bold text-lg">Attendance Check-In</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white">
                <X className="w-6 h-6" />
            </button>
        </div>
        
        <div className="p-8 flex flex-col items-center gap-4">
            <div className="bg-white p-2 rounded-lg border-2 border-[#FFB81C]">
                <img src={qrApiUrl} alt="QR Code" className="w-48 h-48" />
            </div>
            <p className="text-gray-600 text-sm">
                Scan this code to access the attendance check-in form directly.
            </p>
            <div className="bg-gray-100 p-2 rounded text-xs text-gray-500 break-all w-full">
                {formUrl}
            </div>
            {!publicUrl && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    Note: Set "Public App URL" in Settings to ensure this QR code works when printed.
                </p>
            )}
        </div>

        <div className="bg-gray-50 p-4 border-t border-gray-100">
            <button 
                onClick={() => window.print()} 
                className="text-[#154734] font-bold text-sm hover:underline"
            >
                Print this Flyer
            </button>
        </div>
      </div>
    </div>
  );
};
