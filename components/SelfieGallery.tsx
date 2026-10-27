import React, { useMemo, useState } from 'react';
import { Selfie, Member, Game, Sport, BonusPoint, SelfieVote, Role } from '../types';
import { X, User, Folder, Trash2, ChevronDown, ChevronRight, Heart, Trophy, BadgeCheck } from 'lucide-react';
import { MEDIA_APPROVAL_POINTS, mediaApprovalReason } from '../utils/fanTier';

interface SelfieGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    selfies: Selfie[];
    members: Member[];
    games: Game[];
    sports: Sport[];
    onDelete: (id: string, url: string) => void;
    onVote: (selfieId: string, memberId: string) => void;
    bonusPoints: BonusPoint[];
    currentMember: Member;
    selfieVotes: SelfieVote[];
    // Media approval: awards/removes the uploader's 'Media' points for a photo.
    onApproveMedia?: (selfie: Selfie, points: number) => void;
    onRemoveMediaApproval?: (selfie: Selfie) => void;
}

export const SelfieGallery: React.FC<SelfieGalleryProps> = ({
    isOpen, onClose, selfies, members, games, sports, onDelete, onVote, bonusPoints, currentMember, selfieVotes, onApproveMedia, onRemoveMediaApproval
}) => {
    const getMemberName = (id: string) => {
        const m = members.find(mem => mem.id === id);
        return m ? `${m.firstName} ${m.lastName}` : 'Unknown Member';
    };

    // Group by Sport -> Game
    const groupedData = useMemo(() => {
        const data: Record<string, { sportName: string, games: Record<string, Selfie[]> }> = {};

        selfies.forEach(s => {
            const game = games.find(g => g.id === s.gameId);
            const sportId = game ? game.sportId : 'unknown';
            const sportName = sports.find(sp => sp.id === sportId)?.name || 'Unknown Sport';

            if (!data[sportId]) {
                data[sportId] = { sportName, games: {} };
            }
            if (!data[sportId].games[s.gameId]) {
                data[sportId].games[s.gameId] = [];
            }
            data[sportId].games[s.gameId].push(s);
        });

        return data;
    }, [selfies, games, sports]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="photo-gallery-title" className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#154734] shrink-0">
                    <div>
                        <h2 id="photo-gallery-title" className="text-2xl font-bold text-white">Photo Gallery</h2>
                        <p className="text-green-200 text-sm">Verify member attendance photos</p>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    {Object.keys(groupedData).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <div className="bg-gray-100 p-4 rounded-full mb-4">
                                <Folder className="w-8 h-8 text-gray-400" />
                            </div>
                            <p>No photos uploaded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {(Object.entries(groupedData) as [string, { sportName: string, games: Record<string, Selfie[]> }][]).map(([sportId, sportData]) => (
                                <SportSection
                                    key={sportId}
                                    sportName={sportData.sportName}
                                    gamesData={sportData.games}
                                    games={games}
                                    getMemberName={getMemberName}
                                    onDelete={onDelete}
                                    onVote={onVote}
                                    bonusPoints={bonusPoints}
                                    currentMember={currentMember}
                                    selfieVotes={selfieVotes}
                                    onApproveMedia={onApproveMedia}
                                    onRemoveMediaApproval={onRemoveMediaApproval}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Sub-component for Sport Section
const SportSection: React.FC<{
    sportName: string,
    gamesData: Record<string, Selfie[]>,
    games: Game[],
    getMemberName: (id: string) => string,
    onDelete: (id: string, url: string) => void,
    onVote: (selfieId: string, memberId: string) => void,
    bonusPoints: BonusPoint[],
    currentMember: Member,
    selfieVotes: SelfieVote[],
    onApproveMedia?: (selfie: Selfie, points: number) => void,
    onRemoveMediaApproval?: (selfie: Selfie) => void
}> = ({ sportName, gamesData, games, getMemberName, onDelete, onVote, bonusPoints, currentMember, selfieVotes, onApproveMedia, onRemoveMediaApproval }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                    <span className="font-bold text-lg text-[#154734]">{sportName}</span>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                        {(Object.values(gamesData) as Selfie[][]).reduce((acc, curr) => acc + curr.length, 0)} Photos
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 space-y-6 border-t border-gray-100">
                    {Object.entries(gamesData).sort((a, b) => {
                        const gameA = games.find(g => g.id === a[0]);
                        const gameB = games.find(g => g.id === b[0]);
                        return (gameB?.date || '').localeCompare(gameA?.date || '');
                    }).map(([gameId, photos]) => {
                        const game = games.find(g => g.id === gameId);
                        return (
                            <div key={gameId} className="space-y-3">
                                <div className="flex items-baseline gap-2 pb-2 border-b border-gray-100">
                                    <h4 className="font-bold text-gray-800">{game?.opponent || 'Unknown Game'}</h4>
                                    <span className="text-xs text-gray-500">{game?.date} • {game?.location}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {(photos as Selfie[]).map(photo => (
                                        <PhotoCard
                                            key={photo.id}
                                            photo={photo}
                                            memberName={getMemberName(photo.memberId)}
                                            onDelete={onDelete}
                                            onVote={onVote}
                                            isWinner={bonusPoints.some(b => b.reason.includes(`Selfie of the week: ${gameId}`) && b.memberId === photo.memberId)}
                                            currentMember={currentMember}
                                            hasVoted={selfieVotes.some(v => v.selfieId === photo.id && v.memberId === currentMember.id)}
                                            voteCount={selfieVotes.filter(v => v.selfieId === photo.id).length}
                                            mediaApproval={bonusPoints.find(b => b.reason === mediaApprovalReason(photo.id))}
                                            onApproveMedia={onApproveMedia}
                                            onRemoveMediaApproval={onRemoveMediaApproval}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const PhotoCard: React.FC<{
    photo: Selfie,
    memberName: string,
    onDelete: (id: string, url: string) => void,
    onVote: (selfieId: string, memberId: string) => void,
    isWinner: boolean,
    currentMember: Member,
    hasVoted: boolean,
    voteCount: number,
    mediaApproval?: BonusPoint,
    onApproveMedia?: (selfie: Selfie, points: number) => void,
    onRemoveMediaApproval?: (selfie: Selfie) => void
}> = ({ photo, memberName, onDelete, onVote, isWinner, currentMember, hasVoted, voteCount, mediaApproval, onApproveMedia, onRemoveMediaApproval }) => {
    const isAdmin = currentMember.role === Role.ADMIN || currentMember.role === Role.OFFICER;
    // 1 = approved unofficial content, 2 = approved event photography.
    const [mediaPoints, setMediaPoints] = useState(MEDIA_APPROVAL_POINTS.content);
    const [savingApproval, setSavingApproval] = useState(false);
    const runApproval = async (action: () => void | Promise<void>) => {
        setSavingApproval(true);
        try { await action(); } finally { setSavingApproval(false); }
    };

    return (
        <div className={`group relative border rounded-lg overflow-hidden shadow-sm bg-gray-50 hover:shadow-md transition-all ${isWinner ? 'border-yellow-400 border-2' : 'border-gray-100'}`}>
            <div className="aspect-square bg-gray-200 relative overflow-hidden">
                <img
                    src={photo.imageData}
                    alt={`Selfie by ${memberName}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                <div className="absolute top-2 left-2 flex gap-1">
                    {isWinner && (
                        <div className="bg-yellow-400 text-[#154734] p-1.5 rounded-md shadow-lg" title="Selfie of the Week Winner!">
                            <Trophy className="w-4 h-4" />
                        </div>
                    )}
                    {mediaApproval && (
                        <div className="bg-[#154734] text-[#FFB81C] px-1.5 py-1 rounded-md shadow-lg text-[10px] font-bold flex items-center gap-1" title={`Approved for Media, +${mediaApproval.points}`}>
                            <BadgeCheck className="w-3.5 h-3.5" /> Media +{mediaApproval.points}
                        </div>
                    )}
                </div>

                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => { if (window.confirm('Delete this photo permanently?')) onDelete(photo.id, photo.imageData); }}
                            className="bg-red-500 text-white p-1.5 rounded-md hover:bg-red-600 transform scale-90 active:scale-95"
                            title="Delete Photo"
                            aria-label="Delete photo"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}

                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => onVote(photo.id, currentMember.id)}
                            className={`p-1.5 rounded-md transform scale-90 active:scale-95 transition-colors ${hasVoted ? 'bg-[#FFB81C] text-[#154734]' : 'bg-white/90 text-gray-500 hover:text-red-500'}`}
                            title={hasVoted ? "Remove Vote" : "Vote for this photo"}
                            aria-label={hasVoted ? "Remove vote" : "Vote for this photo"}
                        >
                            <Heart className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />
                        </button>
                    )}
                </div>

                {voteCount > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Heart className="w-2.5 h-2.5 fill-red-500 text-red-500" /> {voteCount}
                    </div>
                )}
            </div>
            <div className={`p-2 ${isWinner ? 'bg-yellow-50' : 'bg-white'}`}>
                <div className="flex items-center gap-1 text-gray-900 font-bold text-xs truncate" title={memberName}>
                    <User className="w-3 h-3 text-gray-500 shrink-0" />
                    {memberName}
                </div>
                <div className="mt-1 flex justify-between items-center">
                    <div className="text-[10px] text-gray-400">
                        {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {isWinner && <span className="text-[8px] font-black text-yellow-700 uppercase tracking-tighter">Winner</span>}
                </div>
                {isAdmin && onApproveMedia && onRemoveMediaApproval && (
                    mediaApproval ? (
                        <button
                            type="button"
                            disabled={savingApproval}
                            onClick={() => runApproval(() => onRemoveMediaApproval(photo))}
                            className="mt-2 w-full text-[10px] font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded px-1 py-1 disabled:opacity-50"
                        >
                            Remove approval
                        </button>
                    ) : (
                        <div className="mt-2 flex flex-col gap-1">
                            <select
                                aria-label="Media points"
                                value={mediaPoints}
                                onChange={e => setMediaPoints(Number(e.target.value))}
                                className="w-full border rounded text-[10px] px-1 py-0.5 bg-white"
                            >
                                <option value={MEDIA_APPROVAL_POINTS.content}>+{MEDIA_APPROVAL_POINTS.content} Unofficial content</option>
                                <option value={MEDIA_APPROVAL_POINTS.photography}>+{MEDIA_APPROVAL_POINTS.photography} Event photography</option>
                            </select>
                            <button
                                type="button"
                                disabled={savingApproval}
                                onClick={() => runApproval(() => onApproveMedia(photo, mediaPoints))}
                                className="w-full text-[10px] font-bold text-[#154734] bg-[#FFB81C] hover:bg-yellow-400 rounded px-1 py-1 disabled:opacity-50"
                            >
                                Approve for Media (+{mediaPoints})
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
