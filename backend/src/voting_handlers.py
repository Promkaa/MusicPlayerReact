import asyncio
from datetime import datetime

from datastore import datastore
from managers import manager


async def voting_timer_countdown(room_id: str, session_id: str, voting_type: str = "add"):
    if voting_type == "add":
        session = datastore.voting_sessions.get(session_id)
    else:
        session = datastore.vote_next_sessions.get(session_id)
    
    if not session:
        return
    
    try:
        while session.time_remaining > 0:
            await asyncio.sleep(1)
            
            # Заново получаем сессию (могла быть отменена)
            if voting_type == "add":
                session = datastore.voting_sessions.get(session_id)
            else:
                session = datastore.vote_next_sessions.get(session_id)
            
            if not session or session.status != "active":
                return  # Выход, если сессия отменена или завершена
            
            session.time_remaining -= 1
            
            room = datastore.rooms.get(room_id)
            total_participants = len(room.participants) if room else 0
            
            if voting_type == "add":
                await manager.broadcast_to_room(room_id, {
                    "type": "voting_update",
                    "session_id": session_id,
                    "votes_yes": len(session.votes_yes),
                    "votes_no": len(session.votes_no),
                    "total_voted": len(session.voters),
                    "total_participants": total_participants,
                    "time_remaining": session.time_remaining,
                    "track": session.track.dict(),
                    "proposed_by": session.proposed_by
                })
            else:
                await manager.broadcast_to_room(room_id, {
                    "type": "vote_next_update",
                    "session_id": session_id,
                    "votes_yes": len(session.votes_yes),
                    "votes_no": len(session.votes_no),
                    "total_voted": len(session.voters),
                    "total_participants": total_participants,
                    "time_remaining": session.time_remaining,
                    "track": session.track.dict(),
                    "current_track": session.current_track.dict() if session.current_track else None,
                    "proposed_by": session.proposed_by
                })
    except asyncio.CancelledError:
        pass


async def auto_complete_voting(room_id: str, session_id: str, voting_type: str = "add"):
    if voting_type == "add":
        session = datastore.voting_sessions.get(session_id)
    else:
        session = datastore.vote_next_sessions.get(session_id)
    
    if not session:
        return

    wait_time = getattr(session, 'duration_seconds', 60)
    if voting_type == "next":
        wait_time = getattr(session, 'duration_seconds', 30)

    
    for i in range(wait_time):
        await asyncio.sleep(1)
        
        if voting_type == "add":
            session = datastore.get_voting_session(room_id)
        else:
            session = datastore.get_vote_next_session(room_id)
        
        # Если сессия уже завершена (кем-то другим) — выходим
        if not session or session.status != "active":
            return
    
    print(f"Auto complete: timeout reached for session {session_id}")
    
    if voting_type == "add":
        session = datastore.get_voting_session(room_id)
    else:
        session = datastore.get_vote_next_session(room_id)

    if session and session.id == session_id and session.status == "active":
        if voting_type == "add":
            result = datastore.complete_voting(room_id)
        else:
            result = datastore.complete_vote_next(room_id)
        
        if result:
            room = datastore.rooms.get(room_id)
            
            if voting_type == "add":
                if room and result["accepted"]:
                    result["session"].track.added_by = result["session"].proposed_by
                    result["session"].track.added_by_id = result["session"].proposed_by_id
                    result["session"].track.added_at = datetime.now().isoformat()
                    room.tracks.append(result["session"].track)
                    datastore.rooms[room_id] = room
                    datastore.save_rooms_to_file()
                    print(f"Track added to playlist: {result['session'].track.title}")
                else:
                    print(f"Track rejected: {result['session'].track.title if result['session'].track else 'Unknown'}")
                
                await manager.broadcast_to_room(room_id, {
                    "type": "voting_ended",
                    "accepted": result["accepted"],
                    "track": result["session"].track.dict(),
                    "votes_yes": result["yes_votes"],
                    "votes_no": result["no_votes"],
                    "total_votes": result["total_votes"],
                    "reason": "timeout"
                })
            else:
                if room and result["accepted"] and result["session"].current_track:
                    current_track_id = result["session"].current_track.id or result["session"].current_track.vk_id
                    proposed_track_id = result["session"].track.id or result["session"].track.vk_id
                    
                    current_index = -1
                    proposed_index = -1
                    
                    for i, track in enumerate(room.tracks):
                        track_id = track.id or track.vk_id
                        if track_id == current_track_id:
                            current_index = i
                        if track_id == proposed_track_id:
                            proposed_index = i
                    
                    if current_index != -1 and proposed_index != -1 and proposed_index != current_index + 1:
                        track_to_move = room.tracks.pop(proposed_index)
                        new_position = current_index + 1
                        if new_position > len(room.tracks):
                            room.tracks.append(track_to_move)
                        else:
                            room.tracks.insert(new_position, track_to_move)
                        datastore.rooms[room_id] = room
                        datastore.save_rooms_to_file()
                        print(f"Track moved to next position: {result['session'].track.title}")
                
                await manager.broadcast_to_room(room_id, {
                    "type": "vote_next_ended",
                    "accepted": result["accepted"],
                    "track": result["session"].track.dict(),
                    "current_track": result["session"].current_track.dict() if result["session"].current_track else None,
                    "votes_yes": result["yes_votes"],
                    "votes_no": result["no_votes"],
                    "total_votes": result["total_votes"],
                    "reason": "timeout"
                })


async def check_and_complete_voting(room_id: str, session_id: str, voting_type: str = "add"):
    """Проверка и завершение голосования если результат уже ясен"""
    
    if voting_type == "add":
        session = datastore.get_voting_session(room_id)
        all_voted = datastore.has_all_voted(room_id, voting_type)
        win_condition = datastore.has_reached_win_condition(room_id, voting_type)
    else:
        session = datastore.get_vote_next_session(room_id)
        all_voted = datastore.has_all_voted(room_id, voting_type)
        win_condition = datastore.has_reached_win_condition(room_id, voting_type)
    
    if not session or session.status != "active":
        return False
    
    print(f"check_and_complete_voting: room={room_id}, type={voting_type}, all_voted={all_voted}, win_condition={win_condition}")
    
    # Завершаем голосование если:
    # 1. Все проголосовали ИЛИ
    # 2. Достигнуто условие победы (результат уже ясен)
    if all_voted or win_condition:
        print(f"Completing voting for session {session_id} (all_voted={all_voted}, win_condition={win_condition})")
        
        # Отменяем таймеры
        if voting_type == "add":
            datastore.cancel_voting_task(session_id)
            datastore.cancel_voting_task(f"timer_{session_id}")
        else:
            datastore.cancel_vote_next_task(session_id)
            datastore.cancel_vote_next_task(f"timer_{session_id}")
        
        # Завершаем голосование
        if voting_type == "add":
            result = datastore.complete_voting(room_id)
        else:
            result = datastore.complete_vote_next(room_id)
        
        if result:
            room = datastore.rooms.get(room_id)
            
            if voting_type == "add":
                if room and result["accepted"]:
                    result["session"].track.added_by = result["session"].proposed_by
                    result["session"].track.added_by_id = result["session"].proposed_by_id
                    result["session"].track.added_at = datetime.now().isoformat()
                    room.tracks.append(result["session"].track)
                    datastore.rooms[room_id] = room
                    datastore.save_rooms_to_file()
                    print(f"Track added to playlist: {result['session'].track.title}")
                else:
                    print(f"Track rejected: {result['session'].track.title if result['session'].track else 'Unknown'}")
                
                await manager.broadcast_to_room(room_id, {
                    "type": "voting_ended",
                    "accepted": result["accepted"],
                    "track": result["session"].track.dict(),
                    "votes_yes": result["yes_votes"],
                    "votes_no": result["no_votes"],
                    "total_votes": result["total_votes"],
                    "reason": "win_condition" if win_condition else "all_voted"
                })
            else:
                if room and result["accepted"] and result["session"].current_track:
                    current_track_id = result["session"].current_track.id or result["session"].current_track.vk_id
                    proposed_track_id = result["session"].track.id or result["session"].track.vk_id
                    
                    current_index = -1
                    proposed_index = -1
                    
                    for i, track in enumerate(room.tracks):
                        track_id = track.id or track.vk_id
                        if track_id == current_track_id:
                            current_index = i
                        if track_id == proposed_track_id:
                            proposed_index = i
                    
                    if current_index != -1 and proposed_index != -1 and proposed_index != current_index + 1:
                        track_to_move = room.tracks.pop(proposed_index)
                        new_position = current_index + 1
                        if new_position > len(room.tracks):
                            room.tracks.append(track_to_move)
                        else:
                            room.tracks.insert(new_position, track_to_move)
                        datastore.rooms[room_id] = room
                        datastore.save_rooms_to_file()
                        print(f"Track moved to next position: {result['session'].track.title}")
                
                await manager.broadcast_to_room(room_id, {
                    "type": "vote_next_ended",
                    "accepted": result["accepted"],
                    "track": result["session"].track.dict(),
                    "current_track": result["session"].current_track.dict() if result["session"].current_track else None,
                    "votes_yes": result["yes_votes"],
                    "votes_no": result["no_votes"],
                    "total_votes": result["total_votes"],
                    "reason": "win_condition" if win_condition else "all_voted"
                })
            return True
    return False
