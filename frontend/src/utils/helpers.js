
export const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getCoverUrl = (track, size = 'small') => {
    const coverUrl = size === 'small' ? track?.cover_small : track?.cover_big || track?.cover_url;
    return coverUrl || null;
};

export const extractTokenFromUrl = (input) => {
    if (input.startsWith('http')) {
        try {
            const url = new URL(input);
            const hash = url.hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get('access_token');
            if (token) return token;
        } catch (e) {}
        
        const match = input.match(/access_token=([^&\s]+)/);
        if (match) return match[1];
    }
    return input;
};
