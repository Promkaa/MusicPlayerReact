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
    roomScenario
) => {
    const wsRef = useRef(null);

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
                
            case 'player_play':
                setCurrentTrack(data.track);
                setIsPlaying(true);
                setCurrentTime(0);
                if (data.index !== undefined) {
                    setRoomCurrentTrackIndex(data.index);
                }
                break;
                
            case 'player_pause':
                setIsPlaying(false);
                setCurrentTime(data.currentTime);
                break;
                
            case 'player_seek':
                setCurrentTime(data.currentTime);
                break;
                
            case 'player_next':
                setCurrentTrack(data.track);
                setCurrentTime(0);
                setIsPlaying(true);
                if (data.index !== undefined) {
                    setRoomCurrentTrackIndex(data.index);
                }
                break;
                
            case 'player_prev':
                setCurrentTrack(data.track);
                setCurrentTime(0);
                setIsPlaying(true);
                if (data.index !== undefined) {
                    setRoomCurrentTrackIndex(data.index);
                }
                break;
                
            case 'track_added_directly':
                setRoomTracks(prev => [...prev, data.track]);
                addSystemMessage(`🎵 ${data.added_by} добавил трек "${data.track.title}"`);
                break;
                
            case 'voting_started':
                if (roomScenario === 'withVoting') {
                    console.log('Voting started (add track):', data);
                    
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
                
            case 'vote_next_started':
                if (roomScenario === 'withVoting') {
                    console.log('Vote next started:', data);
                    
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
                console.log('Vote confirmed:', data);
                setActiveVotings(prev => prev.map(voting => {
                    if (voting.id === data.session_id) {
                        return {
                            ...voting,
                            votes_yes: data.votes_yes,
                            votes_no: data.votes_no,
                            total_voted: data.total_voted,
                            total_participants: data.total_participants
                        };
                    }
                    return voting;
                }));
                break;

            case 'voting_update':
                console.log('Voting update:', data);
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
                console.log('Vote next update:', data);
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

            case 'voting_ended':
                console.log('Voting ended:', data);
                
                if (window.votingTimers && window.votingTimers[data.session_id]) {
                    clearInterval(window.votingTimers[data.session_id]);
                    delete window.votingTimers[data.session_id];
                }
                clearVotingTimer(data.session_id);
                
                if (data.accepted) {
                    if (data.track) {
                        setRoomTracks(prev => {
                            const exists = prev.some(t => t.id === data.track.id || t.vk_id === data.track.vk_id);
                            if (exists) return prev;
                            return [...prev, data.track];
                        });
                        addSystemMessage(`Трек "${data.track.title}" добавлен в плейлист комнаты (${data.votes_yes} за, ${data.votes_no} против)`);
                    }
                } else {
                    addSystemMessage(`Трек "${data.track?.title || 'трек'}" отклонен голосованием (${data.votes_yes} за, ${data.votes_no} против)`);
                }
                
                setActiveVotings(prev => prev.filter(v => v.id !== data.session_id));
                break;
                
            case 'vote_next_ended':
                console.log('Vote next ended:', data);
                
                if (window.votingTimers && window.votingTimers[data.session_id]) {
                    clearInterval(window.votingTimers[data.session_id]);
                    delete window.votingTimers[data.session_id];
                }
                clearVotingTimer(data.session_id);
                
                if (data.accepted) {
                    setRoomTracks(prev => {
                        const currentTrackIndex = prev.findIndex(t => 
                            t.id === data.current_track?.id || t.vk_id === data.current_track?.vk_id
                        );
                        const trackIndex = prev.findIndex(t => 
                            t.id === data.track.id || t.vk_id === data.track.vk_id
                        );
                        
                        if (trackIndex === -1 || currentTrackIndex === -1) return prev;
                        
                        const newTracks = [...prev];
                        const [movedTrack] = newTracks.splice(trackIndex, 1);
                        const newPosition = currentTrackIndex + 1;
                        newTracks.splice(newPosition, 0, movedTrack);
                        
                        addSystemMessage(`Трек "${data.track.title}" поставлен следующим после "${data.current_track?.title}" (${data.votes_yes} за, ${data.votes_no} против)`);
                        return newTracks;
                    });
                } else {
                    addSystemMessage(`Предложение поставить трек "${data.track?.title}" следующим отклонено (${data.votes_yes} за, ${data.votes_no} против)`);
                }
                
                setActiveVotings(prev => prev.filter(v => v.id !== data.session_id));
                break;
                
            case 'chat_message':
                setChatMessages(prev => {
                    const exists = prev.some(msg => 
                        msg.id === data.message?.id || 
                        (msg.user_id === data.message?.user_id && 
                         msg.message === data.message?.message &&
                         msg.timestamp === data.message?.timestamp)
                    );
                    return exists ? prev : [...prev, data.message];
                });
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }, [roomScenario, setCurrentRoom, setParticipants, setRoomTracks, setRoomScenario, 
        setRoomCurrentTrackIndex, setCurrentTrack, setIsPlaying, setCurrentTime, 
        addSystemMessage, setActiveVotings, startVotingTimerLocal, clearVotingTimer, setChatMessages]);

    const connectWebSocket = useCallback((roomId, userId, userName, currentRoomState, setWsRef) => {
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
        
        setWsRef(ws);
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
    }, []);

    return {
        wsRef,
        connectWebSocket,
        disconnectWebSocket,
        handleWebSocketMessage
    };
};