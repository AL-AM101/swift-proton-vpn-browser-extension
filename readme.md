# Swift Proton VPN Browser Extension

![Swift Proton VPN](<docs/media/0. Front-UI.png>)

Fork notice: this project is a fork of https://github.com/ProtonVPN/proton-vpn-browser-extension.

Swift Proton is a fork of the official Proton VPN browser extension with a refreshed UI and new features focused on easier site-based control.

## Features

1) Swift rules per site  
Connect specific domains or subdomains to a chosen country or server.

2) Disconnect on other sites  
Automatically disables VPN on websites that are not in your Swift rules.

3) Import/Export rules  
Back up Swift rules locally and transfer them to another browser or device.

4) Blocked-site prompt  
Detects restricted sites and lets you add them to Swift rules from the popup.

5) Reconnect  
Reconnect to the last server or country you used.

6) Favorites  
Pin servers to a favorites list shown at the top of the server or country list.

## Screenshots

### Swift rules per site

![Swift rules per site](<docs/media/1. Swift rules per site.png>)

### Disconnect on other sites

![Disconnect on other sites](<docs/media/2. Disconnect on other sites.png>)

### Import/Export rules

![Import/Export rules](<docs/media/3. Import-Export rules.png>)

### Blocked-site prompt

![Blocked-site prompt](<docs/media/4. Blocked-site prompt.png>)

### Reconnect

![Reconnect](<docs/media/5. Reconnect.png>)

### Favorites

![Favorites](<docs/media/6. Favorites.png>)

## Getting Started (Chrome)

1) Download the latest `vpn-proton-chrome.zip`, then unzip it.
2) Open `chrome://extensions`, enable Developer mode, and click Load unpacked.
3) Select the unzipped folder to install the extension.
4) Pin the extension, open it, and sign in with your Proton account.
5) Click Connect or choose a specific country or server.

## Getting Started (Firefox)

1) Download the latest `vpn-proton-firefox.zip`, then unzip it.
2) Open `about:debugging#/runtime/this-firefox`.
3) Click `Load Temporary Add-on...` and select `manifest.json` from the unzipped folder.
4) Pin the extension, open it, and sign in with your Proton account.
5) Click Connect or choose a specific country or server.

## Build Requirements

- OS: Windows, macOS, or Linux.
- Node.js + npm (tested with Node `v24.12.0`, npm `11.6.2`; newer LTS versions should work).

## Build (Firefox)

1) `npm install`
2) `npm run build-ff`
3) `npm run zip-ff`
4) The zip is generated as `vpn-proton-firefox.zip`.

## Build and Verify Releases

If you prefer to verify the release zip matches the source:

1) Build the package locally:
   - `npm install`
   - `npm run pack`
   - The zip is generated as `vpn-proton-chrome.zip`.
2) Compute the SHA-256 hash and compare it with the release hash I publish:
   - Windows PowerShell: `Get-FileHash .\\vpn-proton-chrome.zip -Algorithm SHA256`
   - macOS/Linux: `shasum -a 256 vpn-proton-chrome.zip`

I publish the SHA-256 hash alongside each release so anyone can verify the artifact.

## Support

If this project helps you, please consider supporting it ❤️

[![Buy me a coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&slug=azizalam&button_colour=FFDD00&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=ffffff)](https://buymeacoffee.com/azizalam)
