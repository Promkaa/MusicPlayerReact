from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
from datetime import datetime
import asyncio

from models import Room, Participant, Track
from datastore import datastore
from managers import manager, normalize_track_data
from voting_handlers import auto_complete_voting, voting_timer_countdown, check_and_complete_voting

router = APIRouter(prefix="/api", tags=["rooms"])


# -------------------- КОМНАТЫ --------------------
@router.get("/rooms")
async def get_rooms():
    return list(datastore.rooms.values())


@router.post("/rooms")
async def create_room(room: Room):
    if room.id in datastore.rooms:
        raise HTTPException(status_code=400, detail="Room already exists")
    
    datastore.rooms[room.id] = room
    datastore.save_rooms_to_file()
    return {"message": "Room created", "room": room}


@router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    return datastore.rooms[room_id]


@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    deleted_room = datastore.rooms.pop(room_id)
    datastore.save_rooms_to_file()
    return {"message": f"Room '{deleted_room.name}' deleted"}


# -------------------- УЧАСТНИКИ --------------------
@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, user_data: Dict[str, str]):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    user_id = user_data.get("user_id")
    user_name = user_data.get("user_name")
    
    if not user_id or not user_name:
        raise HTTPException(status_code=400, detail="User ID and name required")
    
    for participant in room.participants:
        if participant.id == user_id:
            return {"message": "User already in room", "room": room}
    
    new_participant = Participant(
        id=user_id,
        name=user_name,
        isCreator=False,
        joined_at=datetime.now().isoformat()
    )
    room.participants.append(new_participant)
    
    datastore.rooms[room_id] = room
    datastore.save_rooms_to_file()
    
    await manager.broadcast_to_room(room_id, {
        "type": "user_joined",
        "user": new_participant.dict(),
        "participants_count": len(room.participants)
    })
    
    return {"message": f"User {user_name} joined room", "room": room}


@router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, user_data: Dict[str, str]):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    user_id = user_data.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
    leaving_user = None
    for p in room.participants:
        if p.id == user_id:
            leaving_user = p
            break
    
    room.participants = [p for p in room.participants if p.id != user_id]
    
    if len(room.participants) == 0:
        del datastore.rooms[room_id]
        datastore.save_rooms_to_file()
        
        await manager.broadcast_to_room(room_id, {
            "type": "room_closed",
            "message": "Room is empty and has been closed"
        })
        
        return {"message": "Room deleted", "room_deleted": True}
    
    datastore.rooms[room_id] = room
    datastore.save_rooms_to_file()
    
    await manager.broadcast_to_room(room_id, {
        "type": "user_left",
        "user_id": user_id,
        "user_name": leaving_user.name if leaving_user else user_id,
        "participants_count": len(room.participants)
    })
    
    return {"message": "User left room", "room": room}


# -------------------- ТРЕКИ В КОМНАТЕ --------------------
@router.post("/rooms/{room_id}/propose-track")
async def propose_track(room_id: str, request: Request):
    data = await request.json()
    track_data = data.get("track", {})
    user_id = data.get("user_id")
    user_name = data.get("user_name")
    
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    
    if room.scenario != "withVoting":
        track = normalize_track_data(track_data)
        track.added_by = user_name
        track.added_by_id = user_id
        track.added_at = datetime.now().isoformat()
        room.tracks.append(track)
        datastore.rooms[room_id] = room
        datastore.save_rooms_to_file()
        
        await manager.broadcast_to_room(room_id, {
            "type": "track_added_directly",
            "track": track.dict(),
            "added_by": user_name
        })
        
        return {"message": "Track added directly", "track": track}
    
    existing_session = datastore.get_voting_session(room_id)
    if existing_session:
        raise HTTPException(status_code=400, detail="There is already an active voting session in this room")
    
    track_id = str(track_data.get('id') or track_data.get('vk_id'))
    for existing in room.tracks:
        if existing.id == track_id or existing.vk_id == track_id:
            raise HTTPException(status_code=400, detail="Track already in room")
    
    new_track = normalize_track_data(track_data)
    
    voting_session = datastore.create_voting_session(room_id, new_track, user_id, user_name)
    
    auto_task = asyncio.create_task(auto_complete_voting(room_id, voting_session.id, "add"))
    datastore.set_voting_task(voting_session.id, auto_task)
    
    timer_task = asyncio.create_task(voting_timer_countdown(room_id, voting_session.id, "add"))
    datastore.set_voting_task(f"timer_{voting_session.id}", timer_task)
    
    await manager.broadcast_to_room(room_id, {
        "type": "voting_started",
        "session_id": voting_session.id,
        "track": new_track.dict(),
        "proposed_by": user_name,
        "proposed_by_id": user_id,
        "total_participants": len(room.participants),
        "total_voted": 0,
        "votes_yes": 0,
        "votes_no": 0,
        "time_remaining": 60
    })
    
    return {"message": "Voting session started", "session_id": voting_session.id, "track": new_track}


@router.post("/rooms/{room_id}/vote")
async def cast_vote(room_id: str, vote_data: Dict[str, Any]):
    session_id = vote_data.get("session_id")
    user_id = vote_data.get("user_id")
    vote_value = vote_data.get("vote")
    
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    if session_id not in datastore.voting_sessions:
        raise HTTPException(status_code=404, detail="Voting session not found")
    
    session = datastore.voting_sessions[session_id]
    
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Voting session is not active")
    
    if not user_id or not vote_value:
        raise HTTPException(status_code=400, detail="user_id and vote are required")
    
    if vote_value not in ["yes", "no"]:
        raise HTTPException(status_code=400, detail="Vote must be 'yes' or 'no'")
    
    result = datastore.cast_vote_on_session(session_id, user_id, vote_value)
    
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    
    room = datastore.rooms[room_id]
    
    await manager.broadcast_to_room(room_id, {
        "type": "vote_confirmed",
        "session_id": session_id,
        "votes_yes": result["votes_yes"],
        "votes_no": result["votes_no"],
        "total_voted": result["total_voted"],
        "total_participants": len(room.participants),
        "user_id": user_id,
        "user_vote": vote_value
    })
    
    await check_and_complete_voting(room_id, session_id, "add")
    
    return {"message": "Vote cast", "votes": result}


@router.delete("/rooms/{room_id}/tracks/{track_id}")
async def remove_track_from_room(room_id: str, track_id: str, user_id: str):
    if room_id not in datastore.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = datastore.rooms[room_id]
    
    track_to_remove = None
    for i, track in enumerate(room.tracks):
        if track.id == track_id or track.vk_id == track_id:
            track_to_remove = room.tracks.pop(i)
            break
    
    if not track_to_remove:
        raise HTTPException(status_code=404, detail="Track not found")
    
    is_creator = any(p.id == user_id and p.isCreator for p in room.participants)
    if track_to_remove.added_by_id != user_id and not is_creator:
        raise HTTPException(status_code=403, detail="No permission to remove this track")
    
    datastore.rooms[room_id] = room
    datastore.save_rooms_to_file()
    
    await manager.broadcast_to_room(room_id, {
        "type": "track_removed",
        "track_id": track_id,
        "track_title": track_to_remove.title,
        "removed_by": user_id,
        "tracks_count": len(room.tracks)
    })
    
    return {"message": f"Track '{track_to_remove.title}' removed from room"}