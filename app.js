const IS_LOCAL = window.location.hostname === 'localhost';
const FFmpeg = await import(IS_LOCAL ? "./node_modules/@ffmpeg/ffmpeg/dist/esm/index.js" : "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm");
const FFmpegUtil = await import(IS_LOCAL ? "./node_modules/@ffmpeg/util/dist/esm/index.js" : "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm");

// Set up basic variables for app
const buttons = document.querySelector("#buttons");
const record = document.querySelector(".record");
const clipButton = document.querySelector(".clipButton");
clipButton.remove();
const stop = document.querySelector(".stop");
stop.remove();
const soundClips = document.querySelector(".sound-clips");
const canvas = document.querySelector(".visualizer");
const mainSection = document.querySelector(".main-controls");
const message = document.querySelector('.message');
let clipSizeSec = 0;

// Set visualizer size
window.onresize = function () {
  canvas.width = mainSection.offsetWidth;
};
window.onresize();

// Start loading ffmpeg immediately, as this can take seconds to minutes
let ffmpegLoaded = false;
const ffmpeg = new FFmpeg.FFmpeg();
ffmpeg.load({
  coreURL: IS_LOCAL ? "../../../core/dist/esm/ffmpeg-core.js" : "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.min.js",
}).then(() => {
  ffmpegLoaded = true;
});

function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload an audio file.
 */
async function uploadClip(name, clipBlob) {

  const boundary = 'JAMBUD_BOUNDARY_STRING';
  const metadata = ({ name: name });
  const metadataSection =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n`;
  const contentHeader =
    `--${boundary}\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `Content-Type: ${clipBlob.type}\r\n\r\n`;
  let content = await blobToBase64(clipBlob);
  content = content.substr(content.indexOf(',') + 1);
  const footer = `\r\n--${boundary}--\r\n`;
  const body = metadataSection + contentHeader + content + footer;

  try {
    await gapi.client.request({
      path: 'https://www.googleapis.com/upload/drive/v3/files',
      method: 'POST',
      params: {
        uploadType: 'multipart',
      },
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
        'Content-Length': body.size,
      },
      body: body,
    })
  } catch (err) {
    throw err;
  }
}

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
      record.remove();
      buttons.appendChild(stop);
      buttons.appendChild(clipButton);
    };

    record.onclick = startRecording;

    function stopRecording(clipLength) {
      clipSizeSec = clipLength;
      mediaRecorder.stop();
      clipButton.remove();
      stop.remove();
      buttons.appendChild(record);
    }

    clipButton.onclick = () => { stopRecording(5); } // 5s for testing
    stop.onclick = () => { stopRecording(0); };

    mediaRecorder.onstop = async function (e) {
      const clipName = prompt(
        "Enter a name for your sound clip?",
        // The Swedish locale date format is very close to toISOString, which looks nice but
        // doesn't adjust to local timezone.
        (new Date()).toLocaleString('sv').replace(' ', '_')
      );

      const clipContainer = document.createElement("article");
      clipContainer.classList.add("clip");
      soundClips.appendChild(clipContainer);

      const clipLabel = document.createElement("p");
      clipLabel.textContent = clipName;
      clipContainer.appendChild(clipLabel);

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete";
      deleteButton.onclick = function (e) {
        e.target.closest(".clip").remove();
      };
      clipContainer.appendChild(deleteButton);

      let audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType });

      if (clipSizeSec != 0) {
        while (!ffmpegLoaded) {
          message.textContent = 'Loading ffmpeg...';
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        message.textContent = 'Cutting...';

        const clipNameWav = clipName + '.wav';
        await ffmpeg.writeFile('tmp.mime', await FFmpegUtil.fetchFile(audioBlob));
        // Need to convert to .wav first, otherwise ffmpeg can't tell the file duration.
        await ffmpeg.exec(['-i', 'tmp.mime', 'tmp.wav']);
        await ffmpeg.exec(['-sseof', '-' + clipSizeSec, '-i', 'tmp.wav', clipNameWav]);
        const data = await ffmpeg.readFile(clipNameWav);
        audioBlob = new Blob([data.buffer], { type: 'audio/wav' });

        if (gapiAuthed) {
          message.textContent = 'Uploading... ' + clipName + '...';
          uploadClip(clipNameWav, audioBlob);
          message.textContent = "Done uploading " + clipName;
        } else {
          message.textContent = 'Finished cutting ' + clipName;
        }
      }

      const audio = document.createElement("audio");
      audio.setAttribute("controls", "");
      audio.src = URL.createObjectURL(audioBlob);
      clipContainer.appendChild(audio);

      const downloadLink = document.createElement("a");
      downloadLink.href = audio.src;
      downloadLink.textContent = "Download";
      downloadLink.download = clipName;
      clipContainer.appendChild(downloadLink);
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


// Visualiser setup - create web audio api context and canvas
let audioCtx;
const canvasCtx = canvas.getContext("2d");
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
