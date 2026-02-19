import xapi from 'xapi';

// --- SERVICE APP CONFIG ---
const CLIENT_ID = 'ClientIDFromSvcApp';
const CLIENT_SECRET = 'ClientSecretromSvcApp';
const INITIAL_ACCESS = 'InitToken';
const INITIAL_REFRESH = 'RefToken';

// --- LOGIC CONFIG ---
const DEBUG_LEVEL = 3; // 1: Errors, 2: Logic, 3: Full Trace
const REVERT_ON_IN_USE = true;
const TARGET_HARDWARE = "Cisco Room Navigator";
const TARGET_TYPE = "roomdesk";
const BASE_URL = 'https://webexapis.com/v1';

let accessToken = null;
let refreshToken = null;
let navigatorId = null;
let blueTimer = null;

/** * Utility: Unified Logger 
 */
function log(level, message, data = '') {
  if (level <= DEBUG_LEVEL) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] [DEBUG L${level}] ${message}`, data);
  }
}

/** * Storage: Persist tokens to device flash memory 
 */
async function saveTokens(access, refresh) {
  try {
    const data = JSON.stringify({ access, refresh, updatedAt: new Date().toISOString() });
    await xapi.command('Macros LocalStorage Write', { Key: 'webex_tokens_v3', Value: data });
    log(2, '💾 Tokens persisted to device storage.');
  } catch (e) {
    log(1, '❌ LocalStorage Write Error:', e.message);
  }
}

/** * Storage: Retrieve tokens from device flash memory 
 */
async function loadTokens() {
  try {
    const res = await xapi.command('Macros LocalStorage Read', { Key: 'webex_tokens_v3' });
    const stored = JSON.parse(res.Value);
    log(2, '💾 Stored tokens retrieved from memory.');
    return stored;
  } catch (e) {
    log(2, 'ℹ️ No stored tokens found. Using hardcoded initial values.');
    return { access: INITIAL_ACCESS, refresh: INITIAL_REFRESH };
  }
}

/** * Auth: Exchange Refresh Token for a new pair 
 */
async function refreshFlow(oldRefreshToken) {
  log(2, '🔄 Initiating Token Refresh Flow...');
  const url = 'https://webexapis.com/v1/access_token';
  const body = [
    'grant_type=refresh_token',
    `client_id=${CLIENT_ID}`,
    `client_secret=${CLIENT_SECRET}`,
    `refresh_token=${oldRefreshToken}`
  ].join('&');

  try {
    const res = await xapi.command('HttpClient Post', {
      Url: url,
      Header: ["Content-Type: application/x-www-form-urlencoded"],
      ResultBody: 'PlainText'
    }, body);

    const data = JSON.parse(res.Body);
    log(2, '✅ New token pair received from Webex Cloud.');
    
    accessToken = data.access_token;
    refreshToken = data.refresh_token || oldRefreshToken;

    await saveTokens(accessToken, refreshToken);
    return accessToken;
  } catch (err) {
    log(1, '❌ Refresh Flow Failed:', err.message);
    return null;
  }
}

/**
 * API Wrapper: Handles 401 Unauthorized with auto-refresh
 */
async function webexApi(method, endpoint, body = null, isPatch = false) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const contentType = isPatch ? "application/json-patch+json" : "application/json";

  log(3, `📡 API Request: ${method} ${endpoint}`);

  try {
    const res = await xapi.command(`HttpClient ${method}`, {
      Url: url,
      Header: [
        `Authorization: Bearer ${accessToken}`,
        `Content-Type: ${contentType}`
      ]
    }, body ? JSON.stringify(body) : "");

    if (res.StatusCode === "401") {
      log(2, '⚠️ Access Token expired (401). Attempting refresh...');
      const success = await refreshFlow(refreshToken);
      if (success) return webexApi(method, endpoint, body, isPatch);
    }
    
    log(3, `📡 API Response Status: ${res.StatusCode}`);
    return res;
  } catch (e) {
    log(1, `⛔ API Execution Error [${method}]:`, e.message);
  }
}

/**
 * Discovery: Find Navigator via Cloud
 */
async function getNavigatorId() {
  log(2, '🔍 Discovering Navigator hardware...');
  const devId = await xapi.status.get('Webex DeveloperId');
  const res = await webexApi('Get', `/devices/${devId}`);
  
  if (!res || res.StatusCode !== "200") {
    log(1, '❌ Discovery failed. Could not reach Webex Cloud.');
    return;
  }

  const workspaceId = JSON.parse(res.Body).workspaceId;
  const listRes = await webexApi('Get', `/devices?workspaceId=${workspaceId}`);
  const items = JSON.parse(listRes.Body).items;

  const nav = items.find(d => d.product === TARGET_HARDWARE && d.type === TARGET_TYPE);
  if (nav) {
    navigatorId = nav.id;
    log(2, `🎯 Navigator Identified: ${nav.displayName} (${navigatorId})`);
  } else {
    log(1, '⚠️ No Navigator found in this Workspace.');
  }
}

/**
 * LED Actions
 */
async function setRemoteLed() {
  if (!navigatorId) return;
  log(2, '🔵 "Hold" detected. Activating Blue LED.');
  
  await webexApi('Patch', `/deviceConfigurations?deviceId=${encodeURIComponent(navigatorId)}`, 
    { op: "replace", path: "UserInterface.LedControl.Mode/sources/configured/value", value: "Manual" }, true);
  
  await new Promise(r => setTimeout(r, 2000));
  
  await webexApi('Post', `/xapi/command/UserInterface.LedControl.Color.Set`, 
    { deviceId: navigatorId, arguments: { Color: "Blue" } });

  clearTimeout(blueTimer);
  blueTimer = setTimeout(() => revertToAuto(), 178000);
}

async function revertToAuto() {
  if (!navigatorId) return;
  log(2, '🔄 Reverting LED to Auto Mode.');
  clearTimeout(blueTimer);
  blueTimer = null;
  await webexApi('Patch', `/deviceConfigurations?deviceId=${encodeURIComponent(navigatorId)}`, 
    { op: "replace", path: "UserInterface.LedControl.Mode/sources/configured/value", value: "Auto" }, true);
}

/**
 * Init
 */
async function init() {
  log(2, '🚀 Macro starting...');
  const stored = await loadTokens();
  accessToken = stored.access;
  refreshToken = stored.refresh;

  // Verify and Discover
  await getNavigatorId();
}

// --- LISTENERS ---
xapi.status.on('RoomAnalytics RoomInUse', async (occupied) => {
  if (REVERT_ON_IN_USE && occupied === 'True') {
    log(2, '👥 Presence detected. Reverting LED.');
    await revertToAuto();
  }
});

xapi.event.on('UserInterface Message Prompt Display', async (event) => {
  if (event.Text && event.Text.includes("Someone has put this room")) {
    await setRemoteLed();
  }
});

init();
