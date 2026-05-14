import React from 'react';

const AuthScreen = ({ 
    guestName, setGuestName, joinAsGuest, 
    tokenInput, setTokenInput, authError, setAuthError, isVerifying, handleLogin 
}) => {
    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-icon">🎵</div>
                    <h1>VK Music Player</h1>
                    <p>Войдите с помощью VK токена или как гость</p>
                </div>
                
                <div className="guest-section">
                    <h3>👤 Вход как гость</h3>
                    <div className="guest-form">
                        <input
                            type="text"
                            className="guest-input"
                            placeholder="Введите ваше имя"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && joinAsGuest()}
                        />
                        <button className="guest-btn" onClick={joinAsGuest}>
                            🎧 Войти как гость
                        </button>
                    </div>
                </div>

                <div className="auth-divider">
                    <span>или</span>
                </div>
                
                <div className="auth-instructions">
                    <h3>📖 Как получить токен VK:</h3>
                    <ol className="instruction-steps">
                        <li>
                            <span className="step-number">1</span>
                            <div className="step-content">
                                <strong>Перейдите на сайт</strong>
                                <a href="https://vkhost.github.io/" target="_blank" rel="noopener noreferrer" className="vkhost-link">
                                    vkhost.github.io
                                </a>
                            </div>
                        </li>
                        <li>
                            <span className="step-number">2</span>
                            <div className="step-content">
                                <strong>Выберите разрешения:</strong>
                                <ul className="permissions-list">
                                    <li>📁 <code>audio</code> - доступ к аудиозаписям</li>
                                    <li>📋 <code>wall</code> - доступ к стене</li>
                                    <li>👤 <code>friends</code> - доступ к друзьям</li>
                                </ul>
                            </div>
                        </li>
                        <li>
                            <span className="step-number">3</span>
                            <div className="step-content">
                                <strong>Нажмите "Получить токен"</strong>
                            </div>
                        </li>
                        <li>
                            <span className="step-number">4</span>
                            <div className="step-content">
                                <strong>Скопируйте ссылку полностью</strong>
                            </div>
                        </li>
                        <li>
                            <span className="step-number">5</span>
                            <div className="step-content">
                                <strong>Вставьте ссылку ниже и нажмите "Войти"</strong>
                            </div>
                        </li>
                    </ol>
                    
                    <div className="auth-note">
                        <span className="note-icon">⚠️</span>
                        <p>Токен хранится только в вашем браузере. Никогда не передавайте его другим!</p>
                    </div>
                </div>
                
                <div className="auth-form">
                    <input
                        type="text"
                        className="token-input"
                        placeholder="Вставьте токен или ссылку (из адресной строки после авторизации)"
                        value={tokenInput}
                        onChange={(e) => {
                            setTokenInput(e.target.value);
                            if (setAuthError) setAuthError('');
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    {authError && <div className="auth-error">❌ {authError}</div>}
                    <button 
                        className={`login-btn ${isVerifying ? 'loading' : ''}`}
                        onClick={handleLogin}
                        disabled={isVerifying}
                    >
                        {isVerifying ? '⏳ Проверка...' : '🎧 Войти через VK'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;