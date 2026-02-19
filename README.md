<p>
This RoomOS Macro bridges the gap with Cisco Spaces 3D rich map being unable to set the outside panel to BLUE when someone places the room on hold:<br>

  <img width="1021" height="627" alt="image" src="https://github.com/user-attachments/assets/6d41ec01-588c-439b-9c8b-0e7c6dad5239" />
<br>
<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/f0e53a56-47dd-4ad6-8d93-254a6c78e4a2" />

The outside panel without this macro will display GREEN otherwise when no one is present in the room or the device is not considered in-use. 

There are 3 versions of the Macro, which must be deployed on the inside room Cisco Device, for v1 the device is network paired, for v2 and v3 the outside panel is cloud registered and added to the same Workspace:<br>
Verison 1: Uses local credentials on the Outside Touch Panel and sends xapi to change the LED via FQDN/IP Address.<br>
Version 2: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Bearer token (good for testing).<br>
Version 3: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Webex Service App (good for mass deployment).<br>

Note: The REVERT_ON_IN_USE = true/false switch in v2 and v3 of the macro can be used to match the duration of the LED's Blue color with what is shown on the 3D Map if set to false. Setting it to "true" (default) will change the color of the room back to RED if the macro determines the device is being used (call, presentation, peoplepresence, etc).

<img width="796" height="1024" alt="image" src="https://github.com/user-attachments/assets/405f7a11-03ff-40f4-a907-b1dc473e1453" />
</p>
