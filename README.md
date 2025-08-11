# Usage
1. Open [brentwang23.github.io/jambuddy](http://brentwang23.github.io/jambuddy).
2. [Optional] If you want automatic upload to Google Drive, click "Connect to Google Drive" to authenticate.
3. Click "Record" at the start of your jam session.
4. Whenever you finish a take you want to keep, click "Clip last 5 min" and enter a clip name.
5. After few seconds of processing, playback and download buttons for your clip will appear. If you connected to Drive, it will also show up in your root Drive folder.

# Known Issues
1. I have not completed verification for my Google API OAuth app yet, so connecting to Drive requires passing through a scary warning message.
2. If you leave the browser for too long, Chrome or OS memory optimization will deload the page and refresh on return, causing any ongoing recording to be lost. This is especially common on older devices.
3. Clicking "Clip last 5 min" creates a .wav file and automatically uploads to Drive, if connected. Clicking "Stop" just creates a downloadable .webm file instead and does not ever try to upload. This difference in behavior should either be changed or more clearly indicated.
4. The UI (and the code) are ugly as butt.

# Implementation

Audio recording is done with the browser's built-in MediaStream Recording API. Microphone permission is requested with `navigator.mediaDevices.getUserMedia`, and a MediaRecorder object is used to save audio data chunks. The implementation comes from this walkthrough, https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API, from which I also copied the general UI and that neat visualizer graph.

Audio processing is done with https://github.com/ffmpegwasm/ffmpeg.wasm, a Webassembly/JS port of FFmpeg, the well-known open-source library for manipulationg video and audio files. ffmpegwasm is used to convert the MediaRecorder blob to a .wav and then clip the desired 5m (300s) section with `-sseof -300`.

The Google Drive API integration comes from this walkthrough: https://developers.google.com/workspace/drive/api/quickstart/js#authorize_credentials_for_a_web_application, except instead of using the GAPI JS library like `gapi.client.drive.files.list`, I use `gapi.client.request` to create a custom request containing the audio data. The audio payload has to be of type `Content-Type: multipart/related;`, and the audio data has to be in base64 format.
