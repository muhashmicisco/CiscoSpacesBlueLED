<p>
This RoomOS Macro bridges the gap in with Cisco Spaces 3D rich map being unable to set the outside panel to BLUE when someone places the room on hold:

  <img width="1021" height="627" alt="image" src="https://github.com/user-attachments/assets/6d41ec01-588c-439b-9c8b-0e7c6dad5239" />

The outside panel without this macro will display GREEN otherwise when no one is present in the room or the device is not considered in-use. 
There are 3 versions of the Macro:

Verison 1: Uses local credentials on the Outside Touch Panel and sends xapi to change the LED via FQDN/IP Address.
Version 2: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Bearer token (good for testing).
Version 3: Uses Cloud xAPI and self-discovers the outside panel and send xapi using a Webex Service App (good for mass deployment).
  
</p>
