# Torgman (تُرجمان)

A tool that aims to be a central hub for any translation project anyone wants to do 👳
<center>
   <img width="842" height="614" alt="Torgman GIF" src="https://github.com/user-attachments/assets/15093291-bf4e-4f02-85be-5a7e427abd6d" />
</center>

## ⚡ How to start ?

Just, Run this single command 😅

```bash
docker run \
    -v ./data:/app/data \
    -p 8000:8000 \
    --gpus all \
    --name torgman \
    ghcr.io/tarjma/torgman:latest
```

Once the container is running, open your browser and navigate to:
**🌐 http://localhost:8000**

### 🔧 Configuration Options

You can customize the setup by modifying the Docker command:

- **📁 Data directory**: Change `./data` to your preferred storage location (You can remove this if you don't want persistent memory for your projects)
- **🌐 Port**: Change `8000:8000` to use a different port (e.g., `3000:8000`)
- **🎮 GPU**: Remove `--gpus all` if you don't have GPU support

## 📖 How to Use

### 🎬 Creating Your First Project

1. **➕ Click "Create New Project"** on the homepage
2. **📤 Choose your input method**:
   - 📹 Upload a video file (MP4, AVI, MOV, etc.)
   - *OR* 🔗 Paste a YouTube URL
3. **📝 Enter a project title** and click "Create" *OR* 🤖 Fetch Video Information automatically
4. **⏳ Wait for processing** - the app will make an initial transcription and translation using Whisper and Gemini

### ✏️ Editing Subtitles

1. **📂 Open your project** from the homepage
2. **🛠️ Use the integrated editor** to:
   - ✍️ Edit subtitle text directly
   - ⏰ Adjust timing of transcription
   - 👀 Preview changes in real-time
3. **📤 Export your subtitles** when satisfied

## 🗺️ What is the plan ?

### 🎯 Short Term
- [ ] 🛠️ A good set of tools for transcribing and translating any video to Arabic
- [ ] ♿ The ability to generate hearing impaired subtitles with ease

### 🚀 Long Term
- [ ] 🎵 Support Dubbing to Arabic
- [ ] 📚 Translate Documents (Academic books, Papers) to Arabic

## 🤝 Contributing

We welcome contributions! Here's how to help:

1. **🍴 Fork the repository**
2. **🌿 Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **✨ Make your changes** with clear, focused commits
4. **🧪 Test thoroughly** with different video types
5. **📬 Submit a pull request** with a clear description and small change

## 📄 License

This project is licensed under the GPL v3 License - see the `LICENSE` file for details.

---

**❓ Need help?** Feel free to open an issue on GitHub or check our troubleshooting guide above or join our [💬 discord](https://discord.gg/DWAFvWwsRA)
