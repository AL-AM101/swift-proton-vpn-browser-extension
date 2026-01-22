const BRIDGE_FLAG = '__swiftProtonBridge';
const RESPONSE_FLAG = '__swiftProtonBridgeResponse';

const normalizeArgs = (args: any[]) => {
	const [first, second, third, fourth] = args;
	let extensionId: string | undefined;
	let message: any;
	let options: any;
	let callback: ((response: any) => void) | undefined;

	if (typeof first === 'string') {
		extensionId = first;
		message = second;
		if (typeof third === 'function') {
			callback = third;
		} else {
			options = third;
			callback = fourth;
		}
	} else {
		message = first;
		if (typeof second === 'function') {
			callback = second;
		} else {
			options = second;
			callback = third;
		}
	}

	return {extensionId, message, options, callback};
};

type RuntimeLike = {
	sendMessage: (...args: any[]) => any;
	lastError?: {message?: string};
	__swiftProtonBridgeInstalled?: boolean;
};

const patchRuntime = (runtime: RuntimeLike) => {

	if (runtime.__swiftProtonBridgeInstalled) {
		return;
	}

	runtime.__swiftProtonBridgeInstalled = true;

	const originalSendMessage = runtime.sendMessage.bind(runtime);

	runtime.sendMessage = function(...args: any[]) {
		const {extensionId, message, options, callback} = normalizeArgs(args);

		if (!message || typeof message !== 'object' || message.type !== 'fork') {
			if (typeof callback === 'function') {
				return originalSendMessage(...args);
			}

			const safeCallback = () => {
				const lastError = runtime.lastError;
				if (lastError && /Receiving end does not exist/i.test(lastError.message || `${lastError}`)) {
					return;
				}
			};

			if (typeof extensionId === 'string') {
				if (typeof options !== 'undefined') {
					return originalSendMessage(extensionId, message, options, safeCallback);
				}

				return originalSendMessage(extensionId, message, safeCallback);
			}

			if (typeof options !== 'undefined') {
				return originalSendMessage(message, options, safeCallback);
			}

			return originalSendMessage(message, safeCallback);
		}

		const requestId = `${Date.now()}:${Math.random().toString(16).slice(2)}`;

		window.postMessage({
			[BRIDGE_FLAG]: true,
			requestId,
			message,
		}, '*');

		const responsePromise = new Promise((resolve, reject) => {
			const handler = (event: MessageEvent) => {
				if (event.source !== window) {
					return;
				}

				const data = event.data as any;
				if (!data || data[RESPONSE_FLAG] !== true || data.requestId !== requestId) {
					return;
				}

				window.removeEventListener('message', handler);

				if (data.error) {
					reject(new Error(data.error));
					return;
				}

				resolve(data.response);
			};

			window.addEventListener('message', handler);
		});

		if (typeof callback === 'function') {
			responsePromise.then((response) => callback(response)).catch(() => callback(undefined));
			return;
		}

		return responsePromise;
	};
};

const chromeRuntime = window.chrome?.runtime as RuntimeLike | undefined;
if (typeof chromeRuntime?.sendMessage === 'function') {
	patchRuntime(chromeRuntime);
}

const browserRuntime = (window as any).browser?.runtime as RuntimeLike | undefined;
if (typeof browserRuntime?.sendMessage === 'function' && browserRuntime !== chromeRuntime) {
	patchRuntime(browserRuntime);
}

export {};
