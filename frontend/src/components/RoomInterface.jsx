import React, { useEffect, useRef, useState } from 'react';
import { TrackCover, VotingCard } from './SharedComponents';
import HLSPlayer from '../HLSPlayer';
import { formatTime } from '../utils/helpers';

const RoomInterface = ({
    currentRoom, participants, currentUserId, currentUsername, isGuestMode,
    createInviteLink, setRoomToDelete, setShowDeleteConfirmModal, leaveRoom,
    showChat, setShowChat, chatMessages, newMessage, setNewMessage, sendChatMessage,
    isGuestModeFlag, playlists, showPlaylistSelector, setShowPlaylistSelector,
    selectedMusicPlaylist, setSelectedMusicPlaylist, vkSearchTerm, setVkSearchTerm,
    filteredVkTracks, proposeTrack, backToPlaylistSelector, setShowMusicParser,
    roomTracks, roomSearchTerm, setRoomSearchTerm, playTrackFromRoom,
    proposeTrackAsNext, removeTrackFromRoom, currentTrack, isPlaying,
    roomIsShuffled, setRoomIsShuffled, roomRepeatMode, setRoomRepeatMode,
    roomCurrentTrackIndex, roomShuffledIndices, activeVotings, voteForTrack,
    audioRef, currentTime, duration, handleSeek, volume, setVolume, 
    prevTrack, nextTrack, pauseTrack, setIsPlaying, isLoading, 
    TrackCoverComponent, VotingCardComponent
}) => {
    const hlsPlayerRef = useRef(null);
    const [localCurrentTime, setLocalCurrentTime] = useState(0);
    const [localDuration, setLocalDuration] = useState(0);
    const isSeekingRef = useRef(false);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (!videoElement || !currentTrack?.url) return;

        if (isPlaying) {
            videoElement.play().catch(e => {
                console.error('Play error:', e);
            });
        } else {
            videoElement.pause();
        }
    }, [isPlaying, currentTrack?.url]);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (videoElement) {
            videoElement.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (!videoElement) return;

        let lastSentTime = 0;
        const SEND_INTERVAL = 2000; 

        const handleTimeUpdate = () => {
            const newTime = videoElement.currentTime;
            setLocalCurrentTime(newTime);
            
            const now = Date.now();
            if (!isSeekingRef.current && Math.abs(newTime - lastSentTime) > 0.5 && now - lastSentTime > SEND_INTERVAL) {
                lastSentTime = now;
                if (handleSeek && typeof handleSeek === 'function') {
                    const fakeEvent = { target: { value: newTime } };
                    handleSeek(fakeEvent);
                }
            }
        };

        const handleLoadedMetadata = () => {
            console.log('🎵 Video metadata loaded, duration:', videoElement.duration);
            setLocalDuration(videoElement.duration);
            if (duration !== videoElement.duration) {
            }
        };

        const handlePlay = () => {
            console.log('🎵 Video playing');
            if (!isPlaying) {
                if (setIsPlaying) setIsPlaying(true);
            }
        };

        const handlePause = () => {
            console.log('🎵 Video paused');
            if (isPlaying) {
                if (setIsPlaying) setIsPlaying(false);
            }
        };

        const handleEnded = () => {
            console.log('🎵 Video ended');
            nextTrack();
        };

        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('pause', handlePause);
        videoElement.addEventListener('ended', handleEnded);

        return () => {
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.removeEventListener('play', handlePlay);
            videoElement.removeEventListener('pause', handlePause);
            videoElement.removeEventListener('ended', handleEnded);
        };
    }, [currentTrack?.url]);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (videoElement && Math.abs(videoElement.currentTime - currentTime) > 1) {
            videoElement.currentTime = currentTime;
        }
    }, [currentTime]);

    const handleVideoSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        const videoElement = hlsPlayerRef.current;
        if (videoElement) {
            isSeekingRef.current = true;
            videoElement.currentTime = newTime;
            setLocalCurrentTime(newTime);
            setTimeout(() => {
                isSeekingRef.current = false;
            }, 500);
        }
        if (handleSeek) {
            handleSeek(e);
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (hlsPlayerRef.current) {
            hlsPlayerRef.current.volume = newVolume;
        }
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            if (pauseTrack) pauseTrack();
        } else {
            if (currentTrack) {
                setIsPlaying(true);
                const videoElement = hlsPlayerRef.current;
                if (videoElement) {
                    videoElement.play().catch(e => console.error('Play error:', e));
                }
            }
        }
    };

    return (
        <div className="room-interface">
            <div className="room-header">
                <div className="room-header-left">
                    <h2>🎵 {currentRoom.name}</h2>
                    <span className="room-scenario-badge-header">
                        {currentRoom.scenario === 'withVoting' && '🗳️ Голосование'}
                        {currentRoom.scenario === 'withoutVoting' && '🎵 Без голосования'}
                    </span>
                    <button onClick={createInviteLink} className="invite-link-btn">🔗 Ссылка-приглашение</button>
                    {(currentRoom.creator === currentUsername || currentRoom.creator_id === currentUserId) && (
                        <button onClick={() => {
                            setRoomToDelete(currentRoom);
                            setShowDeleteConfirmModal(true);
                        }} className="delete-room-btn-header">🗑️ Удалить</button>
                    )}
                </div>
                <div className="room-header-right">
                    <button onClick={leaveRoom} className="leave-room-btn">🚪 Выйти из комнаты</button>
                </div>
            </div>

            <div className="room-content">
                <div className="room-participants">
                    <h3>👥 Участники ({participants.length})</h3>
                    <div className="participants-list">
                        {participants.map(participant => (
                            <div key={participant.id} className="participant-item">
                                <span className="participant-name">
                                    {participant.name}
                                    {participant.isCreator && ' 👑'}
                                    {participant.id === currentUserId && ' (Вы)'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {showChat && (
                    <div className="room-chat">
                        <div className="chat-header">
                            <h3>💬 Чат</h3>
                            <button className="toggle-chat-btn" onClick={() => setShowChat(false)}>✕</button>
                        </div>
                        <div className="chat-messages">
                            {chatMessages.map((msg, idx) => (
                                <div key={msg.id || idx} className={`chat-message ${msg.user_id === 'system' ? 'system' : ''}`}>
                                    <span className="message-user">{msg.user_name}:</span>
                                    <span className="message-text">{msg.message}</span>
                                    <span className="message-time">
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="chat-input">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                                placeholder="Напишите сообщение..."
                            />
                            <button onClick={sendChatMessage}>📤</button>
                        </div>
                    </div>
                )}

                {!showChat && (
                    <button className="show-chat-btn" onClick={() => setShowChat(true)}>💬</button>
                )}

                <div className="room-tracks-container">
                    {!isGuestModeFlag && (
                        <div className="vk-tracks-section">
                            <div className="section-header">
                                <div className="header-top">
                                    <h3>🔍 Поиск музыки</h3>
                                    {!showPlaylistSelector && selectedMusicPlaylist && (
                                        <button className="back-to-playlists-btn" onClick={backToPlaylistSelector}>
                                            ← Назад к плейлистам
                                        </button>
                                    )}
                                </div>
                                {!showPlaylistSelector && selectedMusicPlaylist && (
                                    <div className="current-source-info">
                                        <span className="source-playlist-name">
                                            📀 {selectedMusicPlaylist.title} • {selectedMusicPlaylist.tracks?.length || 0} треков
                                        </span>
                                    </div>
                                )}
                                {!showPlaylistSelector && (
                                    <div className="search-box">
                                        <input
                                            type="text"
                                            placeholder={`Поиск в "${selectedMusicPlaylist?.title || 'плейлисте'}"...`}
                                            value={vkSearchTerm}
                                            onChange={(e) => setVkSearchTerm(e.target.value)}
                                            className="search-input-vk"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {showPlaylistSelector && (
                                <div className="playlists-selector">
                                    <div className="playlists-grid">
                                        {playlists.map((playlist) => (
                                            <div
                                                key={playlist.id}
                                                className="playlist-selector-card"
                                                onClick={() => {
                                                    setSelectedMusicPlaylist(playlist);
                                                    setShowPlaylistSelector(false);
                                                    setVkSearchTerm('');
                                                }}
                                            >
                                                <PlaylistCover playlist={playlist} className="playlist-selector-cover" />
                                                <div className="playlist-selector-info">
                                                    <div className="playlist-selector-title">
                                                        {playlist.is_main && '⭐ '}
                                                        {playlist.is_user_created && '💾 '}
                                                        {playlist.title}
                                                    </div>
                                                    <div className="playlist-selector-count">
                                                        🎵 {playlist.tracks?.length || 0} треков
                                                    </div>
                                                    {playlist.description && (
                                                        <div className="playlist-selector-desc">{playlist.description}</div>
                                                    )}
                                                </div>
                                                <div className="playlist-selector-arrow">→</div>
                                            </div>
                                        ))}
                                    </div>
                                    {playlists.length === 0 && (
                                        <div className="empty-playlists">
                                            <p>📭 Нет доступных плейлистов</p>
                                            <button onClick={() => setShowMusicParser(true)} className="sync-hint-btn">
                                                🎵 Синхронизировать музыку
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {!showPlaylistSelector && selectedMusicPlaylist && (
                                <div className="tracks-list-vk">
                                    {filteredVkTracks.length > 0 ? (
                                        filteredVkTracks.map((track, index) => {
                                            const isAlreadyInRoom = roomTracks.some(t => t.id === track.id || t.vk_id === track.vk_id);
                                            const isAlreadyProposed = activeVotings.some(v => v.track.id === track.id || v.track.vk_id === track.vk_id);
                                            const isDisabled = isAlreadyInRoom || isAlreadyProposed;
                                            
                                            let buttonText = '➕';
                                            let buttonTitle = 'Предложить трек';
                                            if (isAlreadyInRoom) {
                                                buttonText = '✓';
                                                buttonTitle = 'Уже в плейлисте';
                                            } else if (isAlreadyProposed) {
                                                buttonText = '⏳';
                                                buttonTitle = 'Уже предложен';
                                            }
                                            
                                            return (
                                                <div key={track.id || track.vk_id || index} className="vk-track-item">
                                                    <div className="track-info">
                                                        <TrackCoverComponent track={track} size="small" />
                                                        <div className="track-details">
                                                            <div className="track-title">{track.title || 'Без названия'}</div>
                                                            <div className="track-artist">{track.artist || 'Неизвестный'}</div>
                                                            <div className="track-duration-mini">{formatTime(track.duration)}</div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        className={`add-to-room-btn ${isDisabled ? 'disabled' : ''}`}
                                                        onClick={() => !isDisabled && proposeTrack(track)}
                                                        disabled={isDisabled}
                                                        title={buttonTitle}
                                                    >
                                                        {buttonText}
                                                    </button>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="empty-tracks">
                                            {vkSearchTerm ? '🔍 Песни не найдены' : '🎵 Введите текст для поиска в плейлисте'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="room-tracks-section">
                        <div className="section-header">
                            <div className="header-top">
                                <h3>🎵 Плейлист комнаты ({roomTracks.length})</h3>
                                <div className="room-player-controls-header">
                                    <button
                                        className={`room-control-btn-small ${roomRepeatMode === 'one' ? 'active' : ''}`}
                                        onClick={() => setRoomRepeatMode(roomRepeatMode === 'one' ? 'off' : 'one')}
                                        title="Повтор трека">🔂</button>
                                    <button
                                        className={`room-control-btn-small ${roomRepeatMode === 'all' ? 'active' : ''}`}
                                        onClick={() => setRoomRepeatMode(roomRepeatMode === 'all' ? 'off' : 'all')}
                                        title="Повтор плейлиста">🔁</button>
                                    <button
                                        className={`room-control-btn-small ${roomIsShuffled ? 'active' : ''}`}
                                        onClick={() => setRoomIsShuffled(!roomIsShuffled)}
                                        title="Перемешать">🔀</button>
                                </div>
                            </div>
                            <div className="search-box">
                                <input
                                    type="text"
                                    placeholder="Поиск в плейлисте комнаты..."
                                    value={roomSearchTerm}
                                    onChange={(e) => setRoomSearchTerm(e.target.value)}
                                    className="search-input-room"
                                />
                            </div>
                        </div>
                        <div className="tracks-list-room">
                            {roomTracks.filter(track =>
                                track.title?.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
                                track.artist?.toLowerCase().includes(roomSearchTerm.toLowerCase())
                            ).length > 0 ? (
                                roomTracks.filter(track =>
                                    track.title?.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
                                    track.artist?.toLowerCase().includes(roomSearchTerm.toLowerCase())
                                ).map((track, idx) => {
                                    const originalIndex = roomTracks.findIndex(t => t.id === track.id || t.vk_id === track.vk_id);
                                    const displayIndex = roomIsShuffled ? roomShuffledIndices.findIndex(i => i === originalIndex) : originalIndex;
                                    const isActive = currentTrack?.id === track.id || currentTrack?.vk_id === track.vk_id;
                                    
                                    return (
                                        <div key={track.id || track.vk_id || idx} className={`room-track-item ${isActive ? 'active' : ''}`}>
                                            <div className="track-info" onClick={() => playTrackFromRoom(track, displayIndex)}>
                                                <div className="track-number">
                                                    {isActive && isPlaying ? '🎵' : (displayIndex + 1)}
                                                </div>
                                                <TrackCoverComponent track={track} size="small" />
                                                <div className="track-details">
                                                    <div className="track-title">{track.title || 'Без названия'}</div>
                                                    <div className="track-artist">{track.artist || 'Неизвестный'}</div>
                                                    <div className="track-added-by">➕ {track.added_by || (track.added_by_id?.slice(0, 8))}</div>
                                                </div>
                                                <div className="track-duration">{formatTime(track.duration)}</div>
                                            </div>
                                            <div className="room-track-item-buttons">
                                                <button 
                                                    onClick={() => proposeTrackAsNext(track)}
                                                    className="play-next-btn"
                                                    title="Поставить следующим после текущего"
                                                >
                                                    ⏩
                                                </button>
                                                {(track.added_by_id === currentUserId || participants.find(p => p.id === currentUserId && p.isCreator)) && (
                                                    <button 
                                                        onClick={() => removeTrackFromRoom(track.id || track.vk_id)}
                                                        className="remove-track-btn" 
                                                        title="Удалить"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="empty-tracks">
                                    {roomSearchTerm ? '🔍 Песни не найдены' : '🎵 Нет песен. Выберите плейлист слева и добавьте треки!'}
                                </div>
                            )}
                        </div>
                    </div>

                    {currentRoom.scenario === 'withVoting' && activeVotings.length > 0 && (
                        <div className="proposed-tracks-section">
                            <div className="section-header">
                                <div className="header-top">
                                    <h3>🗳️ Активные голосования ({activeVotings.length})</h3>
                                    <span className="voting-info-badge">Голосуйте за треки, которые хотите добавить или поставить следующими</span>
                                </div>
                            </div>
                            <div className="tracks-list-proposed">
                                {activeVotings.map((voting) => (
                                    <VotingCardComponent
                                        key={voting.id}
                                        voting={voting}
                                        onVote={voteForTrack}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="room-player">
                <div className="room-player-content">
                    <div className="room-player-track-info">
                        <TrackCoverComponent track={currentTrack} size="small" className="room-player-cover" />
                        <div className="room-player-track-details">
                            <div className="room-player-track-title">{currentTrack?.title || 'Выберите трек'}</div>
                            <div className="room-player-track-artist">{currentTrack?.artist || 'Нажмите на песню в плейлисте комнаты'}</div>
                        </div>
                    </div>
                    
                    <div className="room-player-hls-container" style={{ display: 'none' }}>
                        <HLSPlayer
                            ref={hlsPlayerRef}
                            src={currentTrack?.url || ''}
                            autoPlay={isPlaying && !!currentTrack?.url}
                        />
                    </div>
                    
                    <div className="room-player-controls">
                        <div className="room-control-group">
                            <button className="room-control-btn" onClick={prevTrack} disabled={!currentTrack || roomTracks.length === 0}>⏮️</button>
                            <button className="room-control-btn room-play-btn" onClick={handlePlayPause} disabled={!currentTrack || isLoading}>
                                {isLoading ? '⏳' : (isPlaying ? '⏸️' : '▶️')}
                            </button>
                            <button className="room-control-btn" onClick={nextTrack} disabled={!currentTrack || roomTracks.length === 0}>⏭️</button>
                        </div>
                        <div className="room-progress-container">
                            <span className="room-time">{formatTime(currentTime || localCurrentTime)}</span>
                            <input
                                type="range"
                                className="room-progress-bar"
                                value={currentTime || localCurrentTime}
                                max={duration || localDuration || 0}
                                onChange={handleVideoSeek}
                                disabled={!currentTrack}
                            />
                            <span className="room-time">{formatTime(duration || localDuration)}</span>
                        </div>
                        <div className="room-volume-container">
                            <span>🔊</span>
                            <input
                                type="range"
                                className="room-volume-slider"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PlaylistCover = ({ playlist, className }) => {
    const [imgError, setImgError] = React.useState(false);
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
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
            )}
        </div>
    );
};

export default RoomInterface;