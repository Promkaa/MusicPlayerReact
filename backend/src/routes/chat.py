from fastapi import APIRouter

from datastore import datastore

router = APIRouter(prefix="/api", tags=["chat"])


@router.get("/chat/{room_id}")
async def get_messages(room_id: str, limit: int = 50):
    messages = datastore.chat_messages.get(room_id, [])
    return {"messages": [msg.dict() for msg in messages[-limit:]]}