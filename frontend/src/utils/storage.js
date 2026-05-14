export const saveAuthState = (token, username, userId, isGuestMode) => {
    const authState = {
        token: token,
        username: username,
        userId: userId,
        isGuest: isGuestMode,
        savedAt: Date.now()
    };
    localStorage.setItem('vk_auth_state', JSON.stringify(authState));
};

export const saveAppState = (accessToken, isAuthenticated, currentUsername, currentUserId, currentPlaylist, volume, isGuestMode) => {
    if (isGuestMode) return;
    const stateToSave = {
        accessToken: accessToken,
        isAuthenticated: isAuthenticated,
        currentUsername: currentUsername,
        currentUserId: currentUserId,
        currentPlaylistId: currentPlaylist?.id,
        volume: volume,
        savedAt: Date.now()
    };
    localStorage.setItem('vk_music_app_state', JSON.stringify(stateToSave));
};

export const loadAppState = async (verifyTokenFn, handleLogoutFn, setAccessToken, setCurrentUsername, setCurrentUserId, setIsAuthenticated, setIsGuestMode, setVolume, setMainPlayerVolume, setIsInitializing) => {
    const savedAuth = localStorage.getItem('vk_auth_state');
    const savedToken = localStorage.getItem('vk_access_token');
    
    if (savedAuth && savedToken) {
        try {
            const authState = JSON.parse(savedAuth);
            setAccessToken(authState.token);
            setCurrentUsername(authState.username);
            setCurrentUserId(authState.userId);
            setIsAuthenticated(true);
            setIsGuestMode(authState.isGuest);
            
            const isValid = await verifyTokenFn(savedToken, false);
            if (!isValid) {
                handleLogoutFn();
                return false;
            }
            
            const savedState = localStorage.getItem('vk_music_app_state');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    setVolume(state.volume || 0.7);
                    setMainPlayerVolume(state.volume || 0.7);
                } catch (error) {
                    console.error('Error loading state:', error);
                }
            }
            setIsInitializing(false);
            return true;
        } catch (error) {
            console.error('Error loading auth state:', error);
        }
    }
    setIsInitializing(false);
    return false;
};