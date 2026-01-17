'use background';
import {triggerPromise} from '../tools/triggerPromise';
import {getSwiftUrlParts, selectSwiftRule} from './swiftRuleMatching';
import {swiftBlockedSiteItem} from './swiftBlockedSite';
import {swiftRulesItem} from './swiftRules';
import OnBeforeRequestDetails = chrome.webRequest.OnBeforeRequestDetails;
import OnCompletedDetails = chrome.webRequest.OnCompletedDetails;
import OnErrorOccurredDetails = chrome.webRequest.OnErrorOccurredDetails;

const BLOCKED_STATUS_CODES = new Set([403, 451]);
const BLOCKED_ERROR_CODES = new Set([
	'ERR_NAME_NOT_RESOLVED',
	'ERR_CONNECTION_TIMED_OUT',
	'ERR_CONNECTION_FAILED',
	'ERR_CONNECTION_RESET',
	'ERR_CONNECTION_REFUSED',
	'ERR_ADDRESS_UNREACHABLE',
	'ERR_TUNNEL_CONNECTION_FAILED',
	'ERR_PROXY_CONNECTION_FAILED',
]);
const IGNORE_ERROR_CODES = new Set([
	'ERR_ABORTED',
	'ERR_BLOCKED_BY_CLIENT',
	'ERR_BLOCKED_BY_ADMINISTRATOR',
]);

const isHttpUrl = (url: string): boolean => url.startsWith('http://') || url.startsWith('https://');

const MAX_TRACKED_AGE_MS = 5 * 60 * 1000;
const lastMainFrameByTab = new Map<number, {url: string; time: number}>();

const normalizeErrorCode = (raw: string): string => raw.replace(/^net::/i, '').trim();

const isLikelyBlockedError = (rawError?: string): boolean => {
	if (!rawError) {
		return false;
	}

	const code = normalizeErrorCode(rawError);

	if (IGNORE_ERROR_CODES.has(code)) {
		return false;
	}

	return BLOCKED_ERROR_CODES.has(code);
};

const isAlreadyCoveredBySwiftRule = async (url: string): Promise<boolean> => {
	const parts = getSwiftUrlParts(url);

	if (!parts) {
		return true;
	}

	const rules = (await swiftRulesItem.get())?.value || [];
	if (!rules.length) {
		return false;
	}

	return !!selectSwiftRule(rules, parts).rule;
};

const resolveUrl = (url: string | undefined, tabId: number | undefined): string | null => {
	if (url && isHttpUrl(url)) {
		return url;
	}

	if (typeof tabId !== 'number') {
		return null;
	}

	const entry = lastMainFrameByTab.get(tabId);

	if (!entry) {
		return null;
	}

	if (Date.now() - entry.time > MAX_TRACKED_AGE_MS) {
		lastMainFrameByTab.delete(tabId);
		return null;
	}

	return entry.url;
};

const recordBlockedSite = async (payload: {
	url?: string;
	statusCode?: number;
	error?: string;
	tabId?: number;
}): Promise<void> => {
	const resolvedUrl = resolveUrl(payload.url, payload.tabId);

	if (!resolvedUrl) {
		return;
	}

	if (await isAlreadyCoveredBySwiftRule(resolvedUrl)) {
		return;
	}

	const parts = getSwiftUrlParts(resolvedUrl);

	if (!parts) {
		return;
	}

	await swiftBlockedSiteItem.set({
		value: {
			host: parts.host,
			url: resolvedUrl,
			time: Date.now(),
			statusCode: payload.statusCode,
			error: payload.error,
		},
	});
};

const onBeforeRequest = (details: OnBeforeRequestDetails): chrome.webRequest.BlockingResponse | undefined => {
	if (details.tabId < 0) {
		return undefined;
	}

	if (details.type && details.type !== 'main_frame') {
		return undefined;
	}

	if (!isHttpUrl(details.url)) {
		return undefined;
	}

	lastMainFrameByTab.set(details.tabId, {url: details.url, time: Date.now()});
	return undefined;
};

const onCompleted = (details: OnCompletedDetails): void => {
	if (!details?.statusCode || !BLOCKED_STATUS_CODES.has(details.statusCode)) {
		return;
	}

	triggerPromise(recordBlockedSite({
		url: details.url,
		statusCode: details.statusCode,
		tabId: details.tabId,
	}));
};

const onErrorOccurred = (details: OnErrorOccurredDetails): void => {
	if (!isLikelyBlockedError(details?.error)) {
		return;
	}

	triggerPromise(recordBlockedSite({
		url: details.url,
		error: details.error,
		tabId: details.tabId,
	}));
};

export const initSwiftBlockedSite = (): void => {
	const webRequest = (browser as any as typeof chrome).webRequest;

	if (!webRequest) {
		return;
	}

	const filter: chrome.webRequest.RequestFilter = {
		urls: ['<all_urls>'],
		types: ['main_frame'],
	};

	webRequest.onBeforeRequest?.addListener(onBeforeRequest, filter);
	webRequest.onCompleted?.addListener(onCompleted, filter);
	webRequest.onErrorOccurred?.addListener(onErrorOccurred, filter);
};
