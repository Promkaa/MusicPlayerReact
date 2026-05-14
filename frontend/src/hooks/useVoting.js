import { useRef, useCallback } from 'react';

export const useVoting = () => {
    const votingTimersRef = useRef({});

    const clearVotingTimer = useCallback((votingId) => {
        if (votingTimersRef.current[votingId]) {
            clearInterval(votingTimersRef.current[votingId]);
            delete votingTimersRef.current[votingId];
        }
    }, []);

    const clearAllVotingTimers = useCallback(() => {
        Object.values(votingTimersRef.current).forEach(timer => clearInterval(timer));
        votingTimersRef.current = {};
    }, []);

    const startVotingTimer = useCallback((votingId, initialTime) => {
        
        const timer = setInterval(() => {
            const event = new CustomEvent('votingTimerTick', { 
                detail: { votingId, votingTimersRef: votingTimersRef.current }
            });
            window.dispatchEvent(event);
        }, 1000);
        
        votingTimersRef.current[votingId] = timer;
    }, []);

    const updateVotingTimer = useCallback((votingId, setActiveVotings) => {
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
    }, []);

    return {
        votingTimersRef,
        clearVotingTimer,
        clearAllVotingTimers,
        startVotingTimer,
        updateVotingTimer
    };
};