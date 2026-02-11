// Premiere Frame Exporter - ExtendScript Host
// Exports frames from the active sequence as PNG images

// Get information about the active sequence
function getActiveSequenceInfo() {
    try {
        var seq = app.project.activeSequence;

        if (!seq) {
            return JSON.stringify({ error: 'No active sequence. Open a sequence first.' });
        }

        // seq.end and seq.timebase are strings representing ticks
        var endTicks = parseFloat(seq.end);
        var ticksPerFrame = parseFloat(seq.timebase);
        var durationSeconds = endTicks / 254016000000;  // ticks per second constant

        var info = {
            name: seq.name,
            duration: Math.round(durationSeconds * 100) / 100,
            frameRate: Math.round(254016000000 / ticksPerFrame * 100) / 100,
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


// Find a PNG Still Image export preset (.epr file)
function findPNGPreset() {
    // Common preset locations on Windows
    var presetPaths = [
        // Premiere Pro 2025/2026 presets
        '/c/Program Files/Adobe/Adobe Premiere Pro 2025/MediaIO/systempresets/4D504547_PNG Still Image/',
        '/c/Program Files/Adobe/Adobe Premiere Pro 2026/MediaIO/systempresets/4D504547_PNG Still Image/',
        // Generic search
        '/c/Program Files/Adobe/'
    ];

    // Try to find PNG preset in standard locations
    var possibleNames = [
        'HDTV 1080p 29.97.epr',
        'Match Source.epr',
        'Source - Match Source.epr',
        'HDTV 1080p.epr'
    ];

    // Search in common Premiere Pro preset directories
    var adobeFolder = new Folder('C:/Program Files/Adobe');
    if (adobeFolder.exists) {
        var subfolders = adobeFolder.getFiles();
        for (var i = 0; i < subfolders.length; i++) {
            if (subfolders[i] instanceof Folder && subfolders[i].name.indexOf('Premiere Pro') >= 0) {
                // Look for PNG Still Image presets
                var pngPresetFolder = new Folder(subfolders[i].fsName + '/MediaIO/systempresets/');
                if (pngPresetFolder.exists) {
                    var presetFolders = pngPresetFolder.getFiles();
                    for (var j = 0; j < presetFolders.length; j++) {
                        if (presetFolders[j] instanceof Folder && presetFolders[j].name.indexOf('PNG') >= 0) {
                            var eprFiles = presetFolders[j].getFiles('*.epr');
                            if (eprFiles.length > 0) {
                                return eprFiles[0].fsName;
                            }
                        }
                    }
                }
            }
        }
    }

    return null;
}


// Export frames from the active sequence
function exportFrames(paramsJSON) {
    try {
        var params = JSON.parse(paramsJSON);
        var seq = app.project.activeSequence;

        if (!seq) {
            return JSON.stringify({ error: 'No active sequence.' });
        }

        var method = params.method;
        var interval = params.interval;
        var sensitivity = params.sensitivity;

        // Ticks per second constant (Premiere Pro uses 254016000000 ticks/sec)
        var TICKS_PER_SECOND = 254016000000;

        var endTicks = parseFloat(seq.end);
        var ticksPerFrame = parseFloat(seq.timebase);
        var durationSeconds = endTicks / TICKS_PER_SECOND;

        // Create output folder next to project file
        var projectPath = app.project.path;
        var projectFolder = new Folder(projectPath).parent;

        // Clean sequence name for folder
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

        // Find PNG preset
        var presetPath = findPNGPreset();

        if (!presetPath) {
            return JSON.stringify({ error: 'PNG export preset not found. Check Premiere Pro installation.' });
        }

        // Launch Adobe Media Encoder
        app.encoder.launchEncoder();

        // Queue each frame for export via AME
        var exportedCount = 0;

        for (var t = 0; t < timestamps.length; t++) {
            var timeSeconds = timestamps[t];

            // Set in and out points to a single frame
            seq.setInPoint(timeSeconds);
            seq.setOutPoint(timeSeconds + (ticksPerFrame / TICKS_PER_SECOND));

            var frameName = 'frame_' + zeroPad(t + 1, 4) + '.png';
            var framePath = outputFolder.fsName + '/' + frameName;

            // Queue the single-frame render via AME
            // workArea = 1 means ENCODE_IN_TO_OUT
            var jobID = app.encoder.encodeSequence(
                seq,
                framePath,
                presetPath,
                1,  // ENCODE_IN_TO_OUT
                1   // removeUponCompletion
            );

            if (jobID && jobID !== '0') {
                exportedCount++;
            }
        }

        // Start the batch render
        app.encoder.startBatch();

        // Return result
        var result = {
            count: exportedCount,
            path: outputFolder.fsName
        };

        return JSON.stringify(result);

    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}
