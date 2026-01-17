'use background';
import {setupHandleProxyRequest} from './tools/setupHandleProxyRequest';
import {fetchTranslations} from './tools/translate';
import {triggerPromise} from './tools/triggerPromise';
import {initOnboarding} from './vpn/initOnboarding';
import {initMessaging} from './vpn/initMessaging';
import {initState} from './vpn/initState';
import {initFocusWatcher} from './vpn/initFocusWatcher';
import {initProxySettingsWatcher} from './vpn/initProxySettingsWatcher';
import {initIdleWatcher} from './vpn/initIdleWatcher';
import {initAuthInterceptor} from './vpn/initAuthInterceptor';
import {initConnectionSpeed} from './vpn/initConnectionSpeed';
import {initSentry} from './tools/sentry';
import {setProxyToWaiterHost} from './tools/proxy';
import {initSwift} from './swift/initSwift';
import {initSwiftHeartbeat} from './swift/initSwiftHeartbeat';
import {initSwiftBlockedSite} from './swift/initSwiftBlockedSite';
import {waitForReadyState} from './state';

triggerPromise(setProxyToWaiterHost());
initSentry();
initAuthInterceptor();
initMessaging();
setTimeout(initState, 1);
setupHandleProxyRequest();
triggerPromise(fetchTranslations());
initOnboarding();
initFocusWatcher();
initProxySettingsWatcher();
initIdleWatcher();
initSwift();
initSwiftHeartbeat();
initSwiftBlockedSite();
initConnectionSpeed();

chrome.runtime.onStartup.addListener(() => {
	return waitForReadyState();
});
