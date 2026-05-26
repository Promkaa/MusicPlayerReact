from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import rooms_router, player_router, vk_router, chat_router
from websocket import websocket_router

app = FastAPI(title="VK Music Player API", version="1.0.0")

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        # свои ipшники подставляем (ищи в ipconfig)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(rooms_router)
app.include_router(player_router)
app.include_router(vk_router)
app.include_router(chat_router)
app.include_router(websocket_router)


@app.get("/")
async def root():
    return {"message": "VK Music Player API", "status": "running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
