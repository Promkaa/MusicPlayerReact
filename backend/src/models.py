from typing import List, Optional
from datetime import datetime
import uuid
from pydantic import BaseModel


class Track(BaseModel):
    id: Optional[str] = None
    vk_id: Optional[str] = None
    artist: str = "Unknown"
    title: str = "Unknown"
    duration: Optional[int] = 0
    url: Optional[str] = None
    cover_url: Optional[str] = None
    cover_small: Optional[str] = None
    cover_big: Optional[str] = None
    added_by: Optional[str] = None
    added_by_id: Optional[str] = None
    added_at: Optional[str] = None
    position: Optional[int] = None


class Participant(BaseModel):
    id: str
    name: str
    isCreator: bool = False
    joined_at: Optional[str] = None


class Room(BaseModel):
    id: str
    name: str
    createdAt: str
    creator: str
    creator_id: Optional[str] = None
    participants: List[Participant] = []
    tracks: List[Track] = []
    scenario: str = "withVoting"
    currentTrack: Optional[Track] = None
    currentTrackIndex: int = -1
    isPlaying: bool = False
    currentTime: float = 0
    roomIsShuffled: bool = False
    roomRepeatMode: str = "off"


class ChatMessage(BaseModel):
    id: str = None
    room_id: str
    user_id: str
    user_name: str
    message: str
    timestamp: str
    
    def __init__(self, **data):
        if 'id' not in data or not data['id']:
            data['id'] = str(uuid.uuid4())
        super().__init__(**data)


class VotingSession(BaseModel):
    id: str
    room_id: str
    track: Track
    proposed_by: str
    proposed_by_id: str
    proposed_at: str
    status: str = "active"
    votes_yes: List[str] = []
    votes_no: List[str] = []
    voters: List[str] = []
    time_remaining: int = 60
    
    class Config:
        arbitrary_types_allowed = True


class VoteNextSession(BaseModel):
    id: str
    room_id: str
    track: Track
    current_track: Optional[Track] = None
    proposed_by: str
    proposed_by_id: str
    proposed_at: str
    status: str = "active"
    votes_yes: List[str] = []
    votes_no: List[str] = []
    voters: List[str] = []
    time_remaining: int = 30