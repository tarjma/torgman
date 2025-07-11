import json
import logging
from typing import List, Dict
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manage WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.project_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, project_id: str = None):
        """Connect a WebSocket client"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if project_id:
            if project_id not in self.project_connections:
                self.project_connections[project_id] = []
            self.project_connections[project_id].append(websocket)
            logger.info(f"WebSocket connected for project {project_id}")
    
    def disconnect(self, websocket: WebSocket, project_id: str = None):
        """Disconnect a WebSocket client"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if project_id and project_id in self.project_connections:
            if websocket in self.project_connections[project_id]:
                self.project_connections[project_id].remove(websocket)
                if not self.project_connections[project_id]:
                    del self.project_connections[project_id]
        
        logger.info(f"WebSocket disconnected for project {project_id}")
    
    async def send_message(self, message: dict, websocket: WebSocket):
        """Send message to a specific WebSocket"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending message to WebSocket: {e}")
    
    async def send_to_project(self, project_id: str, message: dict):
        """Send message to all WebSockets connected to a specific project"""
        logger.info(f"Sending message to project {project_id}: {message.get('type', 'unknown')}")
        if project_id in self.project_connections:
            logger.info(f"Found {len(self.project_connections[project_id])} connections for project {project_id}")
            disconnected = []
            for websocket in self.project_connections[project_id]:
                try:
                    message_str = json.dumps(message)
                    await websocket.send_text(message_str)
                    logger.debug(f"Message sent successfully to WebSocket for project {project_id}")
                except Exception as e:
                    logger.error(f"Error sending to project {project_id}: {e}")
                    disconnected.append(websocket)
            
            # Clean up disconnected WebSockets
            for ws in disconnected:
                self.disconnect(ws, project_id)
        else:
            logger.warning(f"No WebSocket connections found for project {project_id}")
    
    async def broadcast(self, message: dict):
        """Send message to all connected WebSockets"""
        disconnected = []
        for websocket in self.active_connections:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected WebSockets
        for ws in disconnected:
            self.disconnect(ws)
    
    def get_project_connection_count(self, project_id: str) -> int:
        """Get number of active connections for a project"""
        return len(self.project_connections.get(project_id, []))
    
    def get_total_connections(self) -> int:
        """Get total number of active connections"""
        return len(self.active_connections)
