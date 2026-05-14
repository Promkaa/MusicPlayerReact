import json
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from models import Room, ChatMessage, VotingSession, VoteNextSession, Track, Participant


class DataStore:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.user_sessions: Dict[str, Dict] = {}
        self.chat_messages: Dict[str, List[ChatMessage]] = {}
        self.voting_sessions: Dict[str, VotingSession] = {}
        self.vote_next_sessions: Dict[str, VoteNextSession] = {}
        self.room_voting: Dict[str, str] = {}
        self.room_vote_next: Dict[str, str] = {}
        self.voting_tasks: Dict[str, asyncio.Task] = {}
        self.vote_next_tasks: Dict[str, asyncio.Task] = {}
        
        self.user_data_dir = Path(__file__).parent.parent / "user_data"
        self.user_data_dir.mkdir(exist_ok=True)
        self.load_rooms_from_file()
    
    def load_rooms_from_file(self):
        rooms_file = Path(__file__).parent.parent / "rooms_backup.json"
        if rooms_file.exists():
            try:
                with open(rooms_file, 'r', encoding='utf-8') as f:
                    rooms_data = json.load(f)
                    for room_data in rooms_data:
                        room = Room(**room_data)
                        self.rooms[room.id] = room
                print(f"✅ Загружено {len(self.rooms)} комнат")
            except Exception as e:
                print(f"❌ Ошибка загрузки комнат: {e}")
    
    def save_rooms_to_file(self):
        try:
            rooms_file = Path(__file__).parent.parent / "rooms_backup.json"
            rooms_data = [room.dict() for room in self.rooms.values()]
            with open(rooms_file, 'w', encoding='utf-8') as f:
                json.dump(rooms_data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"❌ Ошибка сохранения комнат: {e}")
            return False
    
    def get_user_music_file(self, user_id: str) -> Path:
        return self.user_data_dir / f"user_{user_id}_music.json"
    
    def get_user_music_data(self, user_id: str) -> Dict[str, Any]:
        user_file = self.get_user_music_file(user_id)
        if user_file.exists():
            try:
                with open(user_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Убеждаемся, что у каждого трека есть url
                    for playlist in data.get('playlists', []):
                        for track in playlist.get('tracks', []):
                            if not track.get('url'):
                                print(f"⚠️ Track {track.get('title')} has no URL")
                    return data
            except Exception as e:
                print(f"Error loading user music data: {e}")
        return {"playlists": [], "exported_at": datetime.now().isoformat(), "user_id": user_id}
    
    def save_user_music_data(self, user_id: str, data: Dict[str, Any]):
        user_file = self.get_user_music_file(user_id)
        with open(user_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    
    # ==================== ГОЛОСОВАНИЕ ЗА ДОБАВЛЕНИЕ ТРЕКА ====================
    
    def create_voting_session(self, room_id: str, track: Track, user_id: str, user_name: str) -> VotingSession:
        session_id = f"vote_{room_id}_{int(datetime.now().timestamp() * 1000)}"
        
        voting_session = VotingSession(
            id=session_id,
            room_id=room_id,
            track=track,
            proposed_by=user_name,
            proposed_by_id=user_id,
            proposed_at=datetime.now().isoformat(),
            status="active",
            votes_yes=[],
            votes_no=[],
            voters=[],
            time_remaining=60
        )
        
        self.voting_sessions[session_id] = voting_session
        self.room_voting[room_id] = session_id
        return voting_session
    
    def set_voting_task(self, session_id: str, task: asyncio.Task):
        self.voting_tasks[session_id] = task
    
    def cancel_voting_task(self, session_id: str):
        if session_id in self.voting_tasks:
            if not self.voting_tasks[session_id].done():
                self.voting_tasks[session_id].cancel()
            del self.voting_tasks[session_id]

    def cast_vote_on_session(self, session_id: str, user_id: str, vote: str) -> Dict[str, Any]:
        if session_id not in self.voting_sessions:
            return {"error": "Session not found"}
        
        session = self.voting_sessions[session_id]
        
        if session.status != "active":
            return {"error": "Voting session is not active"}
        
        if user_id in session.voters:
            return {"error": "User already voted"}
        
        session.voters.append(user_id)
        if vote == "yes":
            session.votes_yes.append(user_id)
        else:
            session.votes_no.append(user_id)
        
        return {
            "session_id": session_id,
            "votes_yes": len(session.votes_yes),
            "votes_no": len(session.votes_no),
            "total_voted": len(session.voters)
        }

    def get_voting_session(self, room_id: str):
        session_id = self.room_voting.get(room_id)
        if session_id and session_id in self.voting_sessions:
            session = self.voting_sessions[session_id]
            if session.status == "active":
                return session
        return None

    def complete_voting(self, room_id: str) -> Dict[str, Any]:
        session_id = self.room_voting.get(room_id)
        if not session_id or session_id not in self.voting_sessions:
            return None
        
        session = self.voting_sessions[session_id]
        
        if session.status != "active":
            return None
        
        self.cancel_voting_task(session_id)
        
        total_votes = len(session.voters)
        yes_votes = len(session.votes_yes)
        no_votes = len(session.votes_no)
        
        accepted = yes_votes > no_votes
        
        session.status = "completed"
        
        if room_id in self.room_voting:
            del self.room_voting[room_id]
        
        return {
            "accepted": accepted,
            "yes_votes": yes_votes,
            "no_votes": no_votes,
            "total_votes": total_votes,
            "session": session
        }
    
    # ==================== ГОЛОСОВАНИЕ "СЛЕДУЮЩИМ" ====================
    
    def create_vote_next_session(self, room_id: str, track: Track, current_track: Track, user_id: str, user_name: str) -> VoteNextSession:
        session_id = f"vote_next_{room_id}_{int(datetime.now().timestamp() * 1000)}"
        
        vote_next_session = VoteNextSession(
            id=session_id,
            room_id=room_id,
            track=track,
            current_track=current_track,
            proposed_by=user_name,
            proposed_by_id=user_id,
            proposed_at=datetime.now().isoformat(),
            status="active",
            votes_yes=[],
            votes_no=[],
            voters=[],
            time_remaining=30
        )
        
        self.vote_next_sessions[session_id] = vote_next_session
        self.room_vote_next[room_id] = session_id
        return vote_next_session
    
    def set_vote_next_task(self, session_id: str, task: asyncio.Task):
        self.vote_next_tasks[session_id] = task
    
    def cancel_vote_next_task(self, session_id: str):
        if session_id in self.vote_next_tasks:
            if not self.vote_next_tasks[session_id].done():
                self.vote_next_tasks[session_id].cancel()
            del self.vote_next_tasks[session_id]

    def cast_vote_on_next_session(self, session_id: str, user_id: str, vote: str) -> Dict[str, Any]:
        if session_id not in self.vote_next_sessions:
            return {"error": "Session not found"}
        
        session = self.vote_next_sessions[session_id]
        
        if session.status != "active":
            return {"error": "Voting session is not active"}
        
        if user_id in session.voters:
            return {"error": "User already voted"}
        
        session.voters.append(user_id)
        if vote == "yes":
            session.votes_yes.append(user_id)
        else:
            session.votes_no.append(user_id)
        
        return {
            "session_id": session_id,
            "votes_yes": len(session.votes_yes),
            "votes_no": len(session.votes_no),
            "total_voted": len(session.voters)
        }

    def get_vote_next_session(self, room_id: str):
        session_id = self.room_vote_next.get(room_id)
        if session_id and session_id in self.vote_next_sessions:
            session = self.vote_next_sessions[session_id]
            if session.status == "active":
                return session
        return None

    def complete_vote_next(self, room_id: str) -> Dict[str, Any]:
        session_id = self.room_vote_next.get(room_id)
        if not session_id or session_id not in self.vote_next_sessions:
            return None
        
        session = self.vote_next_sessions[session_id]
        
        if session.status != "active":
            return None
        
        self.cancel_vote_next_task(session_id)
        
        total_votes = len(session.voters)
        yes_votes = len(session.votes_yes)
        no_votes = len(session.votes_no)
        
        accepted = yes_votes > no_votes
        
        session.status = "completed"
        
        if room_id in self.room_vote_next:
            del self.room_vote_next[room_id]
        
        return {
            "accepted": accepted,
            "yes_votes": yes_votes,
            "no_votes": no_votes,
            "total_votes": total_votes,
            "session": session
        }
    
    def has_all_voted(self, room_id: str, voting_type: str = "add") -> bool:
        """Проверка, все ли проголосовали"""
        if voting_type == "add":
            session = self.get_voting_session(room_id)
        else:
            session = self.get_vote_next_session(room_id)
        
        if not session:
            return False
        
        room = self.rooms.get(room_id)
        if not room:
            return False
        
        total_participants = len(room.participants)
        total_voted = len(session.voters)
        
        if total_participants == 0:
            return True
        
        return total_voted >= total_participants
    
    def has_reached_win_condition(self, room_id: str, voting_type: str = "add") -> bool:
        """Проверка, достигнуто ли условие победы (когда результат уже ясен)"""
        if voting_type == "add":
            session = self.get_voting_session(room_id)
        else:
            session = self.get_vote_next_session(room_id)
        
        if not session or session.status != "active":
            return False
        
        room = self.rooms.get(room_id)
        if not room:
            return False
        
        total_participants = len(room.participants)
        total_voted = len(session.voters)
        yes_votes = len(session.votes_yes)
        no_votes = len(session.votes_no)
        remaining_voters = total_participants - total_voted
        
        # Необходимое количество для победы - больше половины от общего числа участников
        needed_to_win = total_participants // 2 + 1
        
        # Условие победы ЗА: голосов ЗА уже достаточно для победы
        if yes_votes >= needed_to_win:
            print(f"🎯 Win condition reached for {voting_type}: YES wins! yes={yes_votes}, needed={needed_to_win}")
            return True
        
        # Условие победы ПРОТИВ: даже если все оставшиеся проголосуют ЗА, ЗА всё равно не наберут достаточно
        # То есть: no_votes >= needed_to_win ИЛИ yes_votes + remaining_voters < needed_to_win
        if no_votes >= needed_to_win:
            print(f"🎯 Win condition reached for {voting_type}: NO wins! no={no_votes}, needed={needed_to_win}")
            return True
        
        # Если оставшихся голосов недостаточно, чтобы ЗА победили
        if yes_votes + remaining_voters < needed_to_win:
            print(f"🎯 Win condition reached for {voting_type}: NO wins mathematically! yes={yes_votes}, remaining={remaining_voters}, needed={needed_to_win}")
            return True
        
        return False


# Глобальный экземпляр
datastore = DataStore()