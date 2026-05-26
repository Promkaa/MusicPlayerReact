// frontend/src/components/SharedComponents.jsx

import { memo, useState } from 'react';
import { getCoverUrl } from '../utils/helpers';

export const TrackCover = memo(({ track, size = 'small', className = '' }) => {
    const [imgError, setImgError] = useState(false);
    const coverUrl = getCoverUrl(track, size);
    
    return (
        <div className={`track-cover-wrapper ${className}`}>
            {coverUrl && !imgError ? (
                <img
                    src={coverUrl}
                    alt={track?.title || 'Обложка'}
                    className={`track-cover-img ${size}`}
                    onError={() => setImgError(true)}
                />
            ) : (
                <div className={`track-cover-placeholder ${size}`}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
            )}
        </div>
    );
});

TrackCover.displayName = 'TrackCover';

// ==================== ЕДИНЫЙ VotingCard (с кнопкой отмены) ====================
export const VotingCard = ({ voting, onVote, onCancel, currentUserId }) => {
    const isAuthor = voting.proposed_by_id === currentUserId;
    const isActive = voting.time_remaining > 0;
    
    return (
        <div className="voting-card">
            <div className="voting-card-header">
                <div className="voting-track-info">
                    <TrackCover track={voting.track} size="small" />
                    <div className="voting-track-details">
                        <div className="voting-track-title">{voting.track.title}</div>
                        <div className="voting-track-artist">{voting.track.artist}</div>
                        <div className="voting-proposed-by">
                            🗳️ Предложил: {voting.proposed_by}
                            {voting.type === 'next' && ' (следующим)'}
                        </div>
                    </div>
                </div>
                <div className="voting-time">
                    ⏱️ {Math.floor(voting.time_remaining / 60)}:
                    {(voting.time_remaining % 60).toString().padStart(2, '0')}
                </div>
            </div>
            
            <div className="voting-card-stats">
                <div className="voting-progress">
                    <div 
                        className="voting-progress-yes" 
                        style={{ width: `${voting.total_participants > 0 ? (voting.votes_yes / voting.total_participants) * 100 : 0}%` }}
                    />
                </div>
                <div className="voting-numbers">
                    <span className="votes-yes">👍 {voting.votes_yes}</span>
                    <span className="votes-no">👎 {voting.votes_no}</span>
                    <span className="votes-total">Всего: {voting.total_voted}/{voting.total_participants}</span>
                </div>
            </div>
            
            <div className="voting-card-buttons">
                {!voting.user_vote && isActive && (
                    <>
                        <button 
                            className="vote-yes-btn" 
                            onClick={() => onVote(voting.id, 'yes')}
                        >
                            👍 За
                        </button>
                        <button 
                            className="vote-no-btn" 
                            onClick={() => onVote(voting.id, 'no')}
                        >
                            👎 Против
                        </button>
                    </>
                )}
                {voting.user_vote && (
                    <span className="voted-indicator">
                        Вы проголосовали {voting.user_vote === 'yes' ? '👍 ЗА' : '👎 ПРОТИВ'}
                    </span>
                )}
                
                {/* Кнопка отмены для автора */}
                {isAuthor && isActive && onCancel && (
                    <button 
                        className="cancel-proposal-btn"
                        onClick={() => onCancel(voting.id)}
                        title="Отменить предложение"
                    >
                        ❌ Отменить
                    </button>
                )}
            </div>
        </div>
    );
};

VotingCard.displayName = 'VotingCard';

// ==================== PlaylistCover ====================
export const PlaylistCover = memo(({ playlist, className = '' }) => {
    const [imgError, setImgError] = useState(false);
    
    return (
        <div className={`playlist-cover-wrapper ${className}`}>
            {playlist?.cover_url && !imgError ? (
                <img
                    src={playlist.cover_url}
                    alt={playlist?.title || 'Плейлист'}
                    className="playlist-cover-img"
                    onError={() => setImgError(true)}
                />
            ) : (
                <div className="playlist-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
            )}
        </div>
    );
});

PlaylistCover.displayName = 'PlaylistCover';
