import { FFmpeg } from "./node_modules/@ffmpeg/ffmpeg/dist/esm/index.js";
import { fetchFile } from "./node_modules/@ffmpeg/util/dist/esm/index.js";

// Set up basic variables for app
const record = document.querySelector(".record");
const stop = document.querySelector(".stop");
const soundClips = document.querySelector(".sound-clips");
const canvas = document.querySelector(".visualizer");
const mainSection = document.querySelector(".main-controls");
const message = document.querySelector('.message');
let ffmpeg = null;
let audioCount = 1;
const CLIP_SIZE_SEC = '1';

// Disable stop button while not recording
stop.disabled = true;

// Visualiser setup - create web audio api context and canvas
let audioCtx;
const canvasCtx = canvas.getContext("2d");

// Main block for doing the audio recording
if (navigator.mediaDevices.getUserMedia) {
  const constraints = { audio: true };
  let chunks = [];

  let onSuccess = function (stream) {
    const mediaRecorder = new MediaRecorder(stream);

    visualize(stream);

    function startRecording() {
      chunks = [];
      mediaRecorder.start();
      record.style.background = "red";
      stop.disabled = false;
      record.disabled = true;
    };

    record.onclick = startRecording;

    stop.onclick = function () {
      mediaRecorder.stop();
      record.style.background = "";
      record.style.color = "";
      stop.disabled = true;
      record.disabled = false;
    };

    mediaRecorder.onstop = async function (e) {
      message.textContent = "Processing, please wait...";

      const clipName = prompt(
        "Enter a name for your sound clip?",
        'audio' + audioCount
      );
      audioCount++;

      const clipContainer = document.createElement("article");
      const clipLabel = document.createElement("p");
      const audio = document.createElement("audio");
      const deleteButton = document.createElement("button");

      clipContainer.classList.add("clip");
      audio.setAttribute("controls", "");
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete";
      clipLabel.textContent = clipName;

      clipContainer.appendChild(audio);
      clipContainer.appendChild(clipLabel);
      clipContainer.appendChild(deleteButton);
      soundClips.appendChild(clipContainer);

      deleteButton.onclick = function (e) {
        e.target.closest(".clip").remove();
      };

      if (ffmpeg === null) {
        ffmpeg = new FFmpeg();
        ffmpeg.on("log", ({ message }) => {
          console.log(message);
        })
        ffmpeg.on("progress", ({ progress }) => {
          message.textContent = `${progress * 100} %`;
        });
        await ffmpeg.load({
          coreURL: "../../../core/dist/esm/ffmpeg-core.js",
        });
      }

      const mimeFile = clipName + '.mime';
      const wavFile = clipName + '.wav';
      const finalClipFilename = clipName + '_cut.wav';
      await ffmpeg.writeFile(mimeFile + '', await fetchFile(new Blob(chunks, { type: mediaRecorder.mimeType })));
      // Need to convert to .wav first, otherwise ffmpeg can't tell the file duration.
      await ffmpeg.exec(['-i', mimeFile, wavFile]);
      await ffmpeg.exec(['-sseof', '-' + CLIP_SIZE_SEC, '-i', wavFile, finalClipFilename]);
      const data = await ffmpeg.readFile(finalClipFilename);
      audio.src = URL.createObjectURL(new Blob([data.buffer], { type: 'video/wav' }));

      message.textContent = 'Done cutting ' + clipName;

      // startRecording();
    };

    mediaRecorder.ondataavailable = function (e) {
      chunks.push(e.data);
    };
  };

  let onError = function (err) {
    alert("The following error occured: " + err);
  };

  navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
} else {
  alert("MediaDevices.getUserMedia() not supported on your browser!");
}

function visualize(stream) {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  const source = audioCtx.createMediaStreamSource(stream);

  const bufferLength = 2048;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = bufferLength;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);

  draw();

  function draw() {
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = "rgb(200, 200, 200)";
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0, 0, 0)";

    canvasCtx.beginPath();

    let sliceWidth = (WIDTH * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = (v * HEIGHT) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }
}

window.onresize = function () {
  canvas.width = mainSection.offsetWidth;
};

window.onresize();
