
import React, { useState } from 'react';
import { Sport, Game } from '../types';
import { Plus, Trash2, X, Trophy, AlertTriangle } from 'lucide-react';

interface SportsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  sports: Sport[];
  games: Game[];
  onAddSport: (name: string, venueIds: string[]) => void;
  onDeleteSport: (id: string) => void;
  onUpdateSportVenues: (id: string, venueIds: string[]) => void;
}

import { VENUES } from '../constants';

export const SportsManager: React.FC<SportsManagerProps> = ({
  isOpen,
  onClose,
  sports,
  games,
  onAddSport,
  onDeleteSport,
  onUpdateSportVenues
}) => {
  const [newSportName, setNewSportName] = useState('');
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newSportName.trim()) {
      onAddSport(newSportName.trim(), selectedVenues);
      setNewSportName('');
      setSelectedVenues([]);
    }
  };

  const handleDelete = (id: string) => {
    const gameCount = games.filter(g => g.sportId === id).length;
    if (gameCount > 0) {
      if (!window.confirm(`Warning: This sport has ${gameCount} recorded games. Deleting it will remove these games and their attendance records. Continue?`)) {
        return;
      }
    }
    onDeleteSport(id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#154734] rounded-t-xl">
          <div className="flex items-center gap-2 text-white">
            <Trophy className="w-6 h-6" />
            <h2 className="text-xl font-bold">Manage Sports</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
          <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">Add New Sport</label>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newSportName}
                onChange={(e) => setNewSportName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154734] focus:border-transparent"
                placeholder="e.g. Rugby"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Venue(s)</label>
                <div className="flex flex-wrap gap-2">
                  {VENUES.map(venue => (
                    <button
                      key={venue.id}
                      onClick={() => {
                        setSelectedVenues(prev =>
                          prev.includes(venue.id)
                            ? prev.filter(id => id !== venue.id)
                            : [...prev, venue.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedVenues.includes(venue.id)
                          ? 'bg-[#154734] text-[#FFB81C] shadow-sm'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                    >
                      {venue.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={!newSportName.trim()}
                className="bg-[#154734] text-white px-4 py-2.5 rounded-lg font-bold hover:bg-[#0f3325] disabled:opacity-50 flex items-center justify-center gap-2 mt-1 shadow-md transition-transform active:scale-95"
              >
                <Plus className="w-4 h-4" /> Add Sport
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Active Sports List</h3>
            {sports.length === 0 ? (
              <p className="text-gray-400 italic text-sm">No sports added yet.</p>
            ) : (
              sports.map(sport => {
                const gameCount = games.filter(g => g.sportId === sport.id).length;
                return (
                  <div key={sport.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-bold text-gray-800 text-lg">{sport.name}</span>
                        <span className="text-xs text-gray-400 ml-2">({gameCount} games)</span>
                      </div>
                      <button
                        onClick={() => handleDelete(sport.id)}
                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded transition-colors"
                        title="Delete Sport"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned Venues</label>
                      <div className="flex flex-wrap gap-1.5">
                        {VENUES.map(venue => {
                          const isSelected = sport.venueIds?.includes(venue.id);
                          return (
                            <button
                              key={venue.id}
                              onClick={() => {
                                const current = sport.venueIds || [];
                                const next = isSelected
                                  ? current.filter(id => id !== venue.id)
                                  : [...current, venue.id];
                                onUpdateSportVenues(sport.id, next);
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${isSelected
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                              {venue.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-600" />
          <p>Changes made here will update the dashboard and navigation menu immediately for all users after saving/syncing.</p>
        </div>
      </div>
    </div>
  );
};
