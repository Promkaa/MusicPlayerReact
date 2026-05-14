from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from datastore import datastore
from managers import manager, normalize_track_data

router = APIRouter(prefix="/api", tags=["player"])


@router.post("/rooms/{room_id}/player/play")
async def play_track(room_id: str, play_data: Dict[str, Any]):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    track_data = play_data.get("track")
    index = play_data.get("index", -1)
    user_id = play_data.get("userId")
    
    if track_data:
        track = normalize_track_data(track_data)
        room.currentTrack = track
        room.currentTrackIndex = index
        room.isPlaying = True
        room.currentTime = 0
        
        datastore.rooms[room_id] = room
        datastore.save_rooms_to_file()
        
        await manager.broadcast_to_room(room_id, {
            "type": "player_play",
            "track": track.dict(),
            "index": index,
            "currentTime": 0,
            "userId": user_id
        })
    
    return {"message": "Playback started"}


@router.post("/rooms/{room_id}/player/pause")
async def pause_track(room_id: str, pause_data: Dict[str, str]):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    user_id = pause_data.get("userId")
    
    room.isPlaying = False
    datastore.rooms[room_id] = room
    datastore.save_rooms_to_file()
    
    await manager.broadcast_to_room(room_id, {
        "type": "player_pause",
        "userId": user_id,
        "currentTime": room.currentTime
    })
    
    return {"message": "Playback paused"}


@router.post("/rooms/{room_id}/player/seek")
async def seek_track(room_id: str, seek_data: Dict[str, Any]):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    current_time = seek_data.get("currentTime", 0)
    user_id = seek_data.get("userId")
    
    room.currentTime = current_time
    datastore.rooms[room_id] = room
    datastore.save_rooms_to_file()
    
    await manager.broadcast_to_room(room_id, {
        "type": "player_seek",
        "currentTime": current_time,
        "userId": user_id
    })
    
    return {"message": "Seeked"}


@router.post("/rooms/{room_id}/player/next")
async def next_track(room_id: str, next_data: Dict[str, str]):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    user_id = next_data.get("userId")
    
    next_index = room.currentTrackIndex + 1
    
    if next_index >= len(room.tracks):
        if room.roomRepeatMode == "all":
            next_index = 0
        else:
            room.isPlaying = False
            datastore.rooms[room_id] = room
            datastore.save_rooms_to_file()
            await manager.broadcast_to_room(room_id, {
                "type": "player_stopped",
                "reason": "end_of_playlist"
            })
            return {"message": "End of playlist"}
    
    if next_index < len(room.tracks):
        room.currentTrack = room.tracks[next_index]
        room.currentTrackIndex = next_index
        room.currentTime = 0
        room.isPlaying = True
        
        datastore.rooms[room_id] = room
        datastore.save_rooms_to_file()
        
        await manager.broadcast_to_room(room_id, {
            "type": "player_next",
            "track": room.currentTrack.dict(),
            "index": next_index,
            "userId": user_id
        })
    
    return {"message": "Next track"}


@router.post("/rooms/{room_id}/player/prev")
async def prev_track(room_id: str, prev_data: Dict[str, str]):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    user_id = prev_data.get("userId")
    
    prev_index = room.currentTrackIndex - 1
    
    if prev_index < 0:
        if room.roomRepeatMode == "all":
            prev_index = len(room.tracks) - 1
        else:
            return {"message": "Beginning of playlist"}
    
    if prev_index >= 0 and prev_index < len(room.tracks):
        room.currentTrack = room.tracks[prev_index]
        room.currentTrackIndex = prev_index
        room.currentTime = 0
        room.isPlaying = True
        
        datastore.rooms[room_id] = room
        datastore.save_rooms_to_file()
        
        await manager.broadcast_to_room(room_id, {
            "type": "player_prev",
            "track": room.currentTrack.dict(),
            "index": prev_index,
            "userId": user_id
        })
    
    return {"message": "Previous track"}