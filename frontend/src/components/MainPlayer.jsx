import React, { useEffect, useRef, useState } from 'react';
import HLSPlayer from '../HLSPlayer';
import { TrackCover, PlaylistCover } from './SharedComponents';
import { formatTime } from '../utils/helpers';

const MainPlayer = ({ 
    playlists, currentPlaylist, switchPlaylist, showPlaylistSidebar, setShowPlaylistSidebar,
    tracks, searchTerm, setSearchTerm, mainPlayerCurrentTrack, playTrackInMainPlayer,
    mainPlayerIsPlaying, setMainPlayerIsPlaying, mainPlayerPrevTrack, mainPlayerNextTrack,
    mainPlayerCurrentTime, mainPlayerDuration, setMainPlayerCurrentTime, setMainPlayerDuration,
    mainPlayerVolume, setMainPlayerVolume, mainAudioRef, formatTimeFn
}) => {
    const hlsPlayerRef = useRef(null);
    const [localCurrentTime, setLocalCurrentTime] = useState(0);
    const [localDuration, setLocalDuration] = useState(0);
    const isSeekingRef = useRef(false);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (!videoElement || !mainPlayerCurrentTrack?.url) return;

        if (mainPlayerIsPlaying) {
            videoElement.play().catch(e => console.error('Play error:', e));
        } else {
            videoElement.pause();
        }
    }, [mainPlayerIsPlaying, mainPlayerCurrentTrack?.url]);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (videoElement) {
            videoElement.volume = mainPlayerVolume;
        }
    }, [mainPlayerVolume]);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (!videoElement) return;

        const handleTimeUpdate = () => {
            const newTime = videoElement.currentTime;
            setLocalCurrentTime(newTime);
            setMainPlayerCurrentTime(newTime);
        };

        const handleLoadedMetadata = () => {
            console.log('🎵 Main player duration:', videoElement.duration);
            setLocalDuration(videoElement.duration);
            if (setMainPlayerDuration) {
                setMainPlayerDuration(videoElement.duration);
            }
        };

        const handlePlay = () => {
            console.log('🎵 Main player playing');
            if (!mainPlayerIsPlaying) {
                setMainPlayerIsPlaying(true);
            }
        };

        const handlePause = () => {
            console.log('🎵 Main player paused');
            if (mainPlayerIsPlaying) {
                setMainPlayerIsPlaying(false);
            }
        };

        const handleEnded = () => {
            console.log('🎵 Main player ended');
            mainPlayerNextTrack();
        };

        const handleError = (e) => {
            console.error('❌ Main player error:', e);
        };

        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('pause', handlePause);
        videoElement.addEventListener('ended', handleEnded);
        videoElement.addEventListener('error', handleError);

        return () => {
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.removeEventListener('play', handlePlay);
            videoElement.removeEventListener('pause', handlePause);
            videoElement.removeEventListener('ended', handleEnded);
            videoElement.removeEventListener('error', handleError);
        };
    }, [mainPlayerCurrentTrack?.url]);

    useEffect(() => {
        const videoElement = hlsPlayerRef.current;
        if (videoElement && Math.abs(videoElement.currentTime - mainPlayerCurrentTime) > 1) {
            videoElement.currentTime = mainPlayerCurrentTime;
        }
    }, [mainPlayerCurrentTime]);

    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        const videoElement = hlsPlayerRef.current;
        if (videoElement) {
            isSeekingRef.current = true;
            videoElement.currentTime = newTime;
            setMainPlayerCurrentTime(newTime);
            setLocalCurrentTime(newTime);
            setTimeout(() => {
                isSeekingRef.current = false;
            }, 500);
        }
    };

    const handlePlayPause = () => {
        if (mainPlayerIsPlaying) {
            setMainPlayerIsPlaying(false);
        } else {
            if (mainPlayerCurrentTrack) {
                setMainPlayerIsPlaying(true);
                const videoElement = hlsPlayerRef.current;
                if (videoElement) {
                    videoElement.play().catch(e => console.error('Play error:', e));
                }
            }
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setMainPlayerVolume(newVolume);
        if (hlsPlayerRef.current) {
            hlsPlayerRef.current.volume = newVolume;
        }
    };

    return (
        <div className="main-player-container">
            <div className="main-player-header">
                <div className="main-player-title">
                    <h2>Привет</h2>
                    <p>Выберите плейлист и наслаждайтесь музыкой</p>
                </div>
            </div>

            <div className={`playlists-sidebar ${showPlaylistSidebar ? 'visible' : 'hidden'}`}>
                <div className="sidebar-header">
                    <h3>Мои плейлисты</h3>
                    <button className="toggle-sidebar-btn" onClick={() => setShowPlaylistSidebar(!showPlaylistSidebar)}>
                        {showPlaylistSidebar ? '◀' : '▶'}
                    </button>
                </div>
                <div className="playlists-list">
                    {playlists.map((playlist) => (
                        <div
                            key={playlist.id}
                            className={`playlist-item ${currentPlaylist?.id === playlist.id ? 'active' : ''}`}
                            onClick={() => switchPlaylist(playlist)}
                        >
                            <PlaylistCover playlist={playlist} />
                            <div className="playlist-info">
                                <div className="playlist-title">
                                    {playlist.is_main && '⭐ '}
                                    {playlist.is_user_created && '💾 '}
                                    {playlist.title}
                                </div>
                                <div className="playlist-count">
                                    {playlist.actual_count || playlist.tracks?.length || 0} треков
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {!showPlaylistSidebar && (
                <button className="show-sidebar-btn" onClick={() => setShowPlaylistSidebar(true)}>
                    Плейлисты
                </button>
            )}

            <div className="main-player-content">
                <div className="current-playlist-info">
                    <PlaylistCover playlist={currentPlaylist} className="current-playlist-cover" />
                    <div className="playlist-details">
                        <h3>{currentPlaylist?.title || 'Выберите плейлист'}</h3>
                        {currentPlaylist?.description && <p>{currentPlaylist.description}</p>}
                    </div>
                </div>
                <div className="playlist-tracks">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder={`Поиск в "${currentPlaylist?.title || ''}"...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="tracks-list">
                        {tracks.filter(track =>
                            track.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            track.artist?.toLowerCase().includes(searchTerm.toLowerCase())
                        ).length > 0 ? (
                            tracks.filter(track =>
                                track.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                track.artist?.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map((track, index) => (
                                <div 
                                    key={track.id || track.vk_id || index} 
                                    className={`track-item ${mainPlayerCurrentTrack?.id === track.id ? 'active' : ''}`}
                                    onClick={() => playTrackInMainPlayer(track, index)}
                                >
                                    <TrackCover track={track} size="small" />
                                    <div className="track-details">
                                        <div className="track-title">{track.title || 'Без названия'}</div>
                                        <div className="track-artist">{track.artist || 'Неизвестный'}</div>
                                    </div>
                                    <div className="track-duration">{formatTime(track.duration)}</div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-playlist">
                                {searchTerm ? '🔍 Треки не найдены' : 'Плейлист пуст. Нажмите "Синхронизация" для загрузки музыки'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {mainPlayerCurrentTrack && (
                <div className="main-player-bar">
                    <div className="main-player-track-info">
                        <TrackCover track={mainPlayerCurrentTrack} size="small" className="main-player-cover" />
                        <div className="main-player-track-details">
                            <div className="main-player-track-title">{mainPlayerCurrentTrack.title}</div>
                            <div className="main-player-track-artist">{mainPlayerCurrentTrack.artist}</div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'none' }}>
                        <HLSPlayer
                            ref={hlsPlayerRef}
                            src={mainPlayerCurrentTrack?.url || ''}
                            autoPlay={mainPlayerIsPlaying && !!mainPlayerCurrentTrack?.url}
                        />
                    </div>
                    
                    <div className="main-player-controls">
                        <div className="main-control-group">
                            <button className="main-control-btn" onClick={mainPlayerPrevTrack}>⏮️</button>
                            <button className="main-control-btn main-play-btn" onClick={handlePlayPause}>
                                {mainPlayerIsPlaying ? '⏸️' : '▶️'}
                            </button>
                            <button className="main-control-btn" onClick={mainPlayerNextTrack}>⏭️</button>
                        </div>
                        <div className="main-progress-container">
                            <span className="main-time">{formatTime(mainPlayerCurrentTime || localCurrentTime)}</span>
                            <input
                                type="range"
                                className="main-progress-bar"
                                value={mainPlayerCurrentTime || localCurrentTime}
                                max={mainPlayerDuration || localDuration || 0}
                                onChange={handleSeek}
                            />
                            <span className="main-time">{formatTime(mainPlayerDuration || localDuration)}</span>
                        </div>
                        <div className="main-volume-container">
                            <span>🔊</span>
                            <input
                                type="range"
                                className="main-volume-slider"
                                min="0"
                                max="1"
                                step="0.01"
                                value={mainPlayerVolume}
                                onChange={handleVolumeChange}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainPlayer;