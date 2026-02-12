# Premiere Frame Exporter

CEP extension for Adobe Premiere Pro that automatically exports frames from a sequence as still images. Designed for multi-camera podcast setups where you need thumbnails from each camera angle.

## Features

- **Time-based export** — extract a frame every X seconds (1–60s interval)
- **Multiple output formats** — PNG, JPEG, TIFF, DPX, BMP
- **Direct export** — uses Premiere's built-in Export Frame (QE DOM), no Adobe Media Encoder needed
- Output folder created automatically next to the project file (`FrameExports_<sequence name>/`)
- Works with Premiere Pro 25.0+ (CEP 12)

## Requirements

- Adobe Premiere Pro 2025 or later (tested on 26.0 / 2026)
- Windows (installer targets `C:\Program Files\Common Files\Adobe\CEP\extensions`)
- Node.js (for the install script)

## Installation

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/mdkochanowicz/premiere-frame-exporter.git
   cd premiere-frame-exporter
   npm install
   ```

2. Enable unsigned CEP extensions — either:
   - Run `enable-debug.reg` (sets `PlayerDebugMode=1` for CSXS.11 and CSXS.12), **or**
   - Manually add the registry key `HKCU\Software\Adobe\CSXS.12` → `PlayerDebugMode` (string) = `1`

3. Install the extension (requires **Administrator** shell):

   ```bash
   node install.js
   ```

4. Restart Premiere Pro. The panel appears under **Window → Extensions → Frame Exporter**.

## Usage

1. Open a project and a sequence in Premiere Pro.
2. Open the **Frame Exporter** panel.
3. Click **Select Active Sequence** — the panel shows the sequence name and duration.
4. Choose an **output format** (PNG, JPEG, TIFF, DPX, BMP).
5. Choose a frame selection method:
   - **Time-based** — set the interval in seconds.
6. Click **Export Frames**.
7. Frames are exported directly by Premiere Pro to `FrameExports_<sequence>/` next to your `.prproj` file.

## Project Structure

```
CSXS/manifest.xml        CEP 12 extension manifest
client/index.html         Panel UI
client/main.js            UI logic + CSInterface communication
client/style.css          Panel styles
host/frameExporter.jsx    ExtendScript — sequence info, QE DOM frame export
host/CSInterface.js       Adobe CEP 12 JS library
install.js                Copies extension to system CEP folder
enable-debug.reg          Registry keys for unsigned extension loading
.debug                    Remote debugging config (Chrome DevTools on port 8088)
```

## Debugging

With the extension loaded and Premiere Pro running, open `http://localhost:8088` in Chrome to access DevTools for the panel. You can also run ExtendScript expressions in the console via `csInterface.evalScript(...)`.

## Roadmap

- [ ] Real motion/scene-change detection (pixel diff analysis)
- [ ] Face detection (different expressions)
- [ ] macOS support

## License

MIT