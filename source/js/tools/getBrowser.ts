export const getBrowser = () => /^moz-extension:/.test(location.href) ? {
	// moz-extension://
	name: 'Firefox',
	type: 'firefox',
	pluginsUrl: 'https://addons.mozilla.org/firefox/addon/proton-vpn-firefox-extension',
	storeReviewsUrl: 'https://addons.mozilla.org/firefox/addon/proton-vpn-firefox-extension/reviews/',
} : {
	// chrome-extension://
	name: 'Chrome',
	type: 'chromium',
	pluginsUrl: 'chrome://extensions/',
	storeReviewsUrl: 'https://chromewebstore.google.com/detail/swift-proton-vpn-fast-sec/mofnafclpcapghpjdoaanahkgcjfcece/reviews',
};
