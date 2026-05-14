from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict
import asyncio
from datetime import datetime

from datastore import datastore
from vk_parser import vk_parser

router = APIRouter(prefix="/api", tags=["vk"])

# Хранилище для отслеживания статуса парсинга
parsing_status = {
    "is_parsing": False,
    "status": "idle",
    "progress": 0,
    "current_user_id": None
}




@router.post("/verify-token")
async def verify_vk_token(token_data: Dict[str, str]):
    token = token_data.get("token")
    if not token:
        return {"valid": False, "error": "Token required"}
    
    # Используем vk_parser для проверки токена
    auth_result = vk_parser.authenticate(token)
    
    if auth_result.get("success"):
        user = auth_result["user"]
        return {
            "valid": True,
            "user": {
                "id": user["id"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "full_name": user["full_name"]
            }
        }
    else:
        return {"valid": False, "error": auth_result.get("error", "Invalid token")}


@router.get("/music-data")
async def get_music_data(user_id: str):
    data = datastore.get_user_music_data(user_id)
    return data


@router.get("/music-stats")
async def get_music_stats(user_id: str):
    data = datastore.get_user_music_data(user_id)
    total_tracks = 0
    playlists_stats = []
    
    for playlist in data.get('playlists', []):
        tracks_count = len(playlist.get('tracks', []))
        total_tracks += tracks_count
        playlists_stats.append({
            'id': playlist.get('id'),
            'title': playlist.get('title'),
            'tracks_count': tracks_count,
            'is_main': playlist.get('is_main', False)
        })
    
    return {
        'total_tracks': total_tracks,
        'total_playlists': len(data.get('playlists', [])),
        'playlists': playlists_stats
    }


def run_parse_music_sync(token: str, user_id: str):
    """Синхронная обертка для парсинга музыки (запускается в фоне)"""
    global parsing_status
    
    try:
        # Сбрасываем статус перед началом
        parsing_status["is_parsing"] = True
        parsing_status["current_user_id"] = user_id
        
        # Запускаем парсинг через vk_parser
        result = vk_parser.parse_user_music(token, user_id)
        
        if result.get("success"):
            # Загружаем данные в datastore из JSON файла
            user_data = datastore.get_user_music_data(user_id)
            
            # Обновляем статус
            parsing_status["status"] = "completed"
            parsing_status["progress"] = 100
            print(f"✅ Parsing completed for user {user_id}: {result.get('tracks_count', 0)} tracks")
        else:
            parsing_status["status"] = "error"
            print(f"❌ Parsing error for user {user_id}: {result.get('error')}")
        
        parsing_status["is_parsing"] = False
        
    except Exception as e:
        print(f"❌ Exception in parse_music_sync: {e}")
        parsing_status["status"] = "error"
        parsing_status["is_parsing"] = False
        parsing_status["progress"] = 0


@router.post("/parse-music")
async def parse_music(token_data: Dict[str, str], background_tasks: BackgroundTasks):
    token = token_data.get("token")
    user_id = token_data.get("user_id")
    
    if not token or not user_id:
        raise HTTPException(status_code=400, detail="Token and user_id required")
    
    global parsing_status
    
    if parsing_status["is_parsing"] and parsing_status["current_user_id"] == user_id:
        return {"success": False, "error": "Parsing already in progress"}
    
    # Запускаем фоновую задачу
    background_tasks.add_task(run_parse_music_sync, token, user_id)
    
    # Обновляем статус
    parsing_status["is_parsing"] = True
    parsing_status["status"] = "parsing_tracks"
    parsing_status["progress"] = 0
    parsing_status["current_user_id"] = user_id
    
    return {"success": True, "message": "Parse started"}


@router.get("/parse-status")
async def get_parse_status():
    # Получаем статус из vk_parser
    vk_status = vk_parser.get_parse_status()
    
    # Обновляем глобальный статус
    global parsing_status
    parsing_status["is_parsing"] = vk_status["is_parsing"]
    parsing_status["status"] = vk_status["status"]
    parsing_status["progress"] = vk_status["progress"]
    
    return {
        "is_parsing": parsing_status["is_parsing"],
        "status": parsing_status["status"],
        "progress": parsing_status["progress"]
    }


@router.post("/sync-playlist/{playlist_id}")
async def sync_playlist(playlist_id: str, token_data: Dict[str, str], background_tasks: BackgroundTasks):
    """Синхронизация конкретного плейлиста"""
    token = token_data.get("token")
    user_id = token_data.get("user_id")
    
    if not token or not user_id:
        raise HTTPException(status_code=400, detail="Token and user_id required")
    
    # Запускаем синхронизацию конкретного плейлиста в фоне
    def run_sync():
        result = vk_parser.sync_playlist(token, playlist_id, user_id)
        if result.get("success"):
            # Обновляем данные в datastore
            datastore.load_rooms_from_file()  # Перезагружаем данные
            print(f"✅ Playlist {playlist_id} synced: {result.get('tracks_count', 0)} tracks")
        else:
            print(f"❌ Sync error: {result.get('error')}")
    
    background_tasks.add_task(run_sync)
    
    return {"success": True, "message": "Sync started"}