# Premiere Frame Exporter

CEP extension for Adobe Premiere Pro that automatically exports frames from a sequence as still images. Designed for multi-camera podcast setups where you need thumbnails from each camera angle.

## Features

- **Time-based export** — extract a frame every X seconds (1–60s interval)
- **Cut Detection** — automatically finds edit points (clip boundaries) on the timeline — ideal for multi-camera podcasts where each cut = speaker switch
- **Marker-based export** — exports frames at sequence marker positions
- **Face Detection** *(in development)* — uses face-api.js to detect speaker changes by analyzing faces in sampled frames (3-pass: sampling → analysis → export)
- **Multiple output formats** — PNG, JPEG, TIFF, BMP, DPX, GIF, OpenEXR, Targa
- **Direct export** — uses Premiere's built-in Export Frame (QE DOM), no Adobe Media Encoder needed
- **Custom output folder** — browse for any folder, or auto-create next to the project file
- **Sensitivity control** — adjustable for both cut detection (min clip duration) and face detection (change threshold)
- **Progress tracking** — color-coded progress bar for multi-pass operations
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
   - **Motion Detection → Cut Detection** — detects edit points on the timeline. Adjust sensitivity to filter by minimum clip duration.
   - **Motion Detection → Markers** — exports at sequence marker positions.
   - **Face Detection** *(experimental)* — analyzes sampled frames for face changes. A 3-pass process: sampling → face analysis → final export. Progress bar shows each phase.
6. Optionally pick a custom **Output Folder** with the Browse button.
7. Click **Export Frames**.
8. Frames are exported directly by Premiere Pro to the output folder.

## Project Structure

```
CSXS/manifest.xml        CEP 12 extension manifest
client/index.html         Panel UI
client/main.js            UI logic + CSInterface communication
client/style.css          Panel styles
client/faceAnalyzer.js    Face detection analysis module (uses face-api.js)
client/vendor/            face-api.min.js library
client/models/            TinyFaceDetector model weights (~190KB)
host/frameExporter.jsx    ExtendScript — sequence info, QE DOM frame export,
                          cut detection, sampling, marker export
host/CSInterface.js       Adobe CEP 12 JS library
host/folderPicker.ps1     PowerShell folder browser dialog
install.js                Copies extension to system CEP folder
enable-debug.reg          Registry keys for unsigned extension loading
.debug                    Remote debugging config (Chrome DevTools on port 8088)
```

## Debugging

With the extension loaded and Premiere Pro running, open `http://localhost:8088` in Chrome to access DevTools for the panel. You can also run ExtendScript expressions in the console via `csInterface.evalScript(...)`.

## Roadmap

- [x] Time-based frame export
- [x] Cut/edit point detection (timeline analysis)
- [x] Marker-based export
- [ ] Face detection — improve accuracy and test on longer sequences
- [ ] Batch processing (multiple sequences)
- [ ] macOS support

## License

MIT