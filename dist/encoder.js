"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ffmpeg = require("fluent-ffmpeg");
var fs = require("fs");
var path = require("path");
var cliProgress = require("cli-progress");
var stream_1 = require("stream");
var progressBar = new cliProgress.SingleBar({
    format: "Processing | {bar} | {percentage}%",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
});
var typeCheck = function (reject, config) {
    var frameStream = config.frameStream, output = config.output, backgroundVideo = config.backgroundVideo, fps = config.fps;
    if (!(frameStream instanceof stream_1.Readable)) {
        reject(new Error("frameStream should be in type Readable. You provided " + typeof frameStream));
    }
    if (!(typeof output === "string")) {
        reject(new Error("output should be a string. You provided " + typeof output));
    }
    if (!(fps && fps.input && fps.output)) {
        reject(new Error("fps should be an object with input and output properties"));
    }
    if (backgroundVideo) {
        var inSeconds = backgroundVideo.inSeconds, videoPath = backgroundVideo.videoPath, outSeconds = backgroundVideo.outSeconds;
        if (typeof inSeconds !== "number" ||
            typeof outSeconds !== "number" ||
            typeof videoPath !== "string") {
            reject(new Error("backgroundVideo property is not correctly set"));
        }
    }
};
var createDir = function (reject, silent, output) {
    try {
        var outDir = path.dirname(output);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
    }
    catch (e) {
        if (!silent)
            console.log("Could not create/access output directory");
        reject(new Error("Cannot create/access output directory"));
    }
};
var createFilter = function (backgroundVideo) {
    var inSeconds = backgroundVideo.inSeconds, outSeconds = backgroundVideo.outSeconds;
    return [
        "[1:v]setpts=PTS+" + inSeconds + "/TB[out]",
        {
            filter: "overlay",
            options: {
                enable: "between(t," + inSeconds + "," + outSeconds + ")",
                x: "0",
                y: "0",
            },
            inputs: "[0:v][out]",
            outputs: "tmp",
        },
    ];
};
var percent = function (percent) {
    return percent ? parseFloat(percent.toFixed(2)) : 0;
};
var outputOptions = [
    "-preset veryfast",
    "-crf 24",
    "-f mp4",
    "-movflags frag_keyframe+empty_moov",
    "-pix_fmt yuv420p",
];
var encoder = function (config) {
    return new Promise(function (resolve, reject) {
        var frameStream = config.frameStream, output = config.output, backgroundVideo = config.backgroundVideo, fps = config.fps, _a = config.silent, silent = _a === void 0 ? true : _a;
        typeCheck(reject, config);
        createDir(reject, silent, output);
        var outputStream = fs.createWriteStream(output);
        var command = ffmpeg();
        if (backgroundVideo)
            command.input(backgroundVideo.videoPath);
        command.input(frameStream).inputFPS(fps.input);
        command.outputOptions(outputOptions);
        command.fps(fps.output);
        if (backgroundVideo)
            command.complexFilter(createFilter(backgroundVideo), "tmp");
        command.output(outputStream);
        command.on("start", function () {
            if (!silent)
                progressBar.start(100, 0);
        });
        command.on("end", function () {
            if (!silent)
                progressBar.stop();
            if (!silent)
                console.log("Processing complete...");
            resolve({ path: output, stream: outputStream });
        });
        command.on("progress", function (progress) {
            if (!silent)
                progressBar.update(percent(progress.percent));
        });
        command.on("error", function (err) {
            if (!silent)
                console.log("An error occured while processing,", err.message);
            reject(new Error(err.message));
        });
        command.run();
    });
};
exports.default = encoder;
