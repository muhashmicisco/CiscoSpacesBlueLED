<p>
This RoomOS Macro bridges the gap with Cisco Spaces 3D rich map being unable to set the outside panel to BLUE when someone places the room on hold:

  <img width="1021" height="627" alt="image" src="https://github.com/user-attachments/assets/6d41ec01-588c-439b-9c8b-0e7c6dad5239" />

The outside panel without this macro will display GREEN otherwise when no one is present in the room or the device is not considered in-use. 

There are 3 versions of the Macro, which must be deployed on the inside room Cisco Device, for v1 the device is network paired, for v2 and v3 the outside panel is cloud registered and added to the same Workspace:
Verison 1: Uses local credentials on the Outside Touch Panel and sends xapi to change the LED via FQDN/IP Address.
Version 2: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Bearer token (good for testing).
Version 3: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Webex Service App (good for mass deployment).

Note: The REVERT_ON_IN_USE = true/false switch in v2 and v3 of the macro can be used to match the duration of the LED's Blue color with what is shown on the 3D Map if set to false. Setting it to "true" (default) will change the color of the room back to RED if the macro determines the device is being used (call, presentation, peoplepresence, etc).

<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/42acf440-8800-49ad-8828-996fc91ec5b8" />
</p>
