<p>
This RoomOS Macro bridges the gap with Cisco Spaces 3D rich map being unable to set the outside panel to BLUE when someone places the room on hold:<br>

  <img width="1021" height="627" alt="image" src="https://github.com/user-attachments/assets/6d41ec01-588c-439b-9c8b-0e7c6dad5239" />
<br>
<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/f0e53a56-47dd-4ad6-8d93-254a6c78e4a2" />

The outside panel without this macro will otherwise display a GREEN LED when no one is present in the room or the device is not considered in-use. 

There are 3 versions of the Macro, only one of which must be deployed on the inside room Cisco Device, for v1 the outside panel is network paired, for v2 and v3 the outside panel is cloud registered and added to the same Workspace:<br>
Verison 1: Uses local credentials on the Outside Touch Panel and sends xapi to change the LED via FQDN/IP Address.<br>
Version 2: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Bearer token (good for testing).<br>
Version 3: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Webex Service App (good for mass deployment).<br>

Note: The REVERT_ON_IN_USE = true/false switch in v2 and v3 of the macro.<br>
If True, uses the in-use status to switch the LED back to RED (call, presentation, peoplepresence, etc). This is the default setting.<br>
If False, the LED will remain Blue for 3 mins regardless of what the device is doing.<br><br>
This maybe useful to workaround a gap in the Explorer map where the color will only turn Red if a person is detected (via Camera or Ultrasound) and not if a call is placed. The BU has commited to switching to the in-use xstatus in the future.
<br><br>Logic Ladder Diagram:
<img alt="image" src="https://github.com/user-attachments/assets/3e8fedbc-4f01-4a1f-b3e8-f00c04bc5d87" />

</p>
