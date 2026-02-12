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
// format: 'png', 'jpeg', 'tiff', 'dpx', 'bmp'
function exportSingleFrame(qeSeq, timecode, outputPath, format) {
    switch (format) {
        case 'png':   return qeSeq.exportFramePNG(timecode, outputPath);
        case 'jpeg':  return qeSeq.exportFrameJPEG(timecode, outputPath);
        case 'tiff':  return qeSeq.exportFrameTIFF(timecode, outputPath);
        case 'dpx':   return qeSeq.exportFrameDPX(timecode, outputPath);
        case 'bmp':   return qeSeq.exportFrameBMP(timecode, outputPath);
        default:      return qeSeq.exportFramePNG(timecode, outputPath);
    }
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
        var sensitivity = params.sensitivity;

        var endTicks = parseFloat(seq.end);
        var ticksPerFrame = parseFloat(seq.timebase);
        var durationSeconds = endTicks / TICKS_PER_SECOND;

        // Create output folder next to project file
        var projectPath = app.project.path;
        var projectFolder = new Folder(projectPath).parent;

        var safeName = seq.name.replace(/[\/\\:*?"<>|]/g, '_');
        var outputFolder = new Folder(projectFolder.fsName + '/FrameExports_' + safeName);

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
            // Motion detection placeholder - adjust interval by sensitivity
            var adjustedInterval = Math.max(0.5, interval / (sensitivity / 5));
            for (var i = 0; i < durationSeconds; i += adjustedInterval) {
                timestamps.push(i);
            }
        }

        if (timestamps.length === 0) {
            return JSON.stringify({ error: 'No frames to export (sequence too short or interval too large).' });
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
