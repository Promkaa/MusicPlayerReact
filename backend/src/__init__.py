__version__ = "1.0.0"

# Экспортируем основные компоненты для удобного импорта
from models import Track, Participant, Room, ChatMessage, VotingSession, VoteNextSession
from datastore import datastore
from managers import manager, normalize_track_data

__all__ = [
    'Track',
    'Participant', 
    'Room',
    'ChatMessage',
    'VotingSession',
    'VoteNextSession',
    'datastore',
    'manager',
    'normalize_track_data',
    '__version__'
]
