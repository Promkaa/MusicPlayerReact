from typing import Dict, Set, Any
from datetime import datetime
from fastapi import WebSocket

from models import Track


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_rooms: Dict[str, str] = {}
    
    async def connect(self, room_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = set()
        self.active_connections[room_id].add(websocket)
        self.user_rooms[user_id] = room_id
        
    def disconnect(self, room_id: str, user_id: str, websocket: WebSocket):
        if room_id in self.active_connections:
            self.active_connections[room_id].discard(websocket)
        if user_id in self.user_rooms:
            del self.user_rooms[user_id]
    
    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass


def normalize_track_data(track_data: Dict[str, Any]) -> Track:
    track_id = track_data.get('id') or track_data.get('vk_id')
    if track_id is not None:
        track_id = str(track_id)
    else:
        track_id = str(int(datetime.now().timestamp() * 1000))
    
    vk_id = track_data.get('vk_id')
    if vk_id is not None:
        vk_id = str(vk_id)
    
    duration = track_data.get('duration', 0)
    if duration is not None:
        try:
            duration = int(duration)
        except:
            duration = 0
    
    return Track(
        id=track_id,
        vk_id=vk_id,
        artist=str(track_data.get('artist', 'Unknown Artist')),
        title=str(track_data.get('title', 'Unknown Title')),
        duration=duration,
        url=str(track_data.get('url')) if track_data.get('url') else None,
        cover_url=str(track_data.get('cover_url')) if track_data.get('cover_url') else None,
        cover_small=str(track_data.get('cover_small')) if track_data.get('cover_small') else None,
        cover_big=str(track_data.get('cover_big')) if track_data.get('cover_big') else None,
        added_by=str(track_data.get('added_by')) if track_data.get('added_by') else None,
        added_by_id=str(track_data.get('added_by_id')) if track_data.get('added_by_id') else None,
        added_at=str(track_data.get('added_at', datetime.now().isoformat()))
    )


# Глобальный экземпляр
manager = ConnectionManager()