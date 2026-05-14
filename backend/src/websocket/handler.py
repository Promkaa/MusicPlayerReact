from fastapi import WebSocket, APIRouter
from datetime import datetime
import asyncio

from datastore import datastore
from managers import manager, normalize_track_data
from models import ChatMessage
from voting_handlers import auto_complete_voting, voting_timer_countdown, check_and_complete_voting

router = APIRouter()


@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    user_name = None
    if "user_name" in websocket.query_params:
        user_name = websocket.query_params["user_name"]
    else:
        room = datastore.rooms.get(room_id)
        if room:
            for p in room.participants:
                if p.id == user_id:
                    user_name = p.name
                    break
    
    if not user_name:
        user_name = f"User_{user_id[:8]}"
    
    await manager.connect(room_id, user_id, websocket)
    
    room = datastore.rooms.get(room_id)
    if room:
        await websocket.send_json({
            "type": "room_state",
            "room": room.dict()
        })
    
    await manager.broadcast_to_room(room_id, {
        "type": "user_connected",
        "user_id": user_id,
        "user_name": user_name,
        "timestamp": datetime.now().isoformat()
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif message_type == "chat":
                message_text = data.get("message", "")
                if not message_text.strip():
                    continue
                
                chat_message = ChatMessage(
                    room_id=room_id,
                    user_id=user_id,
                    user_name=user_name,
                    message=message_text,
                    timestamp=datetime.now().isoformat()
                )
                
                if room_id not in datastore.chat_messages:
                    datastore.chat_messages[room_id] = []
                datastore.chat_messages[room_id].append(chat_message)
                
                if len(datastore.chat_messages[room_id]) > 100:
                    datastore.chat_messages[room_id] = datastore.chat_messages[room_id][-100:]
                
                await manager.broadcast_to_room(room_id, {
                    "type": "chat_message",
                    "message": chat_message.dict()
                })
            
            elif message_type == "propose_track":
                track_data = data.get("track", {})
                
                if room_id not in datastore.rooms:
                    continue
                
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
                    continue
                
                existing_session = datastore.get_voting_session(room_id)
                if existing_session:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Голосование уже идет"
                    })
                    continue
                
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
            
            elif message_type == "vote":
                session_id = data.get("session_id")
                vote_value = data.get("vote")
                
                if not session_id or not vote_value:
                    continue
                
                if session_id not in datastore.voting_sessions:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Сессия голосования не найдена"
                    })
                    continue
                
                session = datastore.voting_sessions[session_id]
                
                if session.status != "active":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Голосование завершено"
                    })
                    continue
                
                if user_id in session.voters:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Вы уже проголосовали"
                    })
                    continue
                
                result = datastore.cast_vote_on_session(session_id, user_id, vote_value)
                
                if result.get("error"):
                    await websocket.send_json({
                        "type": "error",
                        "message": result["error"]
                    })
                    continue
                
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
            
            elif message_type == "add_track_directly":
                track_data = data.get("track", {})
                
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                
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
            
            elif message_type == "remove_track":
                track_id = data.get("track_id")
                
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                
                track_to_remove = None
                for i, track in enumerate(room.tracks):
                    if track.id == track_id or track.vk_id == track_id:
                        track_to_remove = room.tracks.pop(i)
                        break
                
                if track_to_remove:
                    datastore.rooms[room_id] = room
                    datastore.save_rooms_to_file()
                    
                    await manager.broadcast_to_room(room_id, {
                        "type": "track_removed",
                        "track_id": track_id,
                        "track_title": track_to_remove.title,
                        "removed_by": user_id
                    })
            
            elif message_type == "propose_track_next":
                track_data = data.get("track", {})
                current_track_data = data.get("current_track", {})
                
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                
                existing_session = datastore.get_vote_next_session(room_id)
                if existing_session:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Голосование за следующий трек уже идет"
                    })
                    continue
                
                track = normalize_track_data(track_data)
                current_track = normalize_track_data(current_track_data) if current_track_data else None
                
                vote_next_session = datastore.create_vote_next_session(room_id, track, current_track, user_id, user_name)
                
                auto_task = asyncio.create_task(auto_complete_voting(room_id, vote_next_session.id, "next"))
                datastore.set_vote_next_task(vote_next_session.id, auto_task)
                
                timer_task = asyncio.create_task(voting_timer_countdown(room_id, vote_next_session.id, "next"))
                datastore.set_vote_next_task(f"timer_{vote_next_session.id}", timer_task)
                
                await manager.broadcast_to_room(room_id, {
                    "type": "vote_next_started",
                    "session_id": vote_next_session.id,
                    "track": track.dict(),
                    "current_track": current_track.dict() if current_track else None,
                    "proposed_by": user_name,
                    "proposed_by_id": user_id,
                    "total_participants": len(room.participants),
                    "total_voted": 0,
                    "votes_yes": 0,
                    "votes_no": 0,
                    "time_remaining": 30
                })
            
            elif message_type == "vote_next":
                session_id = data.get("session_id")
                vote_value = data.get("vote")
                
                if not session_id or not vote_value:
                    continue
                
                if session_id not in datastore.vote_next_sessions:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Сессия голосования не найдена"
                    })
                    continue
                
                session = datastore.vote_next_sessions[session_id]
                
                if session.status != "active":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Голосование завершено"
                    })
                    continue
                
                if user_id in session.voters:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Вы уже проголосовали"
                    })
                    continue
                
                result = datastore.cast_vote_on_next_session(session_id, user_id, vote_value)
                
                if result.get("error"):
                    await websocket.send_json({
                        "type": "error",
                        "message": result["error"]
                    })
                    continue
                
                room = datastore.rooms[room_id]
                
                await manager.broadcast_to_room(room_id, {
                    "type": "vote_next_update",
                    "session_id": session_id,
                    "votes_yes": result["votes_yes"],
                    "votes_no": result["votes_no"],
                    "total_voted": result["total_voted"],
                    "total_participants": len(room.participants),
                    "time_remaining": session.time_remaining,
                    "track": session.track.dict(),
                    "current_track": session.current_track.dict() if session.current_track else None
                })
                
                await check_and_complete_voting(room_id, session_id, "next")
    
    except Exception as e:
        # WebSocketDisconnect обрабатывается тихо, остальные ошибки логируем
        if "WebSocketDisconnect" not in str(e):
            print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(room_id, user_id, websocket)
        await manager.broadcast_to_room(room_id, {
            "type": "user_disconnected",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now().isoformat()
        })
