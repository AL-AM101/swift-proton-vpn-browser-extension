import {routeMessage} from '../messaging/messaging';
import {RefreshTokenError} from '../account/RefreshTokenError';
import {logOut} from '../state';
import {createSession} from '../account/createSession';
import {BackgroundAction} from '../messaging/MessageType';
import {ForkMessage, MessageBase} from '../messaging/Message';
import {forkSession} from '../messaging/forkSession';
import {triggerPromise} from '../tools/triggerPromise';
import {executeOnTab} from '../tools/executeOnTab';
import {getPartnerById} from '../account/partner/partners';
import {delay} from '../tools/delay';
import {ForkResponse} from '../messaging/ForkResponse';
import Tab = browser.tabs.Tab;

type WorkerExternalMessage = MessageBase & (
	| {
		type: undefined;
	}
	| ForkMessage
);

const getMessageResponse = async (message: any) => {
	try {
		return await routeMessage(message);
	} catch (error) {
		if (error instanceof RefreshTokenError) {
			logOut(false);
			await createSession();

			return {error};
		}

		return {error};
	}
};

export const initMessaging = () => {
	global.browser || ((global as any).browser = chrome);

	browser.runtime.onMessage.addListener((message: any) => {
		const promise = new Promise(async resolve => {
			const result = await getMessageResponse(message);

			resolve({
				received: true,
				success: !result || !(typeof result === 'object' && (result as any).error),
				result,
			});
		});

		if (message.respondTo === 'broadcast') {
			promise.then(response => {
				triggerPromise(browser.runtime.sendMessage(
					browser.runtime.id,
					{
						type: 'answer:' + message.requestId,
						respondTo: 'none',
						data: (() => {
							try {
								return JSON.parse(JSON.stringify(response));
							} catch (error) {
								return {result: {error: `${error}`}};
							}
						})(),
					},
				));
			});

			return undefined;
		}

		return promise;
	});

	/**
	 * Consumes a session fork request and sends response
	 * to sender (account app) - to see full data flow :
	 * `applications/account/src/app/content/PublicApp.tsx`
	 */
	browser.runtime.onMessageExternal.addListener(
		(request: WorkerExternalMessage, sender, sendResponse) => {
			if (request.type !== BackgroundAction.FORK) {
				return;
			}

			let responded = false;
			const respond = (response: ForkResponse | undefined) => {
				if (responded) {
					return;
				}

				responded = true;
				sendResponse(response);
			};

			(async () => {
				const response = await forkSession(request);

				respond(response);

				const welcomePage = response?.partnerId
					? getPartnerById(response.partnerId)?.welcomePage
					: undefined;
				const tabId = (sender.tab as Tab | undefined)?.id;

				if (welcomePage && typeof tabId === 'number') {
					triggerPromise((async () => {
						await executeOnTab(
							tabId,
							() => ({
								func(welcomePage: string) {
									location.href = welcomePage;
								},
								args: [welcomePage] as [string],
							}),
							() => `location.href = ${JSON.stringify(welcomePage)};`,
						);
						// Let the page load without blocking the response.
						await delay(500);
					})());
				}
			})().catch(error => {
				respond({
					type: 'error',
					payload: {message: `${error}`},
				});
			});

			return true;
		}
	);
};
