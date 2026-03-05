// Premiere Frame Exporter - ExtendScript Host
// Exports frames from the active sequence using Premiere's built-in Export Frame (QE DOM)

var TICKS_PER_SECOND = 254016000000;

// Get information about the active sequence
function getActiveSequenceInfo() {
    try {
        var seq = app.project.activeSequence;

        if (!seq) {
            return JSON.stringify({ error: 'No active sequence. Open a sequence first.' });
        }

        var endTicks = parseFloat(seq.end);
        var ticksPerFrame = parseFloat(seq.timebase);
        var durationSeconds = endTicks / TICKS_PER_SECOND;

        var info = {
            name: seq.name,
            duration: Math.round(durationSeconds * 100) / 100,
            frameRate: Math.round(TICKS_PER_SECOND / ticksPerFrame * 100) / 100,
            width: seq.frameSizeHorizontal,
            height: seq.frameSizeVertical
        };

        return JSON.stringify(info);
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}


// Helper: zero-pad a number
function zeroPad(num, size) {
    var s = '0000' + num;
    return s.substr(s.length - size);
}


// Export a single frame using the QE DOM Export Frame mechanism
function exportSingleFrame(qeSeq, timecode, outputPath, format) {
    switch (format) {
        case 'bmp':     return qeSeq.exportFrameBMP(timecode, outputPath);
        case 'dpx':     return qeSeq.exportFrameDPX(timecode, outputPath);
        case 'gif':     return qeSeq.exportFrameGIF(timecode, outputPath);
        case 'jpeg':    return qeSeq.exportFrameJPEG(timecode, outputPath);
        case 'openexr': return qeSeq.exportFrameOpenEXR(timecode, outputPath);
        case 'png':     return qeSeq.exportFramePNG(timecode, outputPath);
        case 'targa':   return qeSeq.exportFrameTarga(timecode, outputPath);
        case 'tiff':    return qeSeq.exportFrameTIFF(timecode, outputPath);
        default:        return qeSeq.exportFramePNG(timecode, outputPath);
    }
}


// Collect edit/cut points from all video tracks in the active sequence
// Returns an array of timestamps (in seconds) where cuts occur
function collectEditPoints(seq, sensitivity) {
    var editPoints = [];
    var ticksPerFrame = parseFloat(seq.timebase);

    // Sensitivity controls minimum clip duration to consider (in seconds)
    // 1 = only major cuts (clips > 10s), 10 = every single cut
    var minClipDuration;
    if (sensitivity <= 2) {
        minClipDuration = 10;
    } else if (sensitivity <= 4) {
        minClipDuration = 5;
    } else if (sensitivity <= 6) {
        minClipDuration = 2;
    } else if (sensitivity <= 8) {
        minClipDuration = 0.5;
    } else {
        minClipDuration = 0; // all cuts
    }

    // Scan all video tracks for clip boundaries
    for (var t = 0; t < seq.videoTracks.numTracks; t++) {
        var track = seq.videoTracks[t];
        if (track.clips.numItems === 0) continue;

        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            var clipStartTicks = parseFloat(clip.start.ticks);
            var clipEndTicks = parseFloat(clip.end.ticks);
            var clipDurationSec = (clipEndTicks - clipStartTicks) / TICKS_PER_SECOND;

            // Filter out clips shorter than the minimum duration
            if (clipDurationSec < minClipDuration) continue;

            // Add the start of each clip as an edit point
            // Offset by a few frames into the clip to avoid transition frames
            var offsetTicks = ticksPerFrame * 3; // 3 frames in
            var pointTicks = clipStartTicks + offsetTicks;
            var pointSeconds = pointTicks / TICKS_PER_SECOND;

            editPoints.push(pointSeconds);

            // For longer clips (>30s), also add a mid-point sample
            if (clipDurationSec > 30) {
                var midSeconds = (clipStartTicks + clipEndTicks) / 2 / TICKS_PER_SECOND;
                editPoints.push(midSeconds);
            }
        }
    }

    // Sort and deduplicate (remove points within 1 second of each other)
    editPoints.sort(function(a, b) { return a - b; });

    var deduplicated = [];
    for (var i = 0; i < editPoints.length; i++) {
        if (deduplicated.length === 0 || (editPoints[i] - deduplicated[deduplicated.length - 1]) > 1.0) {
            deduplicated.push(editPoints[i]);
        }
    }

    // Always include the very first frame if not already present
    if (deduplicated.length === 0 || deduplicated[0] > 1.0) {
        deduplicated.unshift(0.1);
    }

    return deduplicated;
}


// Get edit point count for UI preview (so user knows how many frames will be exported)
function getEditPointCount(sensitivityStr) {
    try {
        var sensitivity = parseInt(sensitivityStr, 10) || 5;
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ error: 'No active sequence.' });
        }
        var points = collectEditPoints(seq, sensitivity);
        return JSON.stringify({ count: points.length });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}


// Collect sequence marker positions (in seconds)
function collectMarkerPoints(seq) {
    var points = [];
    var markers = seq.markers;

    if (markers && markers.numMarkers > 0) {
        var marker = markers.getFirstMarker();
        while (marker) {
            var markerTicks = parseFloat(marker.start.ticks);
            var markerSeconds = markerTicks / TICKS_PER_SECOND;
            points.push(markerSeconds);

            marker = markers.getNextMarker(marker);
        }
    }

    points.sort(function(a, b) { return a - b; });
    return points;
}


// Export frames from the active sequence
function exportFrames(paramsJSON) {
    try {
        var params = JSON.parse(paramsJSON);
        var seq = app.project.activeSequence;

        if (!seq) {
            return JSON.stringify({ error: 'No active sequence.' });
        }

        // Enable QE DOM (required for Export Frame methods)
        app.enableQE();
        var qeSeq = qe.project.getActiveSequence();

        if (!qeSeq) {
            return JSON.stringify({ error: 'Could not access QE sequence. Make sure a sequence is open.' });
        }

        var format = params.format || 'png';
        var method = params.method;
        var interval = params.interval;
        var sensitivity = params.sensitivity || 5;
        var strategy = params.strategy || 'cuts';

        var endTicks = parseFloat(seq.end);
        var ticksPerFrame = parseFloat(seq.timebase);
        var durationSeconds = endTicks / TICKS_PER_SECOND;

        // Determine output folder
        var outputFolder;
        if (params.outputPath && params.outputPath !== '') {
            outputFolder = new Folder(params.outputPath);
        } else {
            // Default: next to project file
            var projectPath = app.project.path;
            var projectFolder = new Folder(projectPath).parent;
            var safeName = seq.name.replace(/[\/\\:*?"<>|]/g, '_');
            outputFolder = new Folder(projectFolder.fsName + '/FrameExports_' + safeName);
        }

        if (!outputFolder.exists) {
            var created = outputFolder.create();
            if (!created) {
                return JSON.stringify({ error: 'Could not create output folder: ' + outputFolder.fsName });
            }
        }

        // Calculate timestamps (in seconds) based on method
        var timestamps = [];

        if (method === 'time') {
            for (var i = 0; i < durationSeconds; i += interval) {
                timestamps.push(i);
            }
        } else if (method === 'motion') {
            if (strategy === 'cuts') {
                // Cut/Edit Detection — scan timeline for clip boundaries
                timestamps = collectEditPoints(seq, sensitivity);
            } else if (strategy === 'markers') {
                // Marker-based — export at sequence marker positions
                timestamps = collectMarkerPoints(seq);
                if (timestamps.length === 0) {
                    return JSON.stringify({ error: 'No markers found in the sequence. Add markers first or use Cut Detection.' });
                }
            }
        }

        if (timestamps.length === 0) {
            return JSON.stringify({ error: 'No frames to export. Check that the sequence has clips on video tracks.' });
        }

        // Clamp timestamps to sequence duration
        var validTimestamps = [];
        for (var v = 0; v < timestamps.length; v++) {
            if (timestamps[v] >= 0 && timestamps[v] < durationSeconds) {
                validTimestamps.push(timestamps[v]);
            }
        }
        timestamps = validTimestamps;

        if (timestamps.length === 0) {
            return JSON.stringify({ error: 'No valid frames to export within sequence duration.' });
        }

        // Export each frame using QE DOM Export Frame
        var exportedCount = 0;

        for (var t = 0; t < timestamps.length; t++) {
            var timeSeconds = timestamps[t];

            // Move the playhead (CTI) to the target time
            var ticks = String(Math.round(timeSeconds * TICKS_PER_SECOND));
            seq.setPlayerPosition(ticks);

            // Get the timecode string from QE (used by exportFrame methods)
            var timecode = qeSeq.CTI.timecode;

            // Build output path (QE exportFrame methods append the file extension automatically)
            var frameName = 'frame_' + zeroPad(t + 1, 4);
            var framePath = outputFolder.fsName + '\\' + frameName;

            // Export the frame
            exportSingleFrame(qeSeq, timecode, framePath, format);
            exportedCount++;
        }

        return JSON.stringify({
            count: exportedCount,
            path: outputFolder.fsName
        });

    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}
