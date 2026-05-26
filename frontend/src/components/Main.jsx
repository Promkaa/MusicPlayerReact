'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import MusicAPI from './api';
import '../css/playlist.css';

// Utils
import { shuffleArray, formatTime, getCoverUrl, extractTokenFromUrl } from '../utils/helpers';
import { saveAuthState, saveAppState, loadAppState as loadAppStateUtil } from '../utils/storage';

// Hooks
import { useVoting } from '../hooks/useVoting';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';

// Components
import { TrackCover, PlaylistCover, VotingCard } from './SharedComponents';
import MusicParserModal from './MusicParserModal';
import { CreateRoomModal, InviteModal, DeleteConfirmModal } from './Modals';
import AuthScreen from './AuthScreen';
import MainPlayer from './MainPlayer';
import RoomInterface from './RoomInterface';

const Main = () => {
    // Auth states
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessToken, setAccessToken] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [isInitializing, setIsInitializing] = useState(true);
    const [currentUsername, setCurrentUsername] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');

    // Режимы воспроизведения комнаты
    const [roomPlaybackMode, setRoomPlaybackMode] = useState('sync');
    const [isHost, setIsHost] = useState(false);
    
    // Guest mode states
    const [isGuestMode, setIsGuestMode] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [pendingRoomId, setPendingRoomId] = useState(null);
    
    // Playlist states
    const [playlists, setPlaylists] = useState([]);
    const [currentPlaylist, setCurrentPlaylist] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [filteredVkTracks, setFilteredVkTracks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [vkSearchTerm, setVkSearchTerm] = useState('');
    
    // Состояние для отображения плейлистов в поиске музыки
    const [showPlaylistSelector, setShowPlaylistSelector] = useState(true);
    const [selectedMusicPlaylist, setSelectedMusicPlaylist] = useState(null);
    const [votingDuration, setVotingDuration] = useState(60);
    
    // Main player states
    const [mainPlayerCurrentTrack, setMainPlayerCurrentTrack] = useState(null);
    const [mainPlayerIsPlaying, setMainPlayerIsPlaying] = useState(false);
    const [mainPlayerCurrentTime, setMainPlayerCurrentTime] = useState(0);
    const [mainPlayerDuration, setMainPlayerDuration] = useState(0);
    const [mainPlayerVolume, setMainPlayerVolume] = useState(0.7);
    const [mainPlayerPlaylistTracks, setMainPlayerPlaylistTracks] = useState([]);
    const [mainPlayerCurrentIndex, setMainPlayerCurrentIndex] = useState(-1);
    
    // Room player states
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.7);
    const [isLoading, setIsLoading] = useState(false);
    
    // Room states
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [roomName, setRoomName] = useState('');
    const [roomSearchTerm, setRoomSearchTerm] = useState('');
    const [participants, setParticipants] = useState([]);
    const [roomTracks, setRoomTracks] = useState([]);
    const [roomScenario, setRoomScenario] = useState('withVoting');
    const [roomCurrentTrackIndex, setRoomCurrentTrackIndex] = useState(-1);
    const [roomIsShuffled, setRoomIsShuffled] = useState(false);
    const [roomRepeatMode, setRoomRepeatMode] = useState('off');
    const [roomShuffledIndices, setRoomShuffledIndices] = useState([]);
    
    // UI states
    const [showPlaylistSidebar, setShowPlaylistSidebar] = useState(false);
    const [showMakeRoom, setShowMakeRoom] = useState(false);
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState(null);
    const [showMusicParser, setShowMusicParser] = useState(false);
    const [showMainPlayer, setShowMainPlayer] = useState(true);
    
    // Invite link state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    
    // Parser states
    const [isParsing, setIsParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState(0);
    const [parseStatus, setParseStatus] = useState('');
    const [musicStats, setMusicStats] = useState(null);
    
    // Chat states
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    
    // Unified voting states (both add and next voting)
    const [activeVotings, setActiveVotings] = useState([]);
    
    // Refs
    const audioRef = useRef(null);
    const mainAudioRef = useRef(null);
    const roomTracksContainerRef = useRef(null);

    const { votingTimersRef, clearVotingTimer, clearAllVotingTimers, startVotingTimer } = useVoting();
    
    const addSystemMessage = (message) => {
        const systemMsg = {
            id: 'system_' + Date.now() + '_' + Math.random(),
            user_id: 'system',
            user_name: '💬 Система',
            message: message,
            timestamp: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, systemMsg]);
    };

    const { wsRef, connectWebSocket, disconnectWebSocket } = useWebSocket(
    setCurrentRoom,
    setParticipants,
    setRoomTracks,
    setRoomScenario,
    setRoomCurrentTrackIndex,
    setCurrentTrack,
    setIsPlaying,
    setCurrentTime,
    addSystemMessage,
    setActiveVotings,
    clearVotingTimer,
    setChatMessages,
    roomScenario,
    currentTrack,   
    audioRef,
    setRoomPlaybackMode,
    setIsHost
);
    
    const { isVerifying, authError, setAuthError, verifyToken, handleLogin, handleLogout, joinAsGuest } = useAuth(
        setIsAuthenticated, setAccessToken, setCurrentUsername, setCurrentUserId,
        setIsGuestMode, setPlaylists, setCurrentPlaylist, setTracks, setFilteredVkTracks,
        setMainPlayerPlaylistTracks, setCurrentRoom, setRooms, setRoomTracks,
        setActiveVotings, setParticipants, setChatMessages, setSelectedMusicPlaylist,
        setShowPlaylistSelector, setShowMainPlayer, setMainPlayerCurrentTrack,
        setMainPlayerIsPlaying, audioRef, mainAudioRef, disconnectWebSocket,
        clearAllVotingTimers, currentRoom
    );

    // Helper functions
    const createInviteLink = () => {
        if (!currentRoom) return;
        const link = `${window.location.origin}${window.location.pathname}?invite=${currentRoom.id}`;
        setInviteLink(link);
        setShowInviteModal(true);
        navigator.clipboard.writeText(link).then(() => {
            addSystemMessage(`Ссылка-приглашение скопирована в буфер обмена`);
        });
    };

    const saveAppStateCallback = useCallback(() => {
        saveAppState(accessToken, isAuthenticated, currentUsername, currentUserId, currentPlaylist, volume, isGuestMode);
    }, [accessToken, isAuthenticated, currentUsername, currentUserId, currentPlaylist, volume, isGuestMode]);

    const loadAppState = useCallback(async () => {
        await loadAppStateUtil(verifyToken, handleLogout, setAccessToken, setCurrentUsername, 
                              setCurrentUserId, setIsAuthenticated, setIsGuestMode, setVolume, 
                              setMainPlayerVolume, setIsInitializing);
    }, [verifyToken, handleLogout]);

    

    // API functions
    const fetchMusicData = async () => {
        if (!currentUserId || isGuestMode) return;
        
        try {
            const data = await MusicAPI.getMusicData(currentUserId);
            
            if (data.playlists && data.playlists.length > 0) {
                setPlaylists(data.playlists);
                
                const savedState = localStorage.getItem('vk_music_app_state');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    const savedPlaylist = data.playlists.find(p => p.id == state.currentPlaylistId);
                    if (savedPlaylist) {
                        setCurrentPlaylist(savedPlaylist);
                        setTracks(savedPlaylist.tracks || []);
                        setFilteredVkTracks(savedPlaylist.tracks || []);
                        setMainPlayerPlaylistTracks(savedPlaylist.tracks || []);
                    } else {
                        const mainPlaylist = data.playlists.find(p => p.is_main) || data.playlists[0];
                        setCurrentPlaylist(mainPlaylist);
                        setTracks(mainPlaylist.tracks || []);
                        setFilteredVkTracks(mainPlaylist.tracks || []);
                        setMainPlayerPlaylistTracks(mainPlaylist.tracks || []);
                    }
                } else {
                    const mainPlaylist = data.playlists.find(p => p.is_main) || data.playlists[0];
                    setCurrentPlaylist(mainPlaylist);
                    setTracks(mainPlaylist.tracks || []);
                    setFilteredVkTracks(mainPlaylist.tracks || []);
                    setMainPlayerPlaylistTracks(mainPlaylist.tracks || []);
                }
            } else {
                const emptyPlaylist = {
                    id: 'empty',
                    title: 'Моя музыка',
                    description: 'Нажмите "Синхронизация" для загрузки музыки',
                    is_main: true,
                    tracks: [],
                    actual_count: 0
                };
                setPlaylists([emptyPlaylist]);
                setCurrentPlaylist(emptyPlaylist);
                setTracks([]);
                setFilteredVkTracks([]);
                setMainPlayerPlaylistTracks([]);
            }
        } catch (error) {
            console.error('Error fetching music data:', error);
        }
    };

    const loadRooms = async () => {
        try {
            const roomsList = await MusicAPI.getRooms();
            setRooms(roomsList);
        } catch (error) {
            console.error('Error loading rooms:', error);
            const savedRooms = localStorage.getItem('musicRooms');
            if (savedRooms) setRooms(JSON.parse(savedRooms));
        }
    };

    const loadMusicStats = async () => {
        if (!currentUserId || isGuestMode) return;
        
        try {
            const stats = await MusicAPI.getMusicStats(currentUserId);
            setMusicStats(stats);
        } catch (error) {
            console.error('Error loading music stats:', error);
            setMusicStats({
                total_tracks: 0,
                total_playlists: 1,
                playlists: [{ id: 'main', title: 'Моя музыка', tracks_count: 0, is_main: true }]
            });
        }
    };

    const selectPlaylistForMusic = (playlist) => {
        setSelectedMusicPlaylist(playlist);
        setShowPlaylistSelector(false);
        setVkSearchTerm('');
    };

    const backToPlaylistSelector = () => {
        setShowPlaylistSelector(true);
        setSelectedMusicPlaylist(null);
        setVkSearchTerm('');
    };

    // Main player functions
    const playTrackInMainPlayer = (track, index) => {
        console.log('playTrackInMainPlayer called:', track?.title, track?.url);
        
        if (!track) {
            console.error('No track provided');
            return;
        }
        
        if (!track.url) {
            console.error('Track has no URL!', track);
            alert('У этого трека нет ссылки для воспроизведения. Возможно, синхронизация не завершена.');
            return;
        }
        
        setMainPlayerCurrentTrack(track);
        setMainPlayerCurrentIndex(index);
        setMainPlayerIsPlaying(true);
        setMainPlayerCurrentTime(0);
    };

    const mainPlayerNextTrack = () => {
        if (mainPlayerPlaylistTracks.length === 0) return;
        let nextIndex = mainPlayerCurrentIndex + 1;
        if (nextIndex >= mainPlayerPlaylistTracks.length) nextIndex = 0;
        playTrackInMainPlayer(mainPlayerPlaylistTracks[nextIndex], nextIndex);
    };

    const mainPlayerPrevTrack = () => {
        if (mainPlayerPlaylistTracks.length === 0) return;
        let prevIndex = mainPlayerCurrentIndex - 1;
        if (prevIndex < 0) prevIndex = mainPlayerPlaylistTracks.length - 1;
        playTrackInMainPlayer(mainPlayerPlaylistTracks[prevIndex], prevIndex);
    };

    // Room player functions
    const nextTrack = async () => {
        if (!currentRoom) return;
        try {
            await MusicAPI.nextTrack(currentRoom.id, currentUserId);
        } catch (error) {
            console.error('Error next track:', error);
        }
    };

    const prevTrack = async () => {
        if (!currentRoom) return;
        try {
            await MusicAPI.prevTrack(currentRoom.id, currentUserId);
        } catch (error) {
            console.error('Error prev track:', error);
        }
    };

    const cancelProposal = (votingId) => {
        if (!currentRoom) return;
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "cancel_proposal"
            }));
            
            addSystemMessage(`⏸️ Вы отменили своё предложение`);
        } else {
            alert('Соединение потеряно, не удалось отменить предложение');
        }
    };

    const pauseTrack = async () => {
        if (!currentRoom) return;
        try {
            await MusicAPI.pauseTrack(currentRoom.id, currentUserId);
            setIsPlaying(false);
        } catch (error) {
            console.error('Error pausing track:', error);
        }
    };

    const handleSeek = async (e) => {
        const newTime = parseFloat(e.target.value);
        setCurrentTime(newTime);
        if (audioRef.current) audioRef.current.currentTime = newTime;
        
        if (currentRoom) {
            try {
                await MusicAPI.seekTrack(currentRoom.id, newTime, currentUserId);
            } catch (error) {
                console.error('Error seeking:', error);
            }
        }
    };

    const controlSyncPlayer = async (action, value = null) => {
        if (!currentRoom || currentRoom.playback_mode !== 'sync') return;
        
        try {
            await MusicAPI.controlPlayer(
                currentRoom.id, 
                action, 
                currentUserId, 
                currentUsername, 
                value
            );
            
            // Локально применяем действие немедленно
            if (action === 'play') {
                setIsPlaying(true);
                if (audioRef.current) audioRef.current.play();
            } else if (action === 'pause') {
                setIsPlaying(false);
                if (audioRef.current) audioRef.current.pause();
            } else if (action === 'seek' && value !== null) {
                setCurrentTime(value);
                if (audioRef.current) audioRef.current.currentTime = value;
            }
        } catch (error) {
            console.error('Sync control error:', error);
        }
    };

    const submitTrackToHost = (track) => {
        if (!currentRoom || currentRoom.playback_mode !== 'host') {
            addSystemMessage('❌ Режим хоста не активен');
            return;
        }
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const trackData = {
                id: track.id || track.vk_id || Date.now().toString(),
                vk_id: track.vk_id,
                artist: track.artist,
                title: track.title,
                duration: track.duration,
                url: track.url,
                cover_url: track.cover_url,
                cover_small: track.cover_small,
                cover_big: track.cover_big
            };
            
            wsRef.current.send(JSON.stringify({
                type: 'submit_track_to_host',
                track: trackData
            }));
            
            addSystemMessage(`📤 Трек "${track.title}" отправлен хосту`);
        } else {
            alert('Соединение потеряно');
        }
    };

    const updatePlaybackMode = async (roomId, mode, userId, hostId = null) => {
    try {
        const result = await MusicAPI.updatePlaybackMode(roomId, mode, userId, hostId);
        if (result.success) {
            setRoomPlaybackMode(mode);
            setIsHost(mode === 'host' && userId === result.host_id);
            addSystemMessage(`🔧 Режим изменён на ${mode === 'sync' ? 'синхронный (все слышат)' : 'режим хоста (только вы слышите)'}`);
        }
    } catch (error) {
        console.error('Error updating playback mode:', error);
        addSystemMessage('❌ Ошибка смены режима');
    }
};

    const hostPlayFromQueue = (queueIndex) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'host_play_track_from_queue',
                queue_index: queueIndex
            }));
        }
    };

    const hostClearQueue = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'host_clear_queue'
            }));
        }
    };

    useEffect(() => {
        const audio = mainAudioRef.current;
        if (!audio || !mainPlayerCurrentTrack?.url) return;
        
        console.log('🎵 Setting main audio src:', mainPlayerCurrentTrack.url);
        const wasPlaying = mainPlayerIsPlaying;
        
        audio.pause();
        audio.src = mainPlayerCurrentTrack.url;
        audio.load();
        
        if (wasPlaying) {
            audio.play().catch(e => console.error('Play error:', e));
        }
    }, [mainPlayerCurrentTrack?.url]);
    
    useEffect(() => {
    window.currentUserId = currentUserId;
    window.roomPlaybackMode = roomPlaybackMode;
    window.roomHostId = currentRoom?.host_id;
    
    return () => {
        delete window.currentUserId;
        delete window.roomPlaybackMode;
        delete window.roomHostId;
    };
}, [currentUserId, roomPlaybackMode, currentRoom?.host_id]);

    useEffect(() => {
        const audio = mainAudioRef.current;
        if (!audio || !mainPlayerCurrentTrack) return;
        
        if (mainPlayerIsPlaying) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.error('Play error:', e));
            }
        } else {
            audio.pause();
        }
    }, [mainPlayerIsPlaying, mainPlayerCurrentTrack]);
    
    useEffect(() => {
        const audio = mainAudioRef.current;
        if (!audio) return;
        audio.volume = mainPlayerVolume;
    }, [mainPlayerVolume]);
    
    useEffect(() => {
        const audio = mainAudioRef.current;
        if (!audio) return;
        
        const handleTimeUpdate = () => {
            setMainPlayerCurrentTime(audio.currentTime);
        };
        
        const handleLoadedMetadata = () => {
            console.log('Metadata loaded, duration:', audio.duration);
            setMainPlayerDuration(audio.duration);
        };
        
        const handleEnded = () => {
            console.log('Track ended, playing next');
            mainPlayerNextTrack();
        };
        
        const handleError = (e) => {
            console.error('Audio error:', e);
            console.error('Error code:', audio.error?.code);
            console.error('Error message:', audio.error?.message);
        };
        
        const handlePlay = () => console.log('Audio playing');
        const handlePause = () => console.log('Audio paused');
        
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [mainAudioRef.current]);
    
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentTrack?.url) return;
        
        console.log('🎵 Setting room audio src:', currentTrack.url);
        const wasPlaying = isPlaying;
        
        audio.pause();
        audio.src = currentTrack.url;
        audio.load();
        
        if (wasPlaying) {
            audio.play().catch(e => console.error('Play error:', e));
        }
    }, [currentTrack?.url]);
    
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentTrack) return;
        
        if (isPlaying) {
            audio.play().catch(e => console.error('Play error:', e));
        } else {
            audio.pause();
        }
    }, [isPlaying, currentTrack]);
    
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = volume;
    }, [volume]);
    
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };
        
        const handleLoadedMetadata = () => {
            console.log('Room audio loaded, duration:', audio.duration);
            setDuration(audio.duration);
            setIsLoading(false);
        };
        
        const handleEnded = () => {
            console.log('Room track ended');
            nextTrack();
        };
        
        const handleError = (e) => {
            console.error('Room audio error:', e);
        };
        
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, [audioRef.current]);

    const proposeTrack = async (track) => {
        if (!currentRoom) return;

        const trackData = {
            id: track.id || track.vk_id || Date.now().toString(),
            vk_id: track.vk_id,
            artist: track.artist,
            title: track.title,
            duration: track.duration,
            url: track.url,
            cover_url: track.cover_url,
            cover_small: track.cover_small,
            cover_big: track.cover_big,
            proposed_by: currentUsername,
            proposed_by_id: currentUserId
        };

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const messageType = roomScenario === 'withoutVoting' ? 'add_track_directly' : 'propose_track';
            
            wsRef.current.send(JSON.stringify({
                type: messageType,
                track: trackData
            }));
            
            if (roomScenario === 'withoutVoting') {
                addSystemMessage(`Трек "${track.title}" добавлен в плейлист комнаты`);
            }
        } else {
            alert('Соединение потеряно');
        }
    };

    const proposeTrackAsNext = useCallback((track) => {
        if (!currentRoom) return;
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'propose_track_next',
                track: track,
                current_track: currentTrack,
                proposed_by: currentUsername,
                proposed_by_id: currentUserId
            }));
            
            addSystemMessage(`Предложение: поставить трек "${track.title}" следующим после текущего. Голосуйте!`);
        } else {
            alert('Соединение потеряно');
        }
    }, [currentRoom, currentTrack, currentUsername, currentUserId]);

    const voteForTrack = (votingId, vote) => {
    console.log('🔵 voteForTrack called:', { votingId, vote });
    
    if (!currentRoom) {
        console.log('🔵 No currentRoom');
        return;
    }
    
    const voting = activeVotings.find(v => v.id === votingId);
    console.log('🔵 Found voting:', voting);
    
    if (!voting) {
        console.log('🔵 Voting not found');
        return;
    }
    
    if (voting.user_vote) {
        console.log('🔵 Already voted:', voting.user_vote);
        addSystemMessage(`Вы уже голосовали ${voting.user_vote === 'yes' ? 'ЗА' : 'ПРОТИВ'} это предложение`);
        return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const messageType = voting.type === 'add' ? 'vote' : 'vote_next';
        
        const message = {
            type: messageType,
            session_id: votingId,
            vote: vote
        };
        
        console.log('🔵 Sending WebSocket message:', message);
        wsRef.current.send(JSON.stringify(message));
        
        // НЕ обновляем state — ждём WebSocket
        addSystemMessage(`Вы проголосовали ${vote === 'yes' ? 'ЗА' : 'ПРОТИВ'} предложение`);
    } else {
        console.log('🔵 WebSocket not open');
        alert('Соединение потеряно, не удалось отправить голос');
    }
};

    const removeTrackFromRoom = async (trackId) => {
        if (!currentRoom) return;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'remove_track',
                track_id: trackId
            }));
        }
    };

    const createRoom = async () => {
        if (!roomName.trim()) {
            alert('Введите название комнаты');
            return;
        }

        const userId = isGuestMode ? `guest_${Date.now()}` : currentUserId;
        const userName = isGuestMode ? guestName : currentUsername;

        const newRoom = {
            id: Date.now().toString(),
            name: roomName,
            createdAt: new Date().toISOString(),
            creator: userName,
            creator_id: userId,
            participants: [{ 
                id: userId, 
                name: userName, 
                isCreator: true,
                joined_at: new Date().toISOString()
            }],
            tracks: [],
            scenario: roomScenario,
            votingDuration: roomScenario === 'withVoting' ? votingDuration : 60,
            currentTrack: null,
            currentTrackIndex: -1,
            isPlaying: false,
            currentTime: 0,
            roomIsShuffled: false,
            roomRepeatMode: 'off'
        };

        try {
            await MusicAPI.createRoom(newRoom);
            const updatedRooms = [...rooms, newRoom];
            setRooms(updatedRooms);
            localStorage.setItem('musicRooms', JSON.stringify(updatedRooms));
            setRoomName('');
            setRoomScenario('withVoting');
            setVotingDuration(60);
            setShowCreateRoomModal(false);
            await joinRoom(newRoom);
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Ошибка создания комнаты');
        }
    };

    const joinRoom = async (room) => {
        try {
            setShowMainPlayer(false);
            
            const userId = isGuestMode ? `guest_${Date.now()}_${Math.random()}` : currentUserId;
            const userName = isGuestMode ? guestName : currentUsername;
            
            const isAlreadyParticipant = room.participants.some(p => p.id === userId);
            
            if (!isAlreadyParticipant) {
                await MusicAPI.joinRoom(room.id, userId, userName);
            }
            
            connectWebSocket(room.id, userId, userName, currentRoom, (ws) => { wsRef.current = ws; });
            
            if (isGuestMode) {
                setCurrentUserId(userId);
                setCurrentUsername(userName);
            }
            
            try {
                const chatHistory = await MusicAPI.getMessages(room.id);
                setChatMessages(chatHistory.messages || []);
            } catch (error) {
                console.error('Error loading chat:', error);
            }
            
            setCurrentRoom(room);
            setParticipants(room.participants);
            setRoomTracks(room.tracks || []);
            setRoomScenario(room.scenario || 'withVoting');
            setRoomCurrentTrackIndex(room.currentTrackIndex || -1);
            setShowMakeRoom(false);
            setShowChat(true);
            setVkSearchTerm('');
            setRoomSearchTerm('');
            setShowPlaylistSelector(true);
            setSelectedMusicPlaylist(null);
            setActiveVotings([]);
            clearAllVotingTimers();
            
            saveAppStateCallback();
        } catch (error) {
            console.error('Error joining room:', error);
            alert('Ошибка подключения к комнате');
        }
    };

    const leaveRoom = async () => {
        if (currentRoom) {
            try {
                await MusicAPI.leaveRoom(currentRoom.id, currentUserId);
                disconnectWebSocket();
            } catch (error) {
                console.error('Error leaving room:', error);
            }
        }
        
        clearAllVotingTimers();
        setShowMainPlayer(true);
        setCurrentRoom(null);
        setParticipants([]);
        setRoomTracks([]);
        setActiveVotings([]);
        setChatMessages([]);
        setShowChat(false);
        setCurrentTrack(null);
        setIsPlaying(false);
        setRoomCurrentTrackIndex(-1);
        setVkSearchTerm('');
        setRoomSearchTerm('');
        setShowPlaylistSelector(true);
        setSelectedMusicPlaylist(null);
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        
        saveAppStateCallback();
    };

    const deleteRoom = async () => {
        if (!roomToDelete) return;
        
        if (roomToDelete.creator !== currentUsername && roomToDelete.creator_id !== currentUserId) {
            alert('Только создатель комнаты может удалить её');
            return;
        }

        try {
            await MusicAPI.deleteRoom(roomToDelete.id);
            const updatedRooms = rooms.filter(r => r.id !== roomToDelete.id);
            setRooms(updatedRooms);
            localStorage.setItem('musicRooms', JSON.stringify(updatedRooms));
            
            if (currentRoom && currentRoom.id === roomToDelete.id) await leaveRoom();
            
            setShowDeleteConfirmModal(false);
            setRoomToDelete(null);
            alert(`Комната "${roomToDelete.name}" удалена`);
        } catch (error) {
            console.error('Error deleting room:', error);
            alert('Ошибка удаления комнаты');
        }
    };

    const playTrackFromRoom = async (track, index) => {
        if (!currentRoom) return;
        
        const trackData = {
            id: track.id || track.vk_id,
            title: track.title,
            artist: track.artist,
            url: track.url,
            duration: track.duration,
            cover_small: track.cover_small,
            cover_big: track.cover_big
        };
        
        try {
            await MusicAPI.playTrack(currentRoom.id, trackData, index, currentUserId);
        } catch (error) {
            console.error('Error playing track:', error);
        }
    };

    const sendChatMessage = async () => {
        if (!newMessage.trim() || !currentRoom) return;
        const messageText = newMessage.trim();
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat',
                message: messageText
            }));
            setNewMessage('');
        } else {
            alert('Соединение потеряно, попробуйте позже');
        }
    };

    const startParsing = async () => {
        try {
            setIsParsing(true);
            const result = await MusicAPI.parseMusic(accessToken, currentUserId);
            if (result.success) {
                checkParseStatus();
            } else {
                alert('Ошибка парсинга: ' + (result.error || 'Неизвестная ошибка'));
                setIsParsing(false);
            }
        } catch (error) {
            console.error('Error starting parse:', error);
            alert('Ошибка запуска парсинга');
            setIsParsing(false);
        }
    };

    const checkParseStatus = async () => {
        try {
            const status = await MusicAPI.getParseStatus();
            setIsParsing(status.is_parsing);
            setParseProgress(status.progress);
            setParseStatus(status.status);
            
            if (status.is_parsing) {
                setTimeout(checkParseStatus, 2000);
            } else if (status.status === 'completed') {
                await fetchMusicData();
                await loadMusicStats();
                alert('Синхронизация музыки завершена!');
                setShowMusicParser(false);
            }
        } catch (error) {
            console.error('Error checking parse status:', error);
        }
    };

    const switchPlaylist = (playlist) => {
        setCurrentPlaylist(playlist);
        setTracks(playlist.tracks || []);
        setFilteredVkTracks(playlist.tracks || []);
        setMainPlayerPlaylistTracks(playlist.tracks || []);
        setSearchTerm('');
        setVkSearchTerm('');
        setMainPlayerCurrentTrack(null);
        setMainPlayerCurrentIndex(-1);
        setMainPlayerIsPlaying(false);
        saveAppStateCallback();
    };

    const joinAsGuestHandler = () => {
        joinAsGuest(guestName, setAuthError, setIsGuestMode, setIsAuthenticated, setCurrentUsername, setCurrentUserId);
    };

    const handleInviteOnLoad = useCallback(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteId = urlParams.get('invite');
        if (inviteId && !currentRoom) {
            setPendingRoomId(inviteId);
            if (!isAuthenticated) {
                setAuthError('Для входа в комнату авторизуйтесь или войдите как гость');
            } else {
                const invitedRoom = rooms.find(r => r.id === inviteId);
                if (invitedRoom) {
                    joinRoom(invitedRoom);
                } else {
                    loadRooms().then(() => {
                        const room = rooms.find(r => r.id === inviteId);
                        if (room) joinRoom(room);
                    });
                }
            }
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [isAuthenticated, currentRoom, rooms]);

    const handleLoginWrapper = () => {
        handleLogin(tokenInput, pendingRoomId, rooms, joinRoom, setPendingRoomId);
    };

    useEffect(() => {
        if (roomTracks.length > 0 && roomIsShuffled) {
            const indices = Array.from({ length: roomTracks.length }, (_, i) => i);
            setRoomShuffledIndices(shuffleArray(indices));
        } else if (roomTracks.length > 0) {
            setRoomShuffledIndices(Array.from({ length: roomTracks.length }, (_, i) => i));
        }
    }, [roomIsShuffled, roomTracks]);

    useEffect(() => {
        if (selectedMusicPlaylist && selectedMusicPlaylist.tracks) {
            const filtered = selectedMusicPlaylist.tracks.filter(track =>
                track.title?.toLowerCase().includes(vkSearchTerm.toLowerCase()) ||
                track.artist?.toLowerCase().includes(vkSearchTerm.toLowerCase())
            );
            setFilteredVkTracks(filtered);
        } else if (currentPlaylist && currentPlaylist.tracks && !selectedMusicPlaylist) {
            const filtered = currentPlaylist.tracks.filter(track =>
                track.title?.toLowerCase().includes(vkSearchTerm.toLowerCase()) ||
                track.artist?.toLowerCase().includes(vkSearchTerm.toLowerCase())
            );
            setFilteredVkTracks(filtered);
        }
    }, [vkSearchTerm, selectedMusicPlaylist, currentPlaylist]);

    useEffect(() => {
        if (isAuthenticated && currentUserId && !isGuestMode) {
            fetchMusicData();
            loadRooms();
            loadMusicStats();
            saveAppStateCallback();
        } else if (isAuthenticated && isGuestMode) {
            loadRooms();
        }
    }, [isAuthenticated, currentUserId, isGuestMode]);

    useEffect(() => {
        const initializeApp = async () => {
            await loadAppState();
            setIsInitializing(false);
        };
        initializeApp();
    }, []);

    useEffect(() => {
        if (isAuthenticated && rooms.length > 0) handleInviteOnLoad();
    }, [isAuthenticated, rooms, handleInviteOnLoad]);

    useEffect(() => {
        return () => {
            clearAllVotingTimers();
        };
    }, []);

    if (isInitializing) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Загрузка приложения...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <AuthScreen
                guestName={guestName}
                setGuestName={setGuestName}
                joinAsGuest={joinAsGuestHandler}
                tokenInput={tokenInput}
                setTokenInput={setTokenInput}
                authError={authError}
                setAuthError={setAuthError}
                isVerifying={isVerifying}
                handleLogin={handleLoginWrapper}
            />
        );
    }

    return (
        <div className="vk-music-app">
            {!currentRoom && (
                <div className="top-buttons">
                    <button className="logout-btn" onClick={handleLogout} title="Выйти">Выйти</button>
                    {!isGuestMode && (
                        <button className="sync-music-btn" onClick={() => setShowMusicParser(true)} title="Синхронизация музыки">
                            Синхронизация
                        </button>
                    )}
                    {isGuestMode && <div className="guest-badge">Гость: {currentUsername}</div>}
                </div>
            )}
            
            {showMusicParser && (
                <MusicParserModal
                    setShowMusicParser={setShowMusicParser}
                    musicStats={musicStats}
                    isParsing={isParsing}
                    parseProgress={parseProgress}
                    parseStatus={parseStatus}
                    startParsing={startParsing}
                />
            )}

            {showCreateRoomModal && (
                <CreateRoomModal
                    setShowCreateRoomModal={setShowCreateRoomModal}
                    roomName={roomName}
                    setRoomName={setRoomName}
                    roomScenario={roomScenario}
                    setRoomScenario={setRoomScenario}
                    votingDuration={votingDuration}
                    setVotingDuration={setVotingDuration}
                    createRoom={createRoom}
                />
            )}

            {showInviteModal && (
                <InviteModal
                    setShowInviteModal={setShowInviteModal}
                    inviteLink={inviteLink}
                />
            )}

            {showDeleteConfirmModal && roomToDelete && (
                <DeleteConfirmModal
                    setShowDeleteConfirmModal={setShowDeleteConfirmModal}
                    roomToDelete={roomToDelete}
                    deleteRoom={deleteRoom}
                />
            )}

            {showMainPlayer && !currentRoom && !isGuestMode && (
                <MainPlayer
                    playlists={playlists}
                    currentPlaylist={currentPlaylist}
                    switchPlaylist={switchPlaylist}
                    showPlaylistSidebar={showPlaylistSidebar}
                    setShowPlaylistSidebar={setShowPlaylistSidebar}
                    tracks={tracks}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    mainPlayerCurrentTrack={mainPlayerCurrentTrack}
                    playTrackInMainPlayer={playTrackInMainPlayer}
                    mainPlayerIsPlaying={mainPlayerIsPlaying}
                    setMainPlayerIsPlaying={setMainPlayerIsPlaying}
                    mainPlayerPrevTrack={mainPlayerPrevTrack}
                    mainPlayerNextTrack={mainPlayerNextTrack}
                    mainPlayerCurrentTime={mainPlayerCurrentTime}
                    mainPlayerDuration={mainPlayerDuration}
                    setMainPlayerCurrentTime={setMainPlayerCurrentTime}
                    setMainPlayerDuration={setMainPlayerDuration} 
                    mainPlayerVolume={mainPlayerVolume}
                    setMainPlayerVolume={setMainPlayerVolume}
                    mainAudioRef={mainAudioRef}
                    formatTimeFn={formatTime}
                />
            )}

            {!showMakeRoom && !currentRoom && (
                <button className="show-sidebar-btn2" onClick={() => setShowMakeRoom(true)}>
                    Комнаты
                </button>
            )}

            {showMakeRoom && !currentRoom && (
                <div className="rooms-panel">
                    <div className="rooms-header">
                        <h3>Музыкальные комнаты</h3>
                        <button onClick={() => setShowCreateRoomModal(true)} className="create-room-btn">+ Создать</button>
                        <button onClick={() => setShowMakeRoom(false)} className="close-rooms-btn">✕</button>
                    </div>
                    <div className="rooms-list">
                        {rooms.length === 0 ? (
                            <div className="empty-rooms">Нет созданных комнат</div>
                        ) : (
                            rooms.map(room => (
                                <div key={room.id} className="room-card">
                                    <div className="room-info">
                                        <h4>{room.name}</h4>
                                        <p>Создатель: {room.creator}</p>
                                        <p>👥 {room.participants.length} участников</p>
                                        <p className="room-scenario-badge">
                                            {room.scenario === 'withVoting' && 'С голосованием'}
                                            {room.scenario === 'withoutVoting' && 'Без голосования'}
                                        </p>
                                    </div>
                                    <div className="room-buttons">
                                        <button onClick={() => joinRoom(room)} className="join-room-btn">Войти</button>
                                        {(room.creator === currentUsername || room.creator_id === currentUserId) && (
                                            <button onClick={() => {
                                                setRoomToDelete(room);
                                                setShowDeleteConfirmModal(true);
                                            }} className="delete-room-btn" title="Удалить">🗑️</button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {currentRoom && (
                <RoomInterface
                    currentRoom={currentRoom}
                    onCancelProposal={cancelProposal}
                    participants={participants}
                    currentUserId={currentUserId}
                    currentUsername={currentUsername}
                    isGuestMode={isGuestMode}
                    createInviteLink={createInviteLink}
                    setRoomToDelete={setRoomToDelete}
                    setShowDeleteConfirmModal={setShowDeleteConfirmModal}
                    leaveRoom={leaveRoom}
                    showChat={showChat}
                    setShowChat={setShowChat}
                    chatMessages={chatMessages}
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    sendChatMessage={sendChatMessage}
                    isGuestModeFlag={isGuestMode}
                    playlists={playlists}
                    showPlaylistSelector={showPlaylistSelector}
                    setShowPlaylistSelector={setShowPlaylistSelector}
                    selectedMusicPlaylist={selectedMusicPlaylist}
                    setSelectedMusicPlaylist={setSelectedMusicPlaylist}
                    vkSearchTerm={vkSearchTerm}
                    setVkSearchTerm={setVkSearchTerm}
                    filteredVkTracks={filteredVkTracks}
                    proposeTrack={proposeTrack}
                    backToPlaylistSelector={backToPlaylistSelector}
                    setShowMusicParser={setShowMusicParser}
                    roomTracks={roomTracks}
                    roomSearchTerm={roomSearchTerm}
                    setRoomSearchTerm={setRoomSearchTerm}
                    playTrackFromRoom={playTrackFromRoom}
                    proposeTrackAsNext={proposeTrackAsNext}
                    removeTrackFromRoom={removeTrackFromRoom}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    roomIsShuffled={roomIsShuffled}
                    setRoomIsShuffled={setRoomIsShuffled}
                    roomRepeatMode={roomRepeatMode}
                    setRoomRepeatMode={setRoomRepeatMode}
                    roomCurrentTrackIndex={roomCurrentTrackIndex}
                    roomShuffledIndices={roomShuffledIndices}
                    activeVotings={activeVotings}
                    voteForTrack={voteForTrack}
                    audioRef={audioRef}
                    currentTime={currentTime}
                    duration={duration}
                    handleSeek={handleSeek}
                    volume={volume}
                    setVolume={setVolume}
                    prevTrack={prevTrack}
                    nextTrack={nextTrack}
                    pauseTrack={pauseTrack}
                    setIsPlaying={setIsPlaying}
                    isLoading={isLoading}
                    TrackCoverComponent={TrackCover}
                    VotingCardComponent={VotingCard}
                    // 🆕 НОВЫЕ ПРОПСЫ ДЛЯ РЕЖИМОВ ВОСПРОИЗВЕДЕНИЯ
                    roomPlaybackMode={roomPlaybackMode}
                    isHost={isHost}
                    onSubmitTrackToHost={submitTrackToHost}
                    onUpdatePlaybackMode={updatePlaybackMode}
                    onControlSyncPlayer={controlSyncPlayer}
                    onHostPlayFromQueue={hostPlayFromQueue}
                    onHostClearQueue={hostClearQueue}
                    wsRef={wsRef}
                />
            )}
        </div>
    );
};

export default Main;