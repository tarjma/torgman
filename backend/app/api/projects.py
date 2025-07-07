from fastapi import APIRouter, HTTPException
from typing import List
import logging

from ..core.database import get_database
from ..models.project import ProjectData, SubtitleData

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/", response_model=List[ProjectData])
async def list_projects(limit: int = 50, offset: int = 0):
    """List all projects with pagination"""
    try:
        db = await get_database()
        projects = await db.list_projects(limit=limit, offset=offset)
        return projects
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")

@router.get("/{project_id}", response_model=ProjectData)
async def get_project(project_id: str):
    """Get a project by ID"""
    try:
        db = await get_database()
        project = await db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")

@router.get("/{project_id}/subtitles", response_model=List[SubtitleData])
async def get_project_subtitles(project_id: str):
    """Get subtitles for a project"""
    try:
        db = await get_database()
        # Check if project exists
        project = await db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        subtitles = await db.get_project_subtitles(project_id)
        return subtitles
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subtitles for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get subtitles: {str(e)}")

@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project and its subtitles"""
    try:
        db = await get_database()
        # Check if project exists
        project = await db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        success = await db.delete_project(project_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete project")
        
        return {"message": "Project deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

@router.put("/{project_id}/status")
async def update_project_status(project_id: str, status: str, subtitle_count: int = None):
    """Update project status"""
    try:
        db = await get_database()
        # Check if project exists
        project = await db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        success = await db.update_project_status(project_id, status, subtitle_count)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update project status")
        
        return {"message": "Project status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project status {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update project status: {str(e)}")
