from typing import Dict, List
from fastapi import WebSocket

class PartyConnectionManager:
    def __init__(self):
        # party_id -> список активных веб-сокетов игроков
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, party_id: int, websocket: WebSocket):
        await websocket.accept()
        if party_id not in self.active_connections:
            self.active_connections[party_id] = []
        self.active_connections[party_id].append(websocket)

    def disconnect(self, party_id: int, websocket: WebSocket):
        if party_id in self.active_connections:
            if websocket in self.active_connections[party_id]:
                self.active_connections[party_id].remove(websocket)
            if not self.active_connections[party_id]:
                del self.active_connections[party_id]

    async def broadcast(self, party_id: int, message: dict):
        if party_id not in self.active_connections:
            return
        dead_connections = []
        for connection in self.active_connections[party_id]:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(party_id, dead)

party_manager = PartyConnectionManager()
