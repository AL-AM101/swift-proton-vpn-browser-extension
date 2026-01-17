# Swift Proton VPN Browser Extension

![Swift Proton VPN](<docs/media/swift-proton-frontpage-readme.jpg>)

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

### Demo

![Swift demo](<docs/media/swift.gif>)

### Swift rules

![Swift rules](<docs/media/swift rules.png>)

### Disconnect on other sites

![Disconnect on other sites](<docs/media/dissconnect on other web.png>)

### Import/Export rules

![Import/Export rules](<docs/media/Import-export.png>)

### Blocked-site prompt

![Blocked-site prompt](<docs/media/Add block website.png>)

### Reconnect

![Reconnect](<docs/media/reconnect feature.png>)

### Favorites

![Favorites](<docs/media/faviorites.png>)
![Favorite item](<docs/media/favorite 1.png>)

# Getting Started

You'll need to have the following environment to work with this project:

- Node.js LTS

That's all folks!

# Build for Firefox

```
npm install
npm run build-ff
```

Auto-reload on change:
```
npm run watch-ff
```

# Build for Chrome

```
npm install
npm run build
```

Auto-reload on change:
```
npm run watch
```

Main config values are exposed in `config.js` at the root of the project
for QA and dev to conveniently create custom-builds.

# Build exact version from ZIP

To get the exact same build from source.zip, extract its content in an empty
folder then run:

Firefox:
```
npm ci && npm run pack-ff
```

Will generate: `vpn-proton-firefox.zip`

Chrome:
```
npm ci && npm run pack
```

Will generate: `vpn-proton-chrome.zip`

All steps including unzipping and dependencies install:
```
apt-get install zip
unzip source.zip -d vpn-bex
cd vpn-bex
npm ci
npm run pack-ff
mv vpn-proton-firefox.zip ../vpn-proton-firefox.zip
cd ..
rm -rf vpn-bex
```
