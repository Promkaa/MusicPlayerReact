import { useEffect, useRef } from 'react';

export const useMainAudioPlayer = (currentTrack, isPlaying, volume, setCurrentTime, setDuration, onEnded) => {
    const audioRef = useRef(null);
    const hlsRef = useRef(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (currentTrack?.url) {
            console.log('Setting audio src:', currentTrack.url);
            
            audio.pause();
            
            audio.src = currentTrack.url;
            audio.load();
            
            if (isPlaying) {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error('Playback error:', error);
                    });
                }
            }
        } else if (currentTrack) {
            console.warn('Track has no URL:', currentTrack);
        }
    }, [currentTrack]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentTrack) return;

        if (isPlaying) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Play error:', error);
                });
            }
        } else {
            audio.pause();
        }
    }, [isPlaying, currentTrack]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleLoadedMetadata = () => {
            console.log('Audio loaded, duration:', audio.duration);
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            console.log('Audio ended');
            if (onEnded) onEnded();
        };

        const handlePlay = () => {
            console.log('Audio playing');
        };

        const handlePause = () => {
            console.log('Audio paused');
        };

        const handleError = (e) => {
            console.error('Audio error:', e);
            console.error('Audio error code:', audio.error?.code);
            console.error('Audio error message:', audio.error?.message);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('error', handleError);
        };
    }, [audioRef, setCurrentTime, setDuration, onEnded]);

    return { audioRef, hlsRef };
};

export const useAudioPlayer = (currentTrack, isPlaying, volume, setIsLoading, setCurrentTime, setDuration, onEnded) => {
    const audioRef = useRef(null);
    const hlsRef = useRef(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (currentTrack?.url) {
            console.log('Room audio src:', currentTrack.url);
            audio.pause();
            audio.src = currentTrack.url;
            audio.load();
            
            if (isPlaying) {
                audio.play().catch(e => console.error('Play error:', e));
            }
        }
    }, [currentTrack]);

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
        if (audio) {
            audio.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            if (setIsLoading) setIsLoading(false);
        };
        const handleEnded = () => onEnded?.();
        const handleError = (e) => console.error('Audio error:', e);

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
    }, [audioRef, setCurrentTime, setDuration, onEnded, setIsLoading]);

    return { audioRef, hlsRef };
};