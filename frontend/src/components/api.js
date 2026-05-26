
const getServerIP = () => {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'localhost';
    }
    
    return hostname;
};

const SERVER_IP = getServerIP();
const API_BASE_URL = `http://${SERVER_IP}:8000/api`;
const WS_BASE_URL = `ws://${SERVER_IP}:8000/ws`;

class MusicAPI {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.wsBaseURL = WS_BASE_URL;
        this.wsConnections = new Map();
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            signal: controller.signal,
            ...options
        };

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Request failed' }));
                throw new Error(error.detail || 'API request failed');
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    async updatePlaybackMode(roomId, playbackMode, userId, hostId = null) {
    return this.request(`/rooms/${roomId}/playback-mode`, {
        method: 'POST',
        body: JSON.stringify({ 
            playback_mode: playbackMode, 
            host_id: hostId,
            user_id: userId 
            })
        });
    }

    async controlPlayer(roomId, action, userId, userName, value = null) {
        return this.request(`/rooms/${roomId}/player/control`, {
            method: 'POST',
            body: JSON.stringify({ 
                action, 
                value, 
                user_id: userId,
                user_name: userName 
            })
        });
    }

    async verifyToken(token) {
        return this.request('/verify-token', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    }

    async getMusicData(userId) {
        return this.request(`/music-data?user_id=${userId}`);
    }

    async getMusicStats(userId) {
        return this.request(`/music-stats?user_id=${userId}`);
    }

    async parseMusic(token, userId) {
        return this.request('/parse-music', {
            method: 'POST',
            body: JSON.stringify({ token, user_id: userId })
        });
    }

    async getParseStatus() {
        return this.request('/parse-status');
    }

    async getRooms() {
        try {
            return await this.request('/rooms');
        } catch (error) {
            const savedRooms = localStorage.getItem('musicRooms');
            return savedRooms ? JSON.parse(savedRooms) : [];
        }
    }

    async createRoom(room) {
        return this.request('/rooms', {
            method: 'POST',
            body: JSON.stringify(room)
        });
    }

    async deleteRoom(roomId) {
        return this.request(`/rooms/${roomId}`, {
            method: 'DELETE'
        });
    }

    async joinRoom(roomId, userId, userName) {
        return this.request(`/rooms/${roomId}/join`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, user_name: userName })
        });
    }

    async leaveRoom(roomId, userId) {
        return this.request(`/rooms/${roomId}/leave`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });
    }

    async playTrack(roomId, track, index, userId) {
        return this.request(`/rooms/${roomId}/player/play`, {
            method: 'POST',
            body: JSON.stringify({ track, index, userId })
        });
    }

    async pauseTrack(roomId, userId) {
        return this.request(`/rooms/${roomId}/player/pause`, {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
    }

    async seekTrack(roomId, currentTime, userId) {
        return this.request(`/rooms/${roomId}/player/seek`, {
            method: 'POST',
            body: JSON.stringify({ currentTime, userId })
        });
    }

    async nextTrack(roomId, userId) {
        return this.request(`/rooms/${roomId}/player/next`, {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
    }

    async prevTrack(roomId, userId) {
        return this.request(`/rooms/${roomId}/player/prev`, {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
    }

    async getMessages(roomId, limit = 50) {
        try {
            return await this.request(`/chat/${roomId}?limit=${limit}`);
        } catch (error) {
            return { messages: [] };
        }
    }

}

export default new MusicAPI();