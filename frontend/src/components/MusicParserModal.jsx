import React from 'react';

const MusicParserModal = ({ setShowMusicParser, musicStats, isParsing, parseProgress, parseStatus, startParsing }) => {
    const getStatusText = (status) => {
        const statusMap = {
            'idle': 'Готов к работе',
            'parsing_tracks': 'Получение треков...',
            'saving_tracks': 'Сохранение треков...',
            'parsing_playlists': 'Получение плейлистов...',
            'exporting': 'Экспорт данных...',
            'completed': 'Завершено!',
            'error': 'Ошибка'
        };
        return statusMap[status] || status;
    };

    return (
        <div className="music-parser-modal">
            <div className="parser-content">
                <div className="parser-header">
                    <h3>🎵 Синхронизация музыки VK</h3>
                    <button className="close-parser-btn" onClick={() => setShowMusicParser(false)}>✕</button>
                </div>
                {musicStats && (
                    <div className="parser-stats">
                        <h4>📊 Статистика</h4>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-value">{musicStats.total_tracks || 0}</div>
                                <div className="stat-label">Всего треков</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{musicStats.total_playlists || 0}</div>
                                <div className="stat-label">Плейлистов</div>
                            </div>
                        </div>
                    </div>
                )}
                {isParsing ? (
                    <div className="parsing-progress">
                        <h4>🔄 Парсинг музыки...</h4>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${parseProgress}%` }}>
                                {Math.round(parseProgress)}%
                            </div>
                        </div>
                        <div className="progress-text">{getStatusText(parseStatus)}</div>
                    </div>
                ) : (
                    <div className="parser-actions">
                        <button onClick={startParsing} className="start-parsing-btn">
                            🚀 Начать синхронизацию
                        </button>
                        <p className="parser-info">
                            Синхронизация загрузит все ваши треки и плейлисты из VK.<br/>
                            Это может занять несколько минут.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MusicParserModal;