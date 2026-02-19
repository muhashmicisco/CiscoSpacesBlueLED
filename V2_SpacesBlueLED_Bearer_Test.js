import xapi from 'xapi';

// --- CONFIG ---
const TOKEN = 'onetimeuseToken';
const BASE_URL = 'https://webexapis.com/v1';

// --- SWITCHES ---
const REVERT_ON_IN_USE = true; 
const TARGET_HARDWARE = "Cisco Room Navigator"; // Product string
const TARGET_TYPE = "roomdesk";                // Type string

let navigatorId = null;
let blueTimer = null;

/**
 * Discovery: Finds the Navigator's Cloud ID using the Codec's DeveloperId
 */
async function getNavigatorId() {
  console.log('🚀 [START] Discovery Process');

  try {
    // 1. Get the Webex DeveloperId from status
    console.log('📡 Step 1: Fetching Webex DeveloperId...');
    const myDeviceId = await xapi.status.get('Webex DeveloperId');
    
    if (!myDeviceId) {
      console.error('❌ Step 1 Failed: DeveloperId is null. Check Webex registration.');
      return;
    }
    console.log(`✅ Step 1 Success: My DeveloperId is [${myDeviceId}]`);

    // 2. Query Webex API /devices/{id} to get the Workspace ID
    console.log('🌐 Step 2: Querying Webex Cloud API for Workspace info...');
    const deviceDetailRes = await xapi.command('HttpClient Get', {
      Url: `${BASE_URL}/devices/${myDeviceId}`,
      Header: [`Authorization: Bearer ${TOKEN}`]
    });

    if (deviceDetailRes.StatusCode != 200) {
      console.error(`❌ Step 2 Failed: HTTP ${deviceDetailRes.StatusCode}. Body: ${deviceDetailRes.Body}`);
      return;
    }

    const deviceData = JSON.parse(deviceDetailRes.Body);
    const myWorkspaceId = deviceData.workspaceId;

    if (!myWorkspaceId) {
      console.error('❌ Step 2 Failed: workspaceId field not found.');
      return;
    }
    console.log(`✅ Step 2 Success: Linked Workspace is [${myWorkspaceId}]`);

    // 3. Query /devices using the WorkspaceID
    console.log(`🔍 Step 3: Fetching all devices for Workspace [${myWorkspaceId}]...`);
    const workspaceDevicesRes = await xapi.command('HttpClient Get', {
      Url: `${BASE_URL}/devices?workspaceId=${myWorkspaceId}`,
      Header: [`Authorization: Bearer ${TOKEN}`]
    });

    const workspaceItems = JSON.parse(workspaceDevicesRes.Body).items;
    
    // 4. Filter for Navigator
    const nav = workspaceItems.find(d => 
      d.product === TARGET_HARDWARE && d.type === TARGET_TYPE
    );

    if (nav) {
      navigatorId = nav.id;
      console.log(`🎯 [SUCCESS] Navigator Identified: ${nav.displayName} (${navigatorId})`);
    } else {
      console.warn('⚠️ Step 4 Failed: No Navigator found matching criteria.');
      workspaceItems.forEach(item => console.log(`   -> Found: "${item.product}" | Type: "${item.type}"`));
    }

  } catch (error) {
    console.error(`⛔ [DISCOVERY ERROR]: ${error.message}`);
  }
}

/**
 * Patch Configuration on the Navigator
 */
async function patchNavigator(path, value) {
  if (!navigatorId) return;
  const url = `${BASE_URL}/deviceConfigurations?deviceId=${encodeURIComponent(navigatorId)}`;
  
  try {
    const res = await xapi.command('HttpClient Patch', {
      Url: url,
      Header: [`Authorization: Bearer ${TOKEN}`, "Content-Type: application/json-patch+json"]
    }, JSON.stringify({ "op": "replace", "path": path, "value": value }));
    
    console.log(`📡 Patch ${path} -> ${value} | Status: ${res.StatusCode}`);
  } catch (e) {
    console.error(`⛔ Patch Error: ${e.message}`);
  }
}

/**
 * Set LED Color via xAPI Command
 */
async function setNavigatorColor(color) {
  if (!navigatorId) return;

  const url = `${BASE_URL}/xapi/command/UserInterface.LedControl.Color.Set`;
  
  // Construct the payload exactly like your Postman example
  const payload = {
    deviceId: navigatorId,
    arguments: {
      Color: color
    }
  };

  try {
    console.log(`🎨 Sending Color Command for ID: ${navigatorId}`);
    
    const res = await xapi.command('HttpClient Post', {
      Url: url,
      Header: [
        `Authorization: Bearer ${TOKEN}`,
        "Content-Type: application/json"
      ]
    }, JSON.stringify(payload)); // Pass the stringified object here

    if (res.StatusCode !== "200") {
      console.error(`❌ LED API Error: ${res.StatusCode} | Body: ${res.Body}`);
    } else {
      console.log(`✅ LED set to ${color} successfully.`);
    }
  } catch (e) {
    console.error(`⛔ Exception in setNavigatorColor: ${e.message}`);
  }
}

async function setRemoteLed() {
  if (!navigatorId) return;
  console.log('🔵 Triggering Blue LED sequence...');
  
  // 1. Set to Manual
  await patchNavigator("UserInterface.LedControl.Mode/sources/configured/value", "Manual");
  
  // 2. Short delay to allow config to propagate
  await new Promise(r => setTimeout(r, 2000));
  
  // 3. Set Color
  await setNavigatorColor("Blue");

  clearTimeout(blueTimer);
  blueTimer = setTimeout(() => revertToAuto(), 178000);
}

async function revertToAuto() {
  if (!navigatorId) return;
  console.log('🔄 Reverting LED to Auto.');
  clearTimeout(blueTimer);
  await patchNavigator("UserInterface.LedControl.Mode/sources/configured/value", "Auto");
}

// --- LISTENERS ---

// Watch for real-time occupancy changes
xapi.status.on('RoomAnalytics RoomInUse', async (occupied) => {
  console.log(`👥 RoomInUse changed to: ${occupied}`);

  // The status is returned as a string "True" or "False"
  if (REVERT_ON_IN_USE && occupied === 'True') {
    console.log('🏃 Presence detected! Reverting Navigator LED to Auto...');
    await revertToAuto();
  }
});

// Keep your prompt listener as is
xapi.event.on('UserInterface Message Prompt Display', async (event) => {
  if (event.Text && event.Text.includes("Someone has put this room")) {
    await setRemoteLed();
  }
});

// Initial Start
getNavigatorId();
