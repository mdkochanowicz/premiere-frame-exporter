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


// Map depth values to QE DOM depth constants
// TIFF: 0 = 8-bit int, 1 = 16-bit int, 2 = 32-bit float
// PNG:  0 = 8-bit, 1 = 16-bit
function getDepthIndex(format, depth) {
    if (format === 'tiff') {
        if (depth === '16') return 1;
        if (depth === '32') return 2;
        return 0;
    }
    if (format === 'png') {
        if (depth === '16') return 1;
        return 0;
    }
    return 0;
}


// Debug: discover QE sequence exportFrame method signatures
function debugExportFrameMethods() {
    try {
        app.enableQE();
        var qeSeq = qe.project.getActiveSequence();
        if (!qeSeq) {
            return JSON.stringify({ error: 'No active QE sequence.' });
        }

        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ error: 'No active sequence.' });
        }

        var timecode = qeSeq.CTI.timecode;
        var projectFolder = new Folder(app.project.path).parent;
        var testBase = projectFolder.fsName + '\\__debug_frame_test';

        var results = [];

        // Test TIFF with different 3rd arg types
        var tests = [
            { label: 'TIFF no 3rd arg',    fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_noarg'); } },
            { label: 'TIFF int 0',          fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_int0', 0); } },
            { label: 'TIFF int 1',          fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_int1', 1); } },
            { label: 'TIFF int 2',          fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_int2', 2); } },
            { label: 'TIFF str "0"',        fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_str0', '0'); } },
            { label: 'TIFF str "1"',        fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_str1', '1'); } },
            { label: 'TIFF str "2"',        fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_str2', '2'); } },
            { label: 'TIFF bool true',      fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_true', true); } },
            { label: 'TIFF bool false',     fn: function() { return qeSeq.exportFrameTIFF(timecode, testBase + '_tiff_false', false); } },
            { label: 'PNG no 3rd arg',      fn: function() { return qeSeq.exportFramePNG(timecode, testBase + '_png_noarg'); } },
            { label: 'PNG int 0',           fn: function() { return qeSeq.exportFramePNG(timecode, testBase + '_png_int0', 0); } },
            { label: 'PNG int 1',           fn: function() { return qeSeq.exportFramePNG(timecode, testBase + '_png_int1', 1); } },
            { label: 'PNG str "0"',         fn: function() { return qeSeq.exportFramePNG(timecode, testBase + '_png_str0', '0'); } },
            { label: 'PNG str "1"',         fn: function() { return qeSeq.exportFramePNG(timecode, testBase + '_png_str1', '1'); } }
        ];

        for (var i = 0; i < tests.length; i++) {
            try {
                var ret = tests[i].fn();
                results.push(tests[i].label + ' => OK (returned: ' + ret + ')');
            } catch (e) {
                results.push(tests[i].label + ' => ERROR: ' + e.message);
            }
        }

        // Also try to list all exportFrame* methods via reflection
        var methods = [];
        for (var key in qeSeq) {
            if (typeof key === 'string' && key.indexOf('exportFrame') === 0) {
                methods.push(key);
            }
        }
        results.push('Found exportFrame* methods: ' + (methods.length > 0 ? methods.join(', ') : 'none enumerable'));

        return JSON.stringify({ results: results });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}


// Export a single frame using the QE DOM Export Frame mechanism
function exportSingleFrame(qeSeq, timecode, outputPath, format, depth) {
    var depthIdx = getDepthIndex(format, depth);
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
        var depth = params.depth || '8';
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
            exportSingleFrame(qeSeq, timecode, framePath, format, depth);
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
