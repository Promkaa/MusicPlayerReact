from fastapi import WebSocket, APIRouter
from datetime import datetime
import asyncio

from datastore import datastore
from managers import manager, normalize_track_data
from models import ChatMessage, Track
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
                    "time_remaining": voting_session.time_remaining,
                    "duration_seconds": voting_session.duration_seconds
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
                    "user_vote": vote_value  # ✅ ДОБАВЛЯЕМ поле user_vote
                })
                
                # Проверяем, что сессия всё ещё активна перед завершением
                current_session = datastore.voting_sessions.get(session_id)
                if current_session and current_session.status == "active":
                    await check_and_complete_voting(room_id, session_id, "add")
            
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
                    "current_track": session.current_track.dict() if session.current_track else None,
                    "user_id": user_id,
                    "user_vote": vote_value  # ✅ ДОБАВЛЯЕМ поле user_vote
                })
                
                # Проверяем, что сессия всё ещё активна перед завершением
                current_session = datastore.vote_next_sessions.get(session_id)
                if current_session and current_session.status == "active":
                    await check_and_complete_voting(room_id, session_id, "next")
            
            elif message_type == "add_track_directly":
                track_data = data.get("track", {})

                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]

                track_id = track_data.get('id') or track_data.get('vk_id')
                track_exists = any(
                    t.id == track_id or t.vk_id == track_id 
                    for t in room.tracks
                )

                if track_exists:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Трек уже существует в плейлисте комнаты"
                    })
                    continue
                
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
                    "time_remaining": vote_next_session.time_remaining,
                    "duration_seconds": vote_next_session.duration_seconds 
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
            
            elif message_type == "cancel_proposal":
                if room_id not in datastore.rooms:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Комната не найдена"
                    })
                    continue
                
                result = datastore.cancel_voting_session(room_id, user_id)

                if result.get("success"):
                    await manager.broadcast_to_room(room_id, {
                        "type": "voting_cancelled",
                        "session_id": result["session_id"],
                        "track": result["track"].dict(),
                        "cancelled_by": user_name,
                        "cancelled_by_id": user_id,
                        "voting_type": result["type"]
                    })

                    await websocket.send_json({
                        "type": "proposal_cancelled",
                        "success": True,
                        "message": "Ваше предложение отменено"
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": result.get("error", "Не удалось отменить предложение")
                    })
            
            # 🆕 СМЕНА РЕЖИМА ВОСПРОИЗВЕДЕНИЯ (только создатель)
            elif message_type == "set_playback_mode":
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                new_mode = data.get("mode")
                host_id = data.get("host_id")
                requesting_user_id = data.get("user_id")
                
                # Только создатель может менять режим
                if room.creator_id != requesting_user_id and room.creator != requesting_user_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Только создатель комнаты может менять режим воспроизведения"
                    })
                    continue
                
                if new_mode not in ["sync", "host"]:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Неверный режим воспроизведения"
                    })
                    continue
                
                room.playback_mode = new_mode
                room.host_id = host_id if new_mode == "host" else None
                datastore.rooms[room_id] = room
                datastore.save_rooms_to_file()
                
                # Оповещаем всех о смене режима
                await manager.broadcast_to_room(room_id, {
                    "type": "playback_mode_changed",
                    "playback_mode": new_mode,
                    "host_id": room.host_id,
                    "host_name": user_name if new_mode == "host" and user_id == host_id else None
                })
            
            # 🆕 ВОСПРОИЗВЕДЕНИЕ ТРЕКА (с учётом режима)
            elif message_type == "play_track":
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                
                # В режиме хоста — только хост может запускать треки
                if room.playback_mode == "host" and user_id != room.host_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Только хост может запускать треки в режиме хоста"
                    })
                    continue
                
                track_data = data.get("track", {})
                track_index = data.get("index", -1)
                track = normalize_track_data(track_data)
                room.currentTrack = track
                room.currentTrackIndex = track_index
                room.isPlaying = True
                room.currentTime = 0
                datastore.rooms[room_id] = room
                datastore.save_rooms_to_file()
                
                # ВСЕГДА широковещательно (но в режиме хоста другие не будут играть аудио, только обновят UI)
                await manager.broadcast_to_room(room_id, {
                    "type": "player_play",
                    "track": track.dict(),
                    "index": track_index,
                    "user_id": user_id,
                    "user_name": user_name
                })
            
            # 🆕 ПАУЗА
            elif message_type == "pause_track":
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                room.isPlaying = False
                datastore.rooms[room_id] = room
                datastore.save_rooms_to_file()

                if room.playback_mode == "host":
                    if user_id == room.host_id:
                        await websocket.send_json({
                            "type": "player_pause",
                            "currentTime": room.currentTime
                        })
                else:
                    await manager.broadcast_to_room(room_id, {
                        "type": "player_pause",
                        "currentTime": room.currentTime,
                        "user_id": user_id,
                        "user_name": user_name
                    })
            
            # 🆕 ПЕРЕМОТКА
            elif message_type == "seek_track":
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                seek_time = data.get("time", 0)
                room.currentTime = seek_time
                datastore.rooms[room_id] = room
                datastore.save_rooms_to_file()
                
                if room.playback_mode == "host":
                    if user_id == room.host_id:
                        await websocket.send_json({
                            "type": "player_seek",
                            "currentTime": seek_time
                        })
                else:
                    await manager.broadcast_to_room(room_id, {
                        "type": "player_seek",
                        "currentTime": seek_time,
                        "user_id": user_id,
                        "user_name": user_name
                    })
            
            elif message_type == "pause_track":
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                
                # В режиме хоста — только хост может управлять
                if room.playback_mode == "host" and user_id != room.host_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Только хост может управлять воспроизведением в режиме хоста"
                    })
                    continue
                
                room.isPlaying = False
                datastore.rooms[room_id] = room
                datastore.save_rooms_to_file()

                # ВСЕГДА широковещательно, чтобы все участники знали о паузе
                await manager.broadcast_to_room(room_id, {
                    "type": "player_pause",
                    "currentTime": room.currentTime,
                    "user_id": user_id,
                    "user_name": user_name
                })
            
            # 🆕 СЛЕДУЮЩИЙ ТРЕК
            elif message_type == "next_track":
                if room_id not in datastore.rooms:
                    continue
                
                room = datastore.rooms[room_id]
                
                # В режиме хоста — только хост может переключать треки
                if room.playback_mode == "host" and user_id != room.host_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Только хост может переключать треки в режиме хоста"
                    })
                    continue

                # Логика выбора следующего трека из room.tracks
                if room.tracks and len(room.tracks) > 0:
                    next_index = (room.currentTrackIndex + 1) % len(room.tracks)
                    next_track = room.tracks[next_index]
                    room.currentTrack = next_track
                    room.currentTrackIndex = next_index
                    room.currentTime = 0
                    room.isPlaying = True
                    datastore.rooms[room_id] = room
                    datastore.save_rooms_to_file()

                    # ВСЕГДА широковещательно, чтобы все участники знали о смене трека
                    await manager.broadcast_to_room(room_id, {
                        "type": "player_next",
                        "track": next_track.dict(),
                        "index": next_index,
                        "user_id": user_id,
                        "user_name": user_name
                    })
    
    except Exception as e:
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
