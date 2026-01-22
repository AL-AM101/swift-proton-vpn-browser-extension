const BRIDGE_FLAG = '__swiftProtonBridge';
const RESPONSE_FLAG = '__swiftProtonBridgeResponse';

window.addEventListener('message', async (event) => {
	if (event.source !== window) {
		return;
	}

	const data = event.data;
	if (!data || data[BRIDGE_FLAG] !== true) {
		return;
	}

	try {
		const responseWrapper = await chrome.runtime.sendMessage({
			...data.message,
			bridge: true,
			requestId: data.requestId,
		});
		const response = responseWrapper?.result ?? responseWrapper;

		window.postMessage({
			[RESPONSE_FLAG]: true,
			requestId: data.requestId,
			response,
		}, '*');
	} catch (error) {
		window.postMessage({
			[RESPONSE_FLAG]: true,
			requestId: data.requestId,
			error: error instanceof Error ? error.message : `${error}`,
		}, '*');
	}
});

export {};
