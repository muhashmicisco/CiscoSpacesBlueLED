import xapi from 'xapi';

// --- SERVICE APP CONFIG ---
const CLIENT_ID = 'ClientIDFromSvcApp';
const CLIENT_SECRET = 'ClientSecretromSvcApp';
const INITIAL_ACCESS = 'InitToken';
const INITIAL_REFRESH = 'RefToken';

// --- LOGIC CONFIG ---
const DEBUG_LEVEL = 3; // 1: Errors, 2: Logic, 3: Full Trace
const REVERT_ON_IN_USE = true;
const TARGET_TYPE = "roomdesk";
const BASE_URL = 'https://webexapis.com/v1';

let accessToken = null;
let refreshToken = null;
let navigators = []; // Stores all discovered panels
let blueTimer = null;
let presenceDebounce = null;

/** * Utility: Unified Logger 
 * Handles objects and level filtering.
 */
function log(level, message, data = '') {
  if (level <= DEBUG_LEVEL) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    let dataOut = data;
    if (typeof data === 'object') {
      try { dataOut = JSON.stringify(data); } catch (e) { dataOut = '[Object]'; }
    }
    console.log(`[${timestamp}] [DEBUG L${level}] ${message}`, dataOut);
  }
}

/** * Storage: Persistence */
async function saveTokens(access, refresh) {
  try {
    const data = JSON.stringify({ access, refresh, updatedAt: new Date().toISOString() });
    await xapi.command('Macros LocalStorage Write', { Key: 'webex_tokens_v3', Value: data });
    log(2, '💾 Tokens persisted to device storage.');
  } catch (e) { log(1, '❌ LocalStorage Write Error:', e.message); }
}

async function loadTokens() {
  try {
    const res = await xapi.command('Macros LocalStorage Read', { Key: 'webex_tokens_v3' });
    log(2, '💾 Stored tokens retrieved.');
    return JSON.parse(res.Value);
  } catch (e) {
    log(2, 'ℹ️ No stored tokens found. Using hardcoded initials.');
    return { access: INITIAL_ACCESS, refresh: INITIAL_REFRESH };
  }
}

/** * Auth: Refresh Flow */
async function refreshFlow(oldRefreshToken) {
  log(2, '🔄 Initiating Token Refresh Flow...');
  const body = `grant_type=refresh_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${oldRefreshToken}`;
  try {
    const res = await xapi.command('HttpClient Post', {
      Url: `${BASE_URL}/access_token`,
      Header: ["Content-Type: application/x-www-form-urlencoded"],
      ResultBody: 'PlainText'
    }, body);
    const data = JSON.parse(res.Body);
    accessToken = data.access_token;
    refreshToken = data.refresh_token || oldRefreshToken;
    await saveTokens(accessToken, refreshToken);
    log(2, '✅ New token pair received.');
    return accessToken;
  } catch (err) { log(1, '❌ Refresh Flow Failed:', err.message); return null; }
}

/** * API Wrapper: Handles 401s and Tracing */
async function webexApi(method, endpoint, body = null, isPatch = false) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const contentType = isPatch ? "application/json-patch+json" : "application/json";
  
  log(3, `📡 API Request: ${method} ${endpoint}`);

  try {
    const res = await xapi.command(`HttpClient ${method}`, {
      Url: url,
      Header: [`Authorization: Bearer ${accessToken}`, `Content-Type: ${contentType}`]
    }, body ? JSON.stringify(body) : "");

    log(3, `📡 API Status: ${res.StatusCode}`);

    if (res.StatusCode === "401") {
      log(2, '⚠️ 401 Unauthorized. Refreshing...');
      if (await refreshFlow(refreshToken)) return webexApi(method, endpoint, body, isPatch);
    }
    return res;
  } catch (e) { log(1, `⛔ API Error [${method}]:`, e.message); }
}

/** * Broadcast Helper with Retry */
async function broadcast(actionDescription, callback) {
  for (const nav of navigators) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 2) {
      attempts++;
      const res = await callback(nav);
      if (res && (res.StatusCode === "200" || res.StatusCode === "204")) {
        success = true;
        log(3, `✅ ${actionDescription} successful for ${nav.name}`);
      } else {
        log(1, `⚠️ ${actionDescription} failed for ${nav.name} (Attempt ${attempts}/2)`);
        if (!success && attempts < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}

/** * Discovery */
async function getNavigatorIds() {
  log(2, '🔍 Discovering Navigators...');
  const devId = await xapi.status.get('Webex DeveloperId');
  const res = await webexApi('Get', `/devices/${devId}`);
  if (!res || res.StatusCode !== "200") return;

  const workspaceId = JSON.parse(res.Body).workspaceId;
  const listRes = await webexApi('Get', `/devices?workspaceId=${workspaceId}`);
  const items = JSON.parse(listRes.Body).items;

  navigators = items.filter(d => d.product.includes("Navigator") && d.type === TARGET_TYPE)
                    .map(d => ({ id: d.id, name: d.displayName }));
  
  log(2, `🎯 Found ${navigators.length} panel(s):`, navigators.map(n => n.name));
}

/** * LED Logic */
async function setRemoteLed() {
  if (navigators.length === 0) {
    log(1, '❌ Cannot set LED: No navigators discovered.');
    return;
  }
  
  log(2, '🔵 Triggering Blue LED Broadcast.');
  
  await broadcast('Set Manual Mode', (nav) => 
    webexApi('Patch', `/deviceConfigurations?deviceId=${encodeURIComponent(nav.id)}`, 
    { op: "replace", path: "UserInterface.LedControl.Mode/sources/configured/value", value: "Manual" }, true));
  
  await new Promise(r => setTimeout(r, 2000));
  
  await broadcast('Set Color Blue', (nav) => 
    webexApi('Post', `/xapi/command/UserInterface.LedControl.Color.Set`, 
    { deviceId: nav.id, arguments: { Color: "Blue" } }));

  clearTimeout(blueTimer);
  blueTimer = setTimeout(() => revertToAuto(), 178000);
}

async function revertToAuto() {
  if (navigators.length === 0 || blueTimer === null) {
    log(3, 'ℹ️ Revert ignored: LED not Blue or no panels found.');
    return;
  }
  
  log(2, '🔄 Reverting panels to Auto.');
  clearTimeout(blueTimer);
  blueTimer = null;

  await broadcast('Revert to Auto', (nav) => 
    webexApi('Patch', `/deviceConfigurations?deviceId=${encodeURIComponent(nav.id)}`, 
    { op: "replace", path: "UserInterface.LedControl.Mode/sources/configured/value", value: "Auto" }, true));
}

/** * Init */
async function init() {
  log(2, '🚀 Macro starting...');
  const stored = await loadTokens();
  accessToken = stored.access;
  refreshToken = stored.refresh;
  await getNavigatorIds();
}

// --- LISTENERS ---

xapi.status.on('RoomAnalytics RoomInUse', (occupied) => {
  // Guard: Only process if presence is 'True' AND LED is currently Blue
  if (REVERT_ON_IN_USE && occupied === 'True' && blueTimer !== null) {
    if (!presenceDebounce) {
      log(2, '👥 Presence detected. Debouncing 5s...');
      presenceDebounce = setTimeout(async () => {
        log(2, '👥 Presence verified. Reverting LED.');
        await revertToAuto();
        presenceDebounce = null;
      }, 5000);
    }
  } else if (occupied === 'False' && presenceDebounce) {
    log(2, '👥 Presence lost. Debounce cancelled.');
    clearTimeout(presenceDebounce);
    presenceDebounce = null;
  }
});

xapi.event.on('UserInterface Message Prompt Display', (event) => {
  if (event.Text && event.Text.includes("Someone has put this room")) {
    log(2, '🔔 Hold Prompt detected.');
    if (presenceDebounce) { 
      clearTimeout(presenceDebounce); 
      presenceDebounce = null; 
    }
    setRemoteLed();
  }
});

init();
