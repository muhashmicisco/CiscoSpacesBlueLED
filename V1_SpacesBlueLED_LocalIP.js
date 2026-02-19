import xapi from 'xapi';

const PANEL_IP = 'IP/FQDNofOutsideRoomPanel'; // Change to your panel's IP
const AUTH = 'Basic pasteencodedcredshere';// enter in console btoa('admin:Cisco123!')

async function postToPanel(xmlBody) {
  try {
    await xapi.command('HttpClient Post', {
      Header: [`Authorization: ${AUTH}`, 'Content-Type: text/xml'],
      // Changed http to https to avoid the 307 redirect
      Url: `https://${PANEL_IP}/putxml`, 
      AllowInsecureHTTPS: 'True'
    }, xmlBody);
    console.log('Remote command sent successfully via HTTPS');
  } catch (err) {
    // If it still fails, this will log the specific status code
    console.error('Remote command failed:', JSON.stringify(err));
  }
}
let isRunning = false;

async function setRemoteLed() {
  if (isRunning) return;
  isRunning = true;

  // XML to set Mode to Manual and Color to Blue
  const turnBlueXml = `
    <Configuration>
      <UserInterface>
        <LedControl>
          <Mode>Manual</Mode>
        </LedControl>
      </UserInterface>
    </Configuration>`;

  const setColorXml = `
    <Command>
      <UserInterface>
        <LedControl>
          <Color>
            <Set>
              <Color>Blue</Color>
            </Set>
          </Color>
        </LedControl>
      </UserInterface>
    </Command>`;

  const revertAutoXml = `
    <Configuration>
      <UserInterface>
        <LedControl>
          <Mode>Auto</Mode>
        </LedControl>
      </UserInterface>
    </Configuration>`;

  try {
    await postToPanel(turnBlueXml);
    await postToPanel(setColorXml);
    
    await new Promise(r => setTimeout(r, 180000));
    
    await postToPanel(revertAutoXml);
  } finally {
    isRunning = false;
  }
}

xapi.event.on('UserInterface Message Prompt Display', (event) => {
  if (event.Text && event.Text.includes("Someone has put this room")) {
    setRemoteLed();
  }
});
