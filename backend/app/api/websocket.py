from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from ..services.websocket_service import ConnectionManager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# Global connection manager
manager = ConnectionManager()

@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """WebSocket for real-time project updates"""
    await manager.connect(websocket, project_id)
    try:
        while True:
            # Keep connection alive and listen for messages
            data = await websocket.receive_text()
            logger.debug(f"Received WebSocket message for project {project_id}: {data}")
            
            # Echo back for heartbeat/testing
            await manager.send_to_project(project_id, {
                "type": "heartbeat",
                "project_id": project_id,
                "message": "Connection active"
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
        logger.info(f"WebSocket disconnected for project {project_id}")
    except Exception as e:
        logger.error(f"WebSocket error for project {project_id}: {e}")
        manager.disconnect(websocket, project_id)

@router.websocket("/ws")
async def global_websocket_endpoint(websocket: WebSocket):
    """Global WebSocket for system-wide updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            logger.debug(f"Received global WebSocket message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Global WebSocket disconnected")
    except Exception as e:
        logger.error(f"Global WebSocket error: {e}")
        manager.disconnect(websocket)
