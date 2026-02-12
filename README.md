# Premiere Frame Exporter

CEP extension for Adobe Premiere Pro that automatically exports frames from a sequence as PNG images. Designed for multi-camera podcast setups where you need thumbnails from each camera angle.

## Features

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
4. Choose a frame selection method:
   - **Time-based** — set the interval in seconds.
5. Click **Export Frames**.
6. Frames are queued in Adobe Media Encoder and rendered as PNGs to `FrameExports_<sequence>/` next to your `.prproj` file.

## Project Structure

```
CSXS/manifest.xml        CEP 12 extension manifest
client/index.html         Panel UI
client/main.js            UI logic + CSInterface communication
client/style.css          Panel styles
host/frameExporter.jsx    ExtendScript — sequence info, preset discovery, AME export
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
- [ ] Custom output format (JPEG, TIFF)

## License

MIT