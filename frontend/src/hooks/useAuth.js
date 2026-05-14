import { useState, useCallback } from 'react';
import MusicAPI from '../api';
import { extractTokenFromUrl } from '../utils/helpers';
import { saveAuthState } from '../utils/storage';

export const useAuth = (
    setIsAuthenticated, setAccessToken, setCurrentUsername, setCurrentUserId,
    setIsGuestMode, setPlaylists, setCurrentPlaylist, setTracks, setFilteredVkTracks,
    setMainPlayerPlaylistTracks, setCurrentRoom, setRooms, setRoomTracks,
    setActiveVotings, setParticipants, setChatMessages, setSelectedMusicPlaylist,
    setShowPlaylistSelector, setShowMainPlayer, setMainPlayerCurrentTrack,
    setMainPlayerIsPlaying, audioRef, mainAudioRef, disconnectWebSocket,
    clearAllVotingTimers, currentRoom
) => {
    const [isVerifying, setIsVerifying] = useState(false);
    const [authError, setAuthError] = useState('');

    const handleLogout = useCallback(() => {
        localStorage.removeItem('vk_access_token');
        localStorage.removeItem('vk_music_app_state');
        localStorage.removeItem('vk_username');
        localStorage.removeItem('vk_user_id');
        localStorage.removeItem('savedPlaylists');
        localStorage.removeItem('musicRooms');
        
        disconnectWebSocket();
        clearAllVotingTimers();
        
        setIsAuthenticated(false);
        setIsGuestMode(false);
        setAccessToken('');
        setCurrentUsername('');
        setCurrentUserId('');
        setPlaylists([]);
        setCurrentPlaylist(null);
        setTracks([]);
        setFilteredVkTracks([]);
        setMainPlayerPlaylistTracks([]);
        setCurrentRoom(null);
        setRooms([]);
        setRoomTracks([]);
        setActiveVotings([]);
        setParticipants([]);
        setChatMessages([]);
        setSelectedMusicPlaylist(null);
        setShowPlaylistSelector(true);
        setShowMainPlayer(true);
        setMainPlayerCurrentTrack(null);
        setMainPlayerIsPlaying(false);
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        if (mainAudioRef.current) {
            mainAudioRef.current.pause();
            mainAudioRef.current.src = '';
        }
    }, [setIsAuthenticated, setIsGuestMode, setAccessToken, setCurrentUsername, setCurrentUserId,
        setPlaylists, setCurrentPlaylist, setTracks, setFilteredVkTracks, setMainPlayerPlaylistTracks,
        setCurrentRoom, setRooms, setRoomTracks, setActiveVotings, setParticipants, setChatMessages,
        setSelectedMusicPlaylist, setShowPlaylistSelector, setShowMainPlayer, setMainPlayerCurrentTrack,
        setMainPlayerIsPlaying, audioRef, mainAudioRef, disconnectWebSocket, clearAllVotingTimers]);

    const verifyToken = useCallback(async (token, showErrors = true) => {
        setIsVerifying(true);
        if (showErrors) setAuthError('');
        
        try {
            const response = await MusicAPI.verifyToken(token);
            
            if (!response.valid) {
                if (showErrors) setAuthError(response.error || 'Неверный токен');
                setIsVerifying(false);
                if (!showErrors) handleLogout();
                return false;
            }
            
            let username = '';
            let userId = '';
            
            if (response.user) {
                username = response.user.full_name;
                userId = response.user.id;
                setCurrentUsername(username);
                setCurrentUserId(userId);
                localStorage.setItem('vk_username', username);
                localStorage.setItem('vk_user_id', userId);
            }
            
            localStorage.setItem('vk_access_token', token);
            setAccessToken(token);
            setIsAuthenticated(true);
            setIsGuestMode(false);
            saveAuthState(token, username, userId, false);
            setIsVerifying(false);
            return true;
            
        } catch (error) {
            console.error('Error verifying token:', error);
            if (showErrors) setAuthError('Ошибка подключения к серверу');
            setIsVerifying(false);
            return false;
        }
    }, [setIsAuthenticated, setAccessToken, setCurrentUsername, setCurrentUserId, setIsGuestMode, handleLogout]);

    const handleLogin = useCallback(async (tokenInput, pendingRoomId, rooms, joinRoom, setPendingRoomId) => {
        if (!tokenInput.trim()) {
            setAuthError('Пожалуйста, введите токен или ссылку');
            return;
        }
        
        const extractedToken = extractTokenFromUrl(tokenInput.trim());
        if (!extractedToken) {
            setAuthError('Не удалось найти токен в ссылке. Проверьте правильность ввода.');
            return;
        }
        
        await verifyToken(extractedToken);
        
        if (pendingRoomId) {
            const invitedRoom = rooms.find(r => r.id === pendingRoomId);
            if (invitedRoom) {
                joinRoom(invitedRoom);
                setPendingRoomId(null);
            }
        }
    }, [verifyToken]);

    const joinAsGuest = useCallback((guestName, setAuthErrorCallback, setIsGuestModeCallback, 
                                      setIsAuthenticatedCallback, setCurrentUsernameCallback, 
                                      setCurrentUserIdCallback) => {
        if (!guestName.trim()) {
            setAuthErrorCallback('Введите ваше имя');
            return;
        }
        setIsGuestModeCallback(true);
        setIsAuthenticatedCallback(true);
        setCurrentUsernameCallback(guestName);
        setCurrentUserIdCallback(`guest_${Date.now()}`);
        setAuthErrorCallback('');
    }, []);

    return {
        isVerifying,
        authError,
        setAuthError,
        verifyToken,
        handleLogin,
        handleLogout,
        joinAsGuest
    };
};