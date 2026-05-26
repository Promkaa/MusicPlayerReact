// frontend/src/components/Modals.jsx
// ПОЛНОСТЬЮ ЗАМЕНИТЬ файл

import React from 'react';

export const CreateRoomModal = ({ 
    setShowCreateRoomModal, 
    roomName, 
    setRoomName, 
    roomScenario, 
    setRoomScenario,
    votingDuration = 60,      // 🆕 со значением по умолчанию
    setVotingDuration,        // 🆕
    createRoom 
}) => {
    return (
        <div className="modal-overlay" onClick={() => setShowCreateRoomModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Создать комнату</h3>
                <input
                    type="text"
                    placeholder="Название комнаты"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="room-name-input"
                />
                <div className="scenario-selection">
                    <label className="scenario-label">Сценарий:</label>
                    <div className="scenario-options">
                        <label className={`scenario-option ${roomScenario === 'withVoting' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                value="withVoting"
                                checked={roomScenario === 'withVoting'}
                                onChange={(e) => setRoomScenario(e.target.value)}
                            />
                            <div className="scenario-content">
                                <span className="scenario-icon">🗳️</span>
                                <div>
                                    <strong>С голосованием</strong>
                                    <p>Треки добавляются после голосования</p>
                                </div>
                            </div>
                        </label>
                        <label className={`scenario-option ${roomScenario === 'withoutVoting' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                value="withoutVoting"
                                checked={roomScenario === 'withoutVoting'}
                                onChange={(e) => setRoomScenario(e.target.value)}
                            />
                            <div className="scenario-content">
                                <span className="scenario-icon">🎵</span>
                                <div>
                                    <strong>Без голосования</strong>
                                    <p>Треки добавляются сразу</p>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
                
                {/* 🆕 Блок настройки времени голосования (только для withVoting) */}
                {roomScenario === "withVoting" && (
                    <div className="voting-duration-group">
                        <label className="duration-label">⏱️ Время голосования:</label>
                        <div className="duration-slider-container">
                            <input
                                type="range"
                                min="10"
                                max="300"
                                step="5"
                                value={votingDuration}
                                onChange={(e) => setVotingDuration && setVotingDuration(parseInt(e.target.value))}
                                className="duration-slider"
                            />
                            <div className="duration-value">
                                <input
                                    type="number"
                                    min="10"
                                    max="300"
                                    value={votingDuration}
                                    onChange={(e) => setVotingDuration && setVotingDuration(parseInt(e.target.value))}
                                    className="duration-number"
                                />
                                <span>секунд</span>
                            </div>
                        </div>
                        <div className="duration-hint">
                            💡 Минимальное: 10 сек, максимальное: 300 сек (5 минут)
                        </div>
                    </div>
                )}
                
                <div className="modal-buttons">
                    <button onClick={createRoom} className="create-room-btn">Создать</button>
                    <button onClick={() => setShowCreateRoomModal(false)} className="cancel-btn">Отмена</button>
                </div>
            </div>
        </div>
    );
};

export const InviteModal = ({ setShowInviteModal, inviteLink }) => {
    return (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
            <div className="modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
                <h3>🔗 Ссылка-приглашение</h3>
                <p>Пригласите друзей по этой ссылке:</p>
                <div className="invite-link-container">
                    <input type="text" value={inviteLink} readOnly className="invite-link-input" />
                    <button onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert('Ссылка скопирована!');
                    }} className="copy-link-btn">📋 Копировать</button>
                </div>
                <div className="invite-info">
                    <p>💡 Если у друга нет VK токена, он сможет войти как гость</p>
                </div>
                <div className="modal-buttons">
                    <button onClick={() => setShowInviteModal(false)} className="close-btn">Закрыть</button>
                </div>
            </div>
        </div>
    );
};

export const DeleteConfirmModal = ({ setShowDeleteConfirmModal, roomToDelete, deleteRoom }) => {
    return (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirmModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Удалить комнату?</h3>
                <p>Удалить комнату <strong>"{roomToDelete?.name}"</strong>?</p>
                <p>Это действие нельзя отменить.</p>
                <div className="modal-buttons">
                    <button onClick={deleteRoom} className="delete-confirm-btn">Удалить</button>
                    <button onClick={() => setShowDeleteConfirmModal(false)} className="cancel-btn">Отмена</button>
                </div>
            </div>
        </div>
    );
};
