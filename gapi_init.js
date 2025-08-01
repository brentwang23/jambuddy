const CLIENT_ID = '294540687382-uju0j95vobv36285bb5975vcrvcjmtd1.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBCXTBBwfsmrhMq6X-yQw6lZxSOsEFhIno';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let gapiAuthed = false;

/**
* Callback after api.js is loaded.
*/
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

/**
* Callback after the API client is loaded. Loads the
* discovery doc to initialize the API.
*/
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
}

/**
* Callback after Google Identity Services are loaded.
*/
function gsiLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // defined later
  });
  gisInited = true;
  maybeEnableButtons();
}

/**
* Enables user interaction after all libraries are loaded.
*/
function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.querySelector(".connect").style.visibility = 'visible';
  }
}

const connect = document.querySelector(".connect");
connect.onclick = () => {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw (resp);
    }

    connect.textContent = 'Connected';
    connect.disabled = true;
    gapiAuthed = true;
  };
  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({ prompt: '' });
  }
}