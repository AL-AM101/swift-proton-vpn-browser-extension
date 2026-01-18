import {watchOnceBroadcastMessage} from './answering';

const root = global || window;
root.browser || ((root as any).browser = chrome);

export const sendMessageTo = <K>(
	type: string,
	data: any = undefined,
) => new Promise<K>(async (resolve, reject) => {
	try {
		const handleResponse = (response: any) => {
			if (response == null) {
				return;
			}

			const result = response?.result;
			const error = result?.error;

			if (error && !error.Warning) {
				reject(error);

				return;
			}

			resolve(result);
		};

		const handleCallbackResponse = (response: any) => {
			const lastError = browser?.runtime?.lastError;

			if (lastError) {
				const message = lastError.message || `${lastError}`;

				if (response == null && /message port closed/i.test(message)) {
					return;
				}

				reject(message ? new Error(message) : lastError);

				return;
			}

			if (response == null) {
				return;
			}

			handleResponse(response);
		};

		const messagePromise = (() => {
			try {
				const requestId = Date.now() + ':' + Math.random();
				const sender = (browser.runtime.sendMessage as any)(
					browser.runtime.id,
					{type, data, respondTo: 'broadcast', requestId},
					undefined,
					handleCallbackResponse,
				);

				watchOnceBroadcastMessage('answer:' + requestId, handleResponse);

				return sender;
			} catch (e) {
				return browser.runtime.sendMessage(
					browser.runtime.id,
					{type, data, respondTo: 'promise'},
				);
			}
		})();

		if (messagePromise instanceof Promise) {
			handleResponse(await messagePromise);
		}
	} catch (e) {
		reject(e);
	}
});
