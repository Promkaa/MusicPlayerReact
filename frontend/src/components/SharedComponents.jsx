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

export const VotingCard = memo(({ voting, onVote, TrackCoverComponent }) => {
    const hasUserVoted = voting.user_vote !== null;
    const votesYesCount = voting.votes_yes || 0;
    const votesNoCount = voting.votes_no || 0;
    const totalVotes = votesYesCount + votesNoCount;
    const timeRemaining = voting.time_remaining || 0;
    const isExpired = timeRemaining <= 0;
    const isNextVoting = voting.type === 'next';
    
    const TrackCoverComponentToUse = TrackCoverComponent || TrackCover;
    
    return (
        <div className={`proposed-track-card ${isExpired ? 'expired' : ''}`}>
            <div className="proposed-track-header">
                <div className="track-info-main">
                    <TrackCoverComponentToUse track={voting.track} size="small" />
                    <div className="track-details">
                        <div className="track-title">{voting.track?.title || 'Без названия'}</div>
                        <div className="track-artist">{voting.track?.artist || 'Неизвестный'}</div>
                        {isNextVoting && voting.current_track && (
                            <div className="track-next-info">
                                ⏩ После: {voting.current_track.title}
                            </div>
                        )}
                        <div className="track-proposed-by">
                            {isNextVoting ? '🎯 Предложил поставить следующим:' : '📝 Предложил:'} {voting.proposed_by}
                        </div>
                    </div>
                </div>
                <div className="voting-timer-display">
                    <span className={`timer-icon ${timeRemaining <= 10 ? 'urgent' : ''}`}>⏰</span>
                    <span className={`timer-value ${timeRemaining <= 10 ? 'urgent' : ''}`}>
                        {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                    </span>
                </div>
            </div>
            
            <div className="voting-results-detailed">
                <div className="votes-bar-container">
                    <div className="votes-bar">
                        <div 
                            className="votes-yes-bar" 
                            style={{ width: `${totalVotes > 0 ? (votesYesCount / totalVotes) * 100 : 50}%` }}
                        >
                            {votesYesCount > 0 && `👍 ${votesYesCount}`}
                        </div>
                        <div 
                            className="votes-no-bar" 
                            style={{ width: `${totalVotes > 0 ? (votesNoCount / totalVotes) * 100 : 50}%` }}
                        >
                            {votesNoCount > 0 && `👎 ${votesNoCount}`}
                        </div>
                    </div>
                </div>
                
                <div className="voting-stats-detailed">
                    <div className="stat-item yes-stat">
                        <span className="stat-icon">👍</span>
                        <span className="stat-count">{votesYesCount}</span>
                        <span className="stat-label">За</span>
                    </div>
                    <div className="stat-item no-stat">
                        <span className="stat-icon">👎</span>
                        <span className="stat-count">{votesNoCount}</span>
                        <span className="stat-label">Против</span>
                    </div>
                    <div className="stat-item total-stat">
                        <span className="stat-icon">👥</span>
                        <span className="stat-count">{totalVotes}/{voting.total_participants}</span>
                        <span className="stat-label">Проголосовало</span>
                    </div>
                </div>
            </div>
            
            <div className="proposed-track-actions">
                {!hasUserVoted && !isExpired ? (
                    <div className="vote-buttons-detailed">
                        <button 
                            onClick={() => onVote(voting.id, 'yes')} 
                            className="vote-btn-yes"
                        >
                            👍 Голосовать ЗА
                        </button>
                        <button 
                            onClick={() => onVote(voting.id, 'no')} 
                            className="vote-btn-no"
                        >
                            👎 Голосовать ПРОТИВ
                        </button>
                    </div>
                ) : (
                    <div className="vote-status-detailed">
                        {hasUserVoted && (
                            <div className="your-vote-badge">
                                {voting.user_vote === 'yes' ? '👍 Вы проголосовали ЗА' : '👎 Вы проголосовали ПРОТИВ'}
                            </div>
                        )}
                        {isExpired && <div className="status-badge expired">⏰ Время голосования истекло</div>}
                    </div>
                )}
            </div>
        </div>
    );
});

VotingCard.displayName = 'VotingCard';