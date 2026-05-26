// frontend/src/hooks/useWebSocket.js

import { useCallback, useRef } from 'react';

export const useWebSocket = (
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
    // 🆕 НОВЫЕ ПАРАМЕТРЫ
    setRoomPlaybackMode = null,
    setIsHost = null,
    setHostQueue = null
) => {
    const wsRef = useRef(null);
    
    // Сохраняем текущего пользователя
    const currentUserRef = useRef({ id: null, name: null });

    const startVotingTimerLocal = useCallback((votingId, initialTime) => {
        const timer = setInterval(() => {
            setActiveVotings(prev => {
                const voting = prev.find(v => v.id === votingId);
                if (!voting) {
                    clearInterval(timer);
                    return prev;
                }
                
                const newTime = (voting.time_remaining || 0) - 1;
                
                if (newTime <= 0) {
                    clearInterval(timer);
                    return prev.filter(v => v.id !== votingId);
                }
                
                return prev.map(v => 
                    v.id === votingId ? { ...v, time_remaining: newTime } : v
                );
            });
        }, 1000);
        
        return timer;
    }, [setActiveVotings]);

    const handleWebSocketMessage = useCallback((data) => {
        console.log('WebSocket message:', data.type);
        
        switch (data.type) {
            case 'room_state':
    if (data.room) {
        setCurrentRoom(data.room);
        setParticipants(data.room.participants || []);
        setRoomTracks(data.room.tracks || []);
        setRoomScenario(data.room.scenario || 'withVoting');
        setRoomCurrentTrackIndex(data.room.currentTrackIndex || -1);
        if (data.room.currentTrack) {
            setCurrentTrack(data.room.currentTrack);
            setIsPlaying(data.room.isPlaying);
            setCurrentTime(data.room.currentTime || 0);
        }
        // 🆕 Устанавливаем глобальные переменные для фильтрации
        window.roomPlaybackMode = data.room.playback_mode || 'sync';
        window.roomHostId = data.room.host_id;
        window.currentUserId = currentUserRef.current.id;
    }
    break;
                
            case 'user_joined':
                setParticipants(prev => [...prev, data.user]);
                addSystemMessage(`${data.user.name} присоединился к комнате`);
                break;
                
            case 'user_left':
                setParticipants(prev => prev.filter(p => p.id !== data.user_id));
                addSystemMessage(`Пользователь покинул комнату`);
                break;
                
            case 'user_connected':
                break;
                
            case 'user_disconnected':
                setParticipants(prev => prev.filter(p => p.id !== data.user_id));
                addSystemMessage(`${data.user_name} отключился`);
                break;
                
            case 'room_closed':
                addSystemMessage(`Комната закрыта: ${data.message}`);
                break;
                
            case 'player_play':
    // 🆕 В режиме host — игнорируем, если текущий пользователь не хост
    if (window.roomPlaybackMode === 'host' && window.currentUserId !== window.roomHostId) {
        console.log('Host mode: ignoring play for non-host');
        break;
    }
    setCurrentTrack(data.track);
    setIsPlaying(true);
    setCurrentTime(0);
    if (data.index !== undefined) {
        setRoomCurrentTrackIndex(data.index);
    }
    break;

case 'player_pause':
    if (window.roomPlaybackMode === 'host' && window.currentUserId !== window.roomHostId) {
        console.log('Host mode: ignoring pause for non-host');
        break;
    }
    setIsPlaying(false);
    setCurrentTime(data.currentTime);
    break;

case 'player_seek':
    if (window.roomPlaybackMode === 'host' && window.currentUserId !== window.roomHostId) {
        console.log('Host mode: ignoring seek for non-host');
        break;
    }
    setCurrentTime(data.currentTime);
    break;

case 'player_next':
    if (window.roomPlaybackMode === 'host' && window.currentUserId !== window.roomHostId) {
        console.log('Host mode: ignoring next for non-host');
        break;
    }
    setCurrentTrack(data.track);
    setCurrentTime(0);
    setIsPlaying(true);
    if (data.index !== undefined) {
        setRoomCurrentTrackIndex(data.index);
    }
    break;

case 'player_prev':
    if (window.roomPlaybackMode === 'host' && window.currentUserId !== window.roomHostId) {
        console.log('Host mode: ignoring prev for non-host');
        break;
    }
    setCurrentTrack(data.track);
    setCurrentTime(0);
    setIsPlaying(true);
    if (data.index !== undefined) {
        setRoomCurrentTrackIndex(data.index);
    }
    break;
                
            case 'track_added_directly':
                setRoomTracks(prev => {
                    const exists = prev.some(track => 
                        track.id === data.track.id || 
                        track.vk_id === data.track.vk_id ||
                        (track.title === data.track.title && track.artist === data.track.artist)
                    );
                    
                    if (exists) {
                        console.warn('⚠️ Track already exists, skipping duplicate:', data.track.title);
                        return prev;
                    }
                    
                    return [...prev, data.track];
                });
                addSystemMessage(`🎵 ${data.added_by} добавил трек "${data.track.title}"`);
                break;
                
            case 'voting_started':
                if (roomScenario === 'withVoting') {
                    const newVoting = {
                        id: data.session_id,
                        type: 'add',
                        track: data.track,
                        proposed_by: data.proposed_by,
                        proposed_by_id: data.proposed_by_id,
                        votes_yes: data.votes_yes || 0,
                        votes_no: data.votes_no || 0,
                        total_voted: data.total_voted || 0,
                        total_participants: data.total_participants,
                        time_remaining: data.time_remaining || 60,
                        user_vote: null
                    };
                    
                    setActiveVotings(prev => {
                        const exists = prev.some(v => v.id === newVoting.id);
                        if (exists) return prev;
                        return [...prev, newVoting];
                    });
                    
                    const timer = startVotingTimerLocal(newVoting.id, newVoting.time_remaining);
                    if (window.votingTimers) {
                        window.votingTimers[newVoting.id] = timer;
                    } else {
                        window.votingTimers = { [newVoting.id]: timer };
                    }
                }
                break;

            case 'track_removed':
                setRoomTracks(prev => {
                    const newTracks = prev.filter(track => {
                        const shouldRemove = track.id === data.track_id || track.vk_id === data.track_id;
                        return !shouldRemove;
                    });
                    
                    if (currentTrack && (data.track_id === currentTrack.id || data.track_id === currentTrack.vk_id)) {
                        setCurrentTrack(null);
                        setIsPlaying(false);
                        setCurrentTime(0);
                    }
                    
                    return newTracks;
                });
                addSystemMessage(`🗑️ Трек "${data.track_title}" удалён из плейлиста`);
                break;

            case 'vote_next_started':
                if (roomScenario === 'withVoting') {
                    const newVoting = {
                        id: data.session_id,
                        type: 'next',
                        track: data.track,
                        current_track: data.current_track,
                        proposed_by: data.proposed_by,
                        proposed_by_id: data.proposed_by_id,
                        votes_yes: data.votes_yes || 0,
                        votes_no: data.votes_no || 0,
                        total_voted: data.total_voted || 0,
                        total_participants: data.total_participants,
                        time_remaining: data.time_remaining || 30,
                        user_vote: null
                    };
                    
                    setActiveVotings(prev => {
                        const exists = prev.some(v => v.id === newVoting.id);
                        if (exists) return prev;
                        return [...prev, newVoting];
                    });
                    
                    const timer = startVotingTimerLocal(newVoting.id, newVoting.time_remaining);
                    if (window.votingTimers) {
                        window.votingTimers[newVoting.id] = timer;
                    } else {
                        window.votingTimers = { [newVoting.id]: timer };
                    }
                }
                break;

           case 'vote_confirmed':
    console.log('🔵 vote_confirmed received:', data);  // ← ЛОГ ДЛЯ ДЕБАГА
    setActiveVotings(prev => {
        const newVotings = prev.map(voting => {
            if (voting.id === data.session_id) {
                // Если это голосование текущего пользователя — помечаем как проголосовавшее
                const isCurrentUser = data.user_id === currentUserRef.current.id;
                return {
                    ...voting,
                    votes_yes: data.votes_yes,
                    votes_no: data.votes_no,
                    total_voted: data.total_voted,
                    total_participants: data.total_participants,
                    // Жёстко определяем user_vote по user_id
                    user_vote: isCurrentUser ? (data.user_vote || 'yes') : voting.user_vote
                };
            }
            return voting;
        });
        console.log('🔵 Updated activeVotings:', newVotings);
        return newVotings;
    });
    break;

            case 'voting_update':
                setActiveVotings(prev => prev.map(voting => {
                    if (voting.id === data.session_id) {
                        return {
                            ...voting,
                            votes_yes: data.votes_yes,
                            votes_no: data.votes_no,
                            total_voted: data.total_voted,
                            total_participants: data.total_participants,
                            time_remaining: data.time_remaining
                        };
                    }
                    return voting;
                }));
                break;
                
            case 'vote_next_update':
    setActiveVotings(prev => prev.map(voting => {
        if (voting.id === data.session_id) {
            return {
                ...voting,
                votes_yes: data.votes_yes,
                votes_no: data.votes_no,
                total_voted: data.total_voted,
                total_participants: data.total_participants,
                time_remaining: data.time_remaining,
                // ✅ Для next пока нет user_vote, но защита не помешает
                user_vote: data.user_vote !== undefined ? data.user_vote : voting.user_vote
            };
        }
        return voting;
    }));
    break;

            case 'voting_cancelled':
                if (window.votingTimers && window.votingTimers[data.session_id]) {
                    clearInterval(window.votingTimers[data.session_id]);
                    delete window.votingTimers[data.session_id];
                }
                clearVotingTimer(data.session_id);
                setActiveVotings(prev => prev.filter(v => v.id !== data.session_id));
                addSystemMessage(`❌ ${data.cancelled_by} отменил(а) предложение трека "${data.track.title}"`);
                break;

            case 'voting_ended':
                if (window.votingTimers && window.votingTimers[data.session_id]) {
                    clearInterval(window.votingTimers[data.session_id]);
                    delete window.votingTimers[data.session_id];
                }
                clearVotingTimer(data.session_id);
                
                if (data.accepted) {
                    if (data.track) {
                        setRoomTracks(prev => {
                            const exists = prev.some(t => 
                                t.id === data.track.id || 
                                t.vk_id === data.track.vk_id
                            );
                            if (exists) return prev;
                            return [...prev, data.track];
                        });
                        addSystemMessage(`✅ Трек "${data.track.title}" добавлен в плейлист комнаты (${data.votes_yes} за, ${data.votes_no} против)`);
                    }
                } else {
                    addSystemMessage(`❌ Трек "${data.track?.title || 'трек'}" отклонен голосованием`);
                }
                
                setActiveVotings(prev => prev.filter(v => v.id !== data.session_id));
                break;
                
            case 'vote_next_ended':
                if (window.votingTimers && window.votingTimers[data.session_id]) {
                    clearInterval(window.votingTimers[data.session_id]);
                    delete window.votingTimers[data.session_id];
                }
                clearVotingTimer(data.session_id);
                
                if (data.accepted) {
                    addSystemMessage(`⏩ Трек "${data.track.title}" поставлен следующим после текущего (${data.votes_yes} за, ${data.votes_no} против)`);
                } else {
                    addSystemMessage(`❌ Предложение поставить трек "${data.track?.title}" следующим отклонено`);
                }
                
                setActiveVotings(prev => prev.filter(v => v.id !== data.session_id));
                break;
                
            case 'chat_message':
                setChatMessages(prev => {
                    const exists = prev.some(msg => 
                        msg.id === data.message?.id || 
                        (msg.user_id === data.message?.user_id && 
                         msg.message === data.message?.message)
                    );
                    return exists ? prev : [...prev, data.message];
                });
                break;
                
            // 🆕 НОВЫЕ ОБРАБОТЧИКИ ДЛЯ РЕЖИМОВ
            case 'playback_mode_changed':
                addSystemMessage(`Режим воспроизведения изменён: ${data.playback_mode === 'sync' ? '🔄 Синхронный плеер' : '🎧 Режим хоста'}`);
                if (setRoomPlaybackMode) setRoomPlaybackMode(data.playback_mode);
                if (setIsHost && currentUserRef.current.id) {
                    setIsHost(currentUserRef.current.id === data.host_id);
                }
                if (data.host_name) {
                    addSystemMessage(`👑 Хост: ${data.host_name}`);
                }
                break;
                
            case 'sync_command':
                if (data.user_id !== currentUserRef.current.id) {
                    if (data.action === 'play') {
                        if (setIsPlaying) setIsPlaying(true);
                        if (audioRef?.current) audioRef.current.play().catch(e => console.error(e));
                    } else if (data.action === 'pause') {
                        if (setIsPlaying) setIsPlaying(false);
                        if (audioRef?.current) audioRef.current.pause();
                    } else if (data.action === 'seek') {
                        if (setCurrentTime) setCurrentTime(data.value);
                        if (audioRef?.current) audioRef.current.currentTime = data.value;
                    }
                    addSystemMessage(`👤 ${data.user_name} ${data.action === 'play' ? 'включил' : data.action === 'pause' ? 'поставил на паузу' : 'перемотал'} трек`);
                }
                break;
                
            case 'host_queue_updated':
                if (setHostQueue) setHostQueue(data.queue);
                addSystemMessage(`📥 Очередь хоста: ${data.queue_length} треков`);
                if (data.new_track && currentUserRef.current.id === data.new_track.submitted_by_id) {
                    addSystemMessage(`✅ Ваш трек "${data.new_track.title}" добавлен в очередь хоста`);
                } else if (data.new_track) {
                    addSystemMessage(`➕ Новый трек от ${data.new_track.submitted_by}: "${data.new_track.title}"`);
                }
                break;
                
            case 'track_submitted_to_host':
                addSystemMessage(`📤 Трек "${data.track.title}" отправлен хосту (позиция ${data.queue_position})`);
                break;
                
            case 'host_sync_command':
                if (data.action === 'play_track') {
                    setCurrentTrack(data.track);
                    setIsPlaying(true);
                    setCurrentTime(0);
                    addSystemMessage(`🎵 ${data.played_by || 'Хост'} воспроизводит трек из очереди: "${data.track.title}"`);
                    if (data.queue_remaining !== undefined) {
                        addSystemMessage(`📋 Осталось в очереди: ${data.queue_remaining} треков`);
                    }
                }
                break;
                
            case 'host_queue_cleared':
                if (setHostQueue) setHostQueue([]);
                addSystemMessage(`🗑️ ${data.cleared_by} очистил очередь треков`);
                break;
                
            case 'proposal_cancelled':
                if (data.success) {
                    addSystemMessage(`✅ ${data.message || 'Ваше предложение отменено'}`);
                }
                break;
                
            case 'voting_duration_changed':
                addSystemMessage(`⏱️ Время голосования изменено на ${data.duration_seconds} секунд`);
                break;
                
            case 'pong':
                break;
                
            case 'error':
                console.error('WebSocket error:', data.message);
                addSystemMessage(`⚠️ Ошибка: ${data.message}`);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }, [roomScenario, setCurrentRoom, setParticipants, setRoomTracks, setRoomScenario, 
        setRoomCurrentTrackIndex, setCurrentTrack, setIsPlaying, setCurrentTime, 
        addSystemMessage, setActiveVotings, startVotingTimerLocal, clearVotingTimer, 
        setChatMessages, currentTrack, setRoomPlaybackMode, setIsHost, setHostQueue, audioRef]);

    const connectWebSocket = useCallback((roomId, userId, userName, currentRoomState, setWsRef) => {
        // Сохраняем информацию о текущем пользователе
        currentUserRef.current = { id: userId, name: userName };
        
        const wsUrl = `ws://${window.location.hostname}:8000/ws/${roomId}/${userId}?user_name=${encodeURIComponent(userName)}`;
        console.log('Connecting WebSocket:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            const interval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
            ws.pingInterval = interval;
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            if (ws.pingInterval) clearInterval(ws.pingInterval);
            setTimeout(() => {
                if (currentRoomState) {
                    connectWebSocket(currentRoomState.id, userId, userName, currentRoomState, setWsRef);
                }
            }, 3000);
        };
        
        if (setWsRef) {
            setWsRef(ws);
        }
        wsRef.current = ws;
        return ws;
    }, [handleWebSocketMessage]);

    const disconnectWebSocket = useCallback(() => {
        if (wsRef.current) {
            if (wsRef.current.pingInterval) clearInterval(wsRef.current.pingInterval);
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
        }
        wsRef.current = null;
        currentUserRef.current = { id: null, name: null };
    }, []);

    return {
        wsRef,
        connectWebSocket,
        disconnectWebSocket,
        handleWebSocketMessage
    };
};
