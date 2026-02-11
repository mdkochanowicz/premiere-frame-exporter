// Check if we're running in Premiere Pro
if (typeof app === 'undefined') {
    alert('This script must be run from Adobe Premiere Pro');
}

// Get information about the active sequence
function getActiveSequenceInfo() {
    try {
        var activeSequence = app.project.activeSequence;
        
        if (!activeSequence) {
            return null;
        }
        
        var info = {
            name: activeSequence.name,
            duration: activeSequence.end / app.project.activeSequence.timebase
        };
        
        return JSON.stringify(info);
    } catch (e) {
        return null;
    }
}


// Export frames from the active sequence
function exportFrames(paramsJSON) {
    try {
        var params = JSON.parse(paramsJSON);
        var activeSequence = app.project.activeSequence;
        
        if (!activeSequence) {
            return 'error';
        }
        
        var method = params.method;
        var interval = params.interval;
        var sensitivity = params.sensitivity;

        // Create output folder
        var projectPath = app.project.path;
        var projectFolder = new Folder(projectPath).parent;
        var outputFolder = new Folder(projectFolder.fsName + '/FrameExports_' + activeSequence.name);
        
        if (!outputFolder.exists) {
            outputFolder.create();
        }

        // Calculate timestamps based on method
        var timestamps = [];
        var duration = activeSequence.end / activeSequence.timebase;
        
        if (method === 'time') {
            // Time-based: every X seconds
            for (var i = 0; i < duration; i += interval) {
                timestamps.push(i);
            }
        } else if (method === 'motion') {
            // Motion detection: placeholder for now
            // For MVP, we'll use time-based with sensitivity affecting interval
            var adjustedInterval = Math.max(1, interval / (sensitivity / 5));
            for (var i = 0; i < duration; i += adjustedInterval) {
                timestamps.push(i);
            }
        }

        // Export each frame
        var exportedCount = 0;
        
        for (var t = 0; t < timestamps.length; t++) {
            var time = timestamps[t];
            
            // Set playhead to this time
            var timeInTicks = time * activeSequence.timebase;
            activeSequence.setPlayerPosition(timeInTicks);
            
            // Export frame
            var framePath = outputFolder.fsName + '/frame_' + String(t + 1).padStart(4, '0') + '.png';
            
            // Use encoder to export current frame
            app.encoder.encodeSequence(
                activeSequence,
                framePath,
                app.encoder.ENCODE_ENTIRE,
                app.encoder.PNG
            );
            
            exportedCount++;
        }

        // Return result
        var result = {
            count: exportedCount,
            path: outputFolder.fsName
        };
        
        return JSON.stringify(result);
        
    } catch (e) {
        return 'error';
    }
}
