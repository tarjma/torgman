## This project is to be archived because the maintainers believe there is better way to do automatic translation now (Agentic Media Translation) 
---
# Torgman (تُرجمان)

A central hub for translation into Arabic powered by different AI tools.

<p align="center">
  <img width="842" alt="Torgman Demo" src="https://github.com/user-attachments/assets/c10a7288-6988-4ec0-93a6-aa3c5e432913" />
</p>

## Quick Start

```bash
docker run -v ./data:/app/data -p 8000:8000 --gpus all --name torgman ghcr.io/tarjma/torgman:latest
```

Open **http://localhost:8000** in your browser.

| Option | Default | Description |
|--------|---------|-------------|
| `-v ./data:/app/data` | Required | Persistent storage for projects |
| `-p 8000:8000` | 8000 | Web interface port |
| `--gpus all` | Optional | GPU acceleration (remove if no GPU) |

## Features

- 🎬 **Upload videos** or paste YouTube URLs
- 🗣️ **Auto-transcription** using Whisper
- 🌍 **Arabic translation** using Gemini AI
- ✏️ **Real-time editor** with subtitle timing adjustment
- 📤 **Export** to SRT, ASS, or burned-in video

## Usage

1. Create a new project (upload video or paste YouTube URL)
2. Wait for automatic transcription
3. Generate captions and translate to Arabic
4. Edit subtitles in the integrated editor
5. Export when satisfied

## Roadmap

- [ ] Hearing-impaired subtitle generation
- [ ] Arabic dubbing support
- [ ] Document translation (books, papers)

## Contributing

1. Fork → 2. Branch → 3. Commit → 4. PR

## License

GPL v3 — see [LICENSE](LICENSE)

## Disclaimer

> ⚠️ A significant portion of this project was "vibe coded" with AI assistance. While it works, expect some rough edges and unconventional patterns. Contributions to improve code quality are welcome!

---

[Discord](https://discord.gg/DWAFvWwsRA) • [Issues](https://github.com/tarjma/torgman/issues)
