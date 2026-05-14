from routes.rooms import router as rooms_router
from routes.player import router as player_router
from routes.vk_auth import router as vk_router
from routes.chat import router as chat_router

__all__ = [
    'rooms_router',
    'player_router', 
    'vk_router',
    'chat_router'
]
