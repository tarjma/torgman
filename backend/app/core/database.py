import aiosqlite
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging

from .config import settings
from ..models.project import ProjectData, SubtitleData

logger = logging.getLogger(__name__)

class Database:
    """Database manager for Torgman application"""
    
    def __init__(self, db_path: Path = None):
        self.db_path = db_path or settings.database_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
    
    async def get_connection(self):
        """Get async SQLite database connection"""
        return await aiosqlite.connect(str(self.db_path))
    
    async def create_tables(self):
        """Initialize database with required tables"""
        async with self.get_connection() as db:
            # Projects table
            await db.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    youtube_url TEXT,
                    duration REAL,
                    status TEXT DEFAULT 'draft',
                    language TEXT DEFAULT 'ar',
                    subtitle_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Subtitles table
            await db.execute("""
                CREATE TABLE IF NOT EXISTS subtitles (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    start_time REAL NOT NULL,
                    end_time REAL NOT NULL,
                    text TEXT NOT NULL,
                    speaker_id TEXT,
                    confidence REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects (id)
                )
            """)
            
            await db.commit()
            logger.info("Database tables created successfully")
    
    async def create_project(self, project_data: Dict[str, Any]) -> bool:
        """Create a new project"""
        try:
            async with self.get_connection() as db:
                await db.execute("""
                    INSERT INTO projects (id, title, description, youtube_url, duration, status, language)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    project_data["id"],
                    project_data["title"],
                    project_data.get("description"),
                    project_data.get("youtube_url"),
                    project_data.get("duration", 0),
                    project_data.get("status", "draft"),
                    project_data.get("language", "ar")
                ))
                await db.commit()
                logger.info(f"Project {project_data['id']} created successfully")
                return True
        except Exception as e:
            logger.error(f"Error creating project: {e}")
            return False
    
    async def get_project(self, project_id: str) -> Optional[ProjectData]:
        """Get a project by ID"""
        try:
            async with self.get_connection() as db:
                async with db.execute(
                    "SELECT * FROM projects WHERE id = ?", (project_id,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        columns = [description[0] for description in cursor.description]
                        project_dict = dict(zip(columns, row))
                        return ProjectData(**project_dict)
                    return None
        except Exception as e:
            logger.error(f"Error getting project {project_id}: {e}")
            return None
    
    async def update_project_status(self, project_id: str, status: str, subtitle_count: int = None) -> bool:
        """Update project status and subtitle count"""
        try:
            async with self.get_connection() as db:
                if subtitle_count is not None:
                    await db.execute(
                        "UPDATE projects SET status = ?, subtitle_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (status, subtitle_count, project_id)
                    )
                else:
                    await db.execute(
                        "UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (status, project_id)
                    )
                await db.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating project status: {e}")
            return False
    
    async def save_subtitles(self, project_id: str, subtitles: List[Dict[str, Any]]) -> bool:
        """Save subtitles for a project"""
        try:
            async with self.get_connection() as db:
                # Clear existing subtitles
                await db.execute("DELETE FROM subtitles WHERE project_id = ?", (project_id,))
                
                # Insert new subtitles
                for subtitle in subtitles:
                    await db.execute("""
                        INSERT INTO subtitles (id, project_id, start_time, end_time, text, speaker_id, confidence)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        subtitle["id"],
                        project_id,
                        subtitle["start_time"],
                        subtitle["end_time"],
                        subtitle["text"],
                        subtitle.get("speaker_id"),
                        subtitle.get("confidence")
                    ))
                
                # Update project subtitle count
                await self.update_project_status(project_id, "completed", len(subtitles))
                
                await db.commit()
                logger.info(f"Saved {len(subtitles)} subtitles for project {project_id}")
                return True
        except Exception as e:
            logger.error(f"Error saving subtitles: {e}")
            return False
    
    async def get_project_subtitles(self, project_id: str) -> List[SubtitleData]:
        """Get subtitles for a project"""
        try:
            async with self.get_connection() as db:
                async with db.execute(
                    "SELECT * FROM subtitles WHERE project_id = ? ORDER BY start_time",
                    (project_id,)
                ) as cursor:
                    rows = await cursor.fetchall()
                    columns = [description[0] for description in cursor.description]
                    return [
                        SubtitleData(**dict(zip(columns, row)))
                        for row in rows
                    ]
        except Exception as e:
            logger.error(f"Error getting subtitles for project {project_id}: {e}")
            return []
    
    async def list_projects(self, limit: int = 50, offset: int = 0) -> List[ProjectData]:
        """List all projects with pagination"""
        try:
            async with self.get_connection() as db:
                async with db.execute(
                    "SELECT * FROM projects ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    (limit, offset)
                ) as cursor:
                    rows = await cursor.fetchall()
                    columns = [description[0] for description in cursor.description]
                    return [
                        ProjectData(**dict(zip(columns, row)))
                        for row in rows
                    ]
        except Exception as e:
            logger.error(f"Error listing projects: {e}")
            return []
    
    async def delete_project(self, project_id: str) -> bool:
        """Delete a project and its subtitles"""
        try:
            async with self.get_connection() as db:
                # Delete subtitles first (foreign key constraint)
                await db.execute("DELETE FROM subtitles WHERE project_id = ?", (project_id,))
                # Delete project
                await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
                await db.commit()
                logger.info(f"Project {project_id} deleted successfully")
                return True
        except Exception as e:
            logger.error(f"Error deleting project {project_id}: {e}")
            return False

# Global database instance
_database = None

async def get_database() -> Database:
    """Get the global database instance"""
    global _database
    if _database is None:
        _database = Database()
        await _database.create_tables()
    return _database
