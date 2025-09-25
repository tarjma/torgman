import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from ..core.config import settings
from ..models.project import ProjectData, CaptionData

logger = logging.getLogger(__name__)


class ProjectManager:
    """File-based project manager for Torgman application"""
    
    def __init__(self):
        self.projects_dir = settings.projects_dir
        self.projects_dir.mkdir(parents=True, exist_ok=True)
    
    def list_projects(self, limit: int = 50, offset: int = 0) -> List[ProjectData]:
        """List all projects with pagination by scanning project directories"""
        try:
            project_dirs = []
            
            # Get all project directories
            for project_dir in self.projects_dir.iterdir():
                if project_dir.is_dir() and project_dir.name.startswith('project_'):
                    metadata_path = project_dir / "metadata.json"
                    if metadata_path.exists():
                        project_dirs.append(project_dir)
            
            # Sort by creation time (newest first)
            project_dirs.sort(key=lambda d: d.stat().st_ctime, reverse=True)
            
            # Apply pagination
            paginated_dirs = project_dirs[offset:offset + limit]
            
            projects = []
            for project_dir in paginated_dirs:
                try:
                    project = self._load_project_from_dir(project_dir)
                    if project:
                        projects.append(project)
                except Exception as e:
                    logger.error(f"Error loading project from {project_dir}: {e}")
                    continue
            
            return projects
        except Exception as e:
            logger.error(f"Error listing projects: {e}")
            return []
    
    def get_project(self, project_id: str) -> Optional[ProjectData]:
        """Get a project by ID"""
        try:
            project_dir = settings.get_project_dir(project_id)
            if not project_dir.exists():
                return None
            
            return self._load_project_from_dir(project_dir)
        except Exception as e:
            logger.error(f"Error getting project {project_id}: {e}")
            return None
    
    def create_project(self, project_data: Dict[str, Any]) -> bool:
        """Create a new project"""
        try:
            project_id = project_data["id"]
            project_dir = settings.get_project_dir(project_id)
            project_dir.mkdir(parents=True, exist_ok=True)
            
            # Create enhanced metadata with all required fields
            metadata = {
                "project_id": project_id,
                "title": project_data.get("title", "Untitled"),
                "description": project_data.get("description", ""),
                "video_title": project_data.get("video_title", project_data.get("title", "Untitled")),
                "youtube_url": project_data.get("youtube_url", ""),
                "video_url": project_data.get("video_url", project_data.get("youtube_url", "")),
                "duration": project_data.get("duration", 0.0),
                "resolution": project_data.get("resolution", "720p"),
                "status": project_data.get("status", "draft"),
                # Store explicit source language (fallback to provided 'language' for backward compatibility)
                "source_language": project_data.get("source_language", project_data.get("language", "en")),
                "subtitle_count": project_data.get("subtitle_count", 0),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "video_file": project_data.get("video_file", ""),
                "audio_file": project_data.get("audio_file", ""),
                "thumbnail_file": project_data.get("thumbnail_file", ""),
                "user_id": project_data.get("user_id", "default_user")
            }
            
            metadata_path = project_dir / "metadata.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Project {project_id} created successfully")
            return True
        except Exception as e:
            logger.error(f"Error creating project: {e}")
            return False
    
    def update_project_status(self, project_id: str, status: str, subtitle_count: int = None) -> bool:
        """Update project status and subtitle count"""
        try:
            project_dir = settings.get_project_dir(project_id)
            metadata_path = project_dir / "metadata.json"
            
            if not metadata_path.exists():
                logger.error(f"Metadata file not found for project {project_id}")
                return False
            
            # Load existing metadata
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # Update fields
            metadata["status"] = status
            metadata["updated_at"] = datetime.now().isoformat()
            
            if subtitle_count is not None:
                metadata["subtitle_count"] = subtitle_count
            
            # Save updated metadata
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Project {project_id} status updated to {status}")
            return True
        except Exception as e:
            logger.error(f"Error updating project status: {e}")
            return False
    
    def update_project_metadata(self, project_id: str, **kwargs) -> bool:
        """Update project metadata with arbitrary fields"""
        try:
            project_dir = settings.get_project_dir(project_id)
            metadata_path = project_dir / "metadata.json"
            
            if not metadata_path.exists():
                logger.error(f"Metadata file not found for project {project_id}")
                return False
            
            # Load existing metadata
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # Update fields
            metadata.update(kwargs)
            metadata["updated_at"] = datetime.now().isoformat()
            
            # Save updated metadata
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Project {project_id} metadata updated")
            return True
        except Exception as e:
            logger.error(f"Error updating project metadata: {e}")
            return False
    
    def delete_project(self, project_id: str) -> bool:
        """Delete a project and its associated files"""
        try:
            project_dir = settings.get_project_dir(project_id)
            
            if not project_dir.exists():
                logger.warning(f"Project directory not found: {project_dir}")
                return False
            
            # Remove the entire project directory
            shutil.rmtree(project_dir)
            logger.info(f"Project {project_id} deleted successfully")
            return True
        except Exception as e:
            logger.error(f"Error deleting project {project_id}: {e}")
            return False
    
    def get_project_subtitles(self, project_id: str) -> List[CaptionData]:
        """Get subtitles for a project"""
        try:
            project_dir = settings.get_project_dir(project_id)
            subtitles_path = project_dir / "subtitles.json"
            
            if not subtitles_path.exists():
                return []
            
            with open(subtitles_path, 'r', encoding='utf-8') as f:
                subtitles_data = json.load(f)
            
            subtitles = []
            for subtitle in subtitles_data:
                # Handle both old and new field names for backward compatibility
                start_time = subtitle.get("start_time", subtitle.get("start", 0))
                end_time = subtitle.get("end_time", subtitle.get("end", 0))
                subtitles.append(CaptionData(
                    start_time=start_time,
                    end_time=end_time,
                    text=subtitle["text"],
                    confidence=subtitle.get("confidence"),
                    translation=subtitle.get("translation")
                ))
            
            return subtitles
        except Exception as e:
            logger.error(f"Error getting subtitles for project {project_id}: {e}")
            return []
    
    def _load_project_from_dir(self, project_dir: Path) -> Optional[ProjectData]:
        """Load project data from a project directory"""
        try:
            metadata_path = project_dir / "metadata.json"
            
            if not metadata_path.exists():
                return None
            
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # Convert to ProjectData model with fallbacks for missing fields
            return ProjectData(
                id=metadata.get("project_id", project_dir.name),
                title=metadata.get("title", metadata.get("video_title", "Untitled")),
                description=metadata.get("description", ""),
                youtube_url=metadata.get("youtube_url", metadata.get("video_url", "")),
                duration=float(metadata.get("duration", 0.0)),
                status=metadata.get("status", "draft"),
                # Backward compatibility: accept either source_language or legacy language key
                source_language=metadata.get("source_language", metadata.get("language", "en")),
                subtitle_count=int(metadata.get("subtitle_count", 0)),
                created_at=datetime.fromisoformat(metadata["created_at"]) if metadata.get("created_at") else None,
                updated_at=datetime.fromisoformat(metadata["updated_at"]) if metadata.get("updated_at") else None
            )
        except Exception as e:
            logger.error(f"Error loading project from {project_dir}: {e}")
            return None


# Global project manager instance
_project_manager = None

def get_project_manager() -> ProjectManager:
    """Get the global project manager instance"""
    global _project_manager
    if _project_manager is None:
        _project_manager = ProjectManager()
    return _project_manager
