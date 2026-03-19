// Face Analyzer Module
// Uses face-api.js TinyFaceDetector to analyze sampling frames
// and detect significant face changes (speaker switches in podcasts)

var FaceAnalyzer = (function() {

    var isModelLoaded = false;
    var modelPath = '';

    function toFileUrl(filePath) {
        var normalized = String(filePath || '').replace(/\\/g, '/');
        if (/^file:\/\//i.test(normalized)) {
            return normalized;
        }
        if (normalized.charAt(0) !== '/') {
            normalized = '/' + normalized;
        }
        return 'file://' + normalized;
    }

    function createImageElement() {
        return document.createElement('img');
    }

    function createCanvasElement() {
        return document.createElement('canvas');
    }

    function loadImage(imagePath) {
        return new Promise(function(resolve, reject) {
            var img = createImageElement();
            img.onload = function() {
                resolve(img);
            };
            img.onerror = function() {
                reject(new Error('Failed to load image: ' + imagePath));
            };
            img.src = toFileUrl(imagePath);
        });
    }

    function ensureFaceApiEnvPatched() {
        if (!faceapi || !faceapi.env || !faceapi.env.monkeyPatch) {
            return;
        }

        // CEP embedded Chromium can throw "Illegal constructor" when libraries
        // try to instantiate DOM classes directly. Provide safe factory-style
        // constructors so face-api/tfjs can create image/canvas elements.
        faceapi.env.monkeyPatch({
            Canvas: function Canvas() {
                return createCanvasElement();
            },
            Image: function Image() {
                return createImageElement();
            },
            ImageData: window.ImageData
        });
    }

    // Initialize face-api.js with TinyFaceDetector model
    function init(modelsDir) {
        modelPath = toFileUrl(modelsDir);
        ensureFaceApiEnvPatched();

        // WebGL backend in CEP can be unstable; CPU backend is slower but stable.
        return faceapi.tf.setBackend('cpu')
            .catch(function() {
                return null;
            })
            .then(function() {
                return faceapi.tf.ready();
            })
            .then(function() {
                return faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
            })
            .then(function() {
                isModelLoaded = true;
                console.log('[FaceAnalyzer] TinyFaceDetector model loaded');
            });
    }


    function detectFacesFromImage(img, imagePath) {
        return new Promise(function(resolve, reject) {
            var options = new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,       // smaller = faster, 320 is good balance
                scoreThreshold: 0.4   // minimum confidence
            });

            // Analyze a canvas instead of img directly for better CEP compatibility.
            var canvas = createCanvasElement();
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            var ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve([]);
                return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            var inputTensor;
            try {
                inputTensor = faceapi.tf.browser.fromPixels(canvas);
            } catch (tensorErr) {
                reject(new Error('Tensor creation failed for ' + imagePath + ': ' + tensorErr.message));
                return;
            }

            faceapi.detectAllFaces(inputTensor, options).then(function(detections) {
                // Simplify results: keep box center + size + score
                var faces = detections.map(function(det) {
                    var box = det.box;
                    return {
                        x: Math.round(box.x + box.width / 2),
                        y: Math.round(box.y + box.height / 2),
                        width: Math.round(box.width),
                        height: Math.round(box.height),
                        score: Math.round(det.score * 100) / 100
                    };
                });
                if (inputTensor && inputTensor.dispose) {
                    inputTensor.dispose();
                }
                resolve(faces);
            }).catch(function(err) {
                if (inputTensor && inputTensor.dispose) {
                    inputTensor.dispose();
                }
                reject(new Error('Face analysis failed for ' + imagePath + ': ' + err.message));
            });
        });
    }

    // Detect faces in a single image file
    // Returns a promise with array of face detections (box, score)
    function detectFaces(imagePath) {
        return loadImage(imagePath).then(function(img) {
            return detectFacesFromImage(img, imagePath);
        });
    }


    // Variance of Laplacian sharpness metric.
    // Higher value = sharper image. Lower value = blurrier image.
    function computeLaplacianVarianceFromImage(img, cropX, cropY, cropW, cropH, targetW, targetH) {
        var canvas = createCanvasElement();
        canvas.width = targetW;
        canvas.height = targetH;

        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return 0;
        }

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
        var imageData = ctx.getImageData(0, 0, targetW, targetH).data;

        var gray = new Array(targetW * targetH);
        for (var i = 0, p = 0; i < imageData.length; i += 4, p++) {
            gray[p] = 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
        }

        var lapValues = [];
        for (var y = 1; y < targetH - 1; y++) {
            for (var x = 1; x < targetW - 1; x++) {
                var idx = y * targetW + x;
                var lap =
                    gray[(y - 1) * targetW + x] +
                    gray[y * targetW + (x - 1)] -
                    4 * gray[idx] +
                    gray[y * targetW + (x + 1)] +
                    gray[(y + 1) * targetW + x];
                lapValues.push(lap);
            }
        }

        if (lapValues.length === 0) {
            return 0;
        }

        var mean = 0;
        for (var m = 0; m < lapValues.length; m++) {
            mean += lapValues[m];
        }
        mean /= lapValues.length;

        var variance = 0;
        for (var v = 0; v < lapValues.length; v++) {
            var d = lapValues[v] - mean;
            variance += d * d;
        }

        return variance / lapValues.length;
    }

    function getBlurThresholds(sensitivity) {
        // Higher sensitivity allows slightly softer frames.
        if (sensitivity <= 2) {
            return { full: 230, lower: 140 };
        }
        if (sensitivity <= 4) {
            return { full: 190, lower: 120 };
        }
        if (sensitivity <= 6) {
            return { full: 160, lower: 100 };
        }
        if (sensitivity <= 8) {
            return { full: 130, lower: 85 };
        }
        return { full: 110, lower: 70 };
    }

    function getBlurInfo(img, sensitivity) {
        var width = img.naturalWidth || img.width;
        var height = img.naturalHeight || img.height;
        var lowerY = Math.floor(height * 0.55);
        var lowerH = Math.max(1, height - lowerY);

        var fullScore = computeLaplacianVarianceFromImage(img, 0, 0, width, height, 256, 144);
        var lowerScore = computeLaplacianVarianceFromImage(img, 0, lowerY, width, lowerH, 256, 96);

        var thresholds = getBlurThresholds(sensitivity);
        var isBlurry = (fullScore < thresholds.full) || (lowerScore < thresholds.lower);

        return {
            fullScore: fullScore,
            lowerScore: lowerScore,
            thresholds: thresholds,
            isBlurry: isBlurry
        };
    }


    // Compare two face arrays and return a change score (0-1)
    // Higher score = more significant change between frames
    function computeChangeScore(prevFaces, currFaces) {
        // 1. Different number of faces = significant change
        if (prevFaces.length !== currFaces.length) {
            return 1.0;
        }

        // 2. No faces in either = no change
        if (prevFaces.length === 0 && currFaces.length === 0) {
            return 0;
        }

        // 3. Compare the dominant face (largest) position
        var prevDominant = getLargestFace(prevFaces);
        var currDominant = getLargestFace(currFaces);

        if (!prevDominant || !currDominant) return 0;

        // Calculate position shift as percentage of image
        var dx = Math.abs(prevDominant.x - currDominant.x);
        var dy = Math.abs(prevDominant.y - currDominant.y);
        var positionShift = Math.sqrt(dx * dx + dy * dy);

        // Calculate size change ratio
        var prevSize = prevDominant.width * prevDominant.height;
        var currSize = currDominant.width * currDominant.height;
        var sizeRatio = Math.max(prevSize, currSize) / Math.max(Math.min(prevSize, currSize), 1);

        // Position shift > 100px or size change > 1.5x = significant
        var posScore = Math.min(positionShift / 150, 1.0);
        var sizeScore = Math.min((sizeRatio - 1) / 1.0, 1.0);

        return Math.max(posScore, sizeScore);
    }


    function getLargestFace(faces) {
        if (faces.length === 0) return null;
        var largest = faces[0];
        for (var i = 1; i < faces.length; i++) {
            if (faces[i].width * faces[i].height > largest.width * largest.height) {
                largest = faces[i];
            }
        }
        return largest;
    }


    // Analyze all sampling frames and find timestamps with significant face changes
    // samplingPath: folder with sample_XXXXX.jpg files
    // samplingInterval: seconds between samples
    // sensitivity: 1-10, controls change threshold
    // onProgress: callback(current, total) for UI updates
    //
    // Returns promise with array of timestamps (in seconds) to export
    function analyzeFrames(samplingPath, samplingCount, samplingInterval, sensitivity, onProgress) {
        if (!isModelLoaded) {
            return Promise.reject(new Error('Face detection model not loaded'));
        }

        // Sensitivity controls the change threshold
        // Higher sensitivity = lower threshold = more frames exported
        var threshold;
        if (sensitivity <= 2) {
            threshold = 0.9;    // only very obvious changes
        } else if (sensitivity <= 4) {
            threshold = 0.7;
        } else if (sensitivity <= 6) {
            threshold = 0.5;    // balanced
        } else if (sensitivity <= 8) {
            threshold = 0.3;
        } else {
            threshold = 0.15;   // very sensitive, many frames
        }

        var timestamps = [];
        var prevFaces = null;
        var skippedBlurCount = 0;

        // Process frames sequentially to avoid memory issues
        function processFrame(index) {
            if (index >= samplingCount) {
                return Promise.resolve(timestamps);
            }

            if (onProgress) {
                onProgress(index + 1, samplingCount);
            }

            var frameNum = zeroPad(index + 1, 5);
            var framePath = samplingPath + '\\sample_' + frameNum + '.jpg';
            var timeSeconds = index * samplingInterval;

            return loadImage(framePath).then(function(img) {
                var blurInfo = getBlurInfo(img, sensitivity);
                if (blurInfo.isBlurry) {
                    skippedBlurCount++;
                    return processFrame(index + 1);
                }

                return detectFacesFromImage(img, framePath).then(function(faces) {
                    if (prevFaces === null) {
                        // Always include first accepted non-blurry frame
                        timestamps.push(timeSeconds);
                    } else {
                        var change = computeChangeScore(prevFaces, faces);
                        if (change >= threshold) {
                            timestamps.push(timeSeconds);
                        }
                    }

                    prevFaces = faces;
                    return processFrame(index + 1);
                });
            }).catch(function(err) {
                // Ignore unreadable sample frame and continue.
                console.warn('[FaceAnalyzer] Skipping frame', framePath, err.message);
                if (prevFaces === null) {
                    prevFaces = [];
                }
                return processFrame(index + 1);
            });
        }

        return processFrame(0).then(function(result) {
            if (skippedBlurCount > 0) {
                console.log('[FaceAnalyzer] Skipped blurry frames:', skippedBlurCount);
            }
            return result;
        });
    }


    function zeroPad(num, size) {
        var s = '00000' + num;
        return s.substr(s.length - size);
    }


    // Public API
    return {
        init: init,
        analyzeFrames: analyzeFrames,
        detectFaces: detectFaces
    };

})();
