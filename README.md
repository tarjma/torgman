# Torgman (ترجمان)

A simple yet powerful application for generating and editing Arabic subtitles for video content. Transform your videos with accurate transcription and AI-powered Arabic translation.

## What It Does

Torgman helps you create professional Arabic subtitles by:
- **Automatically transcribing** video audio using OpenAI Whisper
- **Translating subtitles** to Arabic using AI (Gemini 2.5 Flash)
- **Processing YouTube videos** directly from URLs
- **Providing an intuitive editor** for subtitle refinement
- **Exporting subtitles** in multiple formats (SRT, VTT, etc.)

## Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd torgman
   ```

2. **Set up environment variables**
   ```bash
   # Create .env file with your API key
   echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
   ```

3. **Run with Docker**
   ```bash
   docker build -t torgman .
   docker run --env-file .env -v ./data:/app/data -p 8000:8000 --gpus all --name torgman torgman
   ```

4. **Open your browser** and go to `http://localhost:8000`

## How to Use

### Creating Your First Project

1. **Click "Create New Project"** on the homepage
2. **Choose your input method**:
   - Upload a video file (MP4, AVI, MOV, etc.)
   - *OR* Paste a YouTube URL
3. **Enter a project title** and click "Create" *OR* Fetch Video Information automatically
4. **Wait for processing** - the app will make an initial transcription and translation using Whisper and Gemini

### Editing Subtitles

1. **Open your project** from the homepage
2. **Use the integrated editor** to:
   - Edit subtitle text directly
   - Adjust timing of transcription
   - Preview changes in real-time
3. **Export your subtitles** when satisfied

### Keyboard Shortcuts

- `Space` - Play/Pause video
- `←/→` - Navigate between subtitles
- `Enter` - Edit selected subtitle
- `Esc` - Exit edit mode

## Features

### Core Functionality
- **Multi-format video support** (MP4, AVI, MOV, WebM)
- **YouTube video processing** with automatic download
- **High-quality transcription** using Whisper Turbo model
- **AI-powered Arabic translation** with context awareness
- **Real-time subtitle editing** with instant preview
- **Multiple export formats** (SRT, VTT)

### Technical Features
- **WebSocket-based real-time updates** during processing
- **Project management** with metadata persistence
- **Thumbnail generation** for easy project identification
- **SQLite database** for reliable data storage
- **Responsive web interface** with Arabic RTL support

## Configuration

### AI Translation Settings

The app uses Google's Gemini 2.5 Flash model by default. To customize:

1. **Edit translation service** in `backend/app/services/translation_service.py`
2. **Modify subtitle formatting** in `data/config/subtitle-config.json`
3. **Adjust transcription parameters** in the transcription service

### Subtitle Formatting

Default settings follow Netflix standards:
- **Maximum 42 characters per line**
- **Maximum 2 lines per caption**
- **Maximum 7 seconds duration**
- **21 characters per second reading speed**

## API Endpoints

The backend provides a RESTful API:

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/{id}` - Get project details
- `DELETE /api/projects/{id}` - Delete project
- `POST /api/youtube/info` - Get YouTube video info
- `WebSocket /ws` - Real-time updates

## System Requirements

### Minimum Requirements
- **RAM**: 4GB (8GB recommended for large videos)
- **Storage**: 2GB free space
- **Python**: 3.11 or higher
- **Node.js**: 18 or higher

### Dependencies
- **FFmpeg** (for video processing)
- **OpenAI Whisper** (for transcription)
- **spaCy** (for text processing)
- **yt-dlp** (for YouTube downloads)

### Performance Tips

- **Use Whisper 'base' model** for faster processing on slower machines
- **Process shorter videos** (under 30 minutes) for optimal performance
- **Close other applications** during video processing to free up RAM

## Contributing

We welcome contributions! Here's how to help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** with clear, focused commits
4. **Test thoroughly** with different video types
5. **Submit a pull request** with a clear description and small change

## License

This project is licensed under the GPL v3 License - see the `LICENSE` file for details.

## Acknowledgments

- **OpenAI Whisper** for exceptional speech recognition
- **Google Gemini** for high-quality Arabic translation
- **yt-dlp** community for YouTube processing capabilities
- **spaCy** team for natural language processing tools

---

**Need help?** Feel free to open an issue on GitHub or check our troubleshooting guide above or join our [discord](https://discord.gg/DWAFvWwsRA)
