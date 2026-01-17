'use background';
import {milliSeconds} from '../tools/milliSeconds';
import {triggerPromise} from '../tools/triggerPromise';
import {connectionSpeedItem} from './connectionSpeed';
import OnBeforeRequestDetails = chrome.webRequest.OnBeforeRequestDetails;
import OnCompletedDetails = chrome.webRequest.OnCompletedDetails;

const SPEED_SAMPLE_MS = milliSeconds.fromSeconds(1);
const speedTextEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const speedStats = {
	downloadBytes: 0,
	uploadBytes: 0,
	lastDownloadBytes: 0,
	lastUploadBytes: 0,
	lastSampleTime: Date.now(),
};

let speedListenersAdded = false;

const resetSpeedStats = () => {
	speedStats.downloadBytes = 0;
	speedStats.uploadBytes = 0;
	speedStats.lastDownloadBytes = 0;
	speedStats.lastUploadBytes = 0;
	speedStats.lastSampleTime = Date.now();
};

const getHeaderValue = (headers: chrome.webRequest.HttpHeader[] | undefined, headerName: string): string => {
	if (!headers) {
		return '';
	}

	const target = headerName.toLowerCase();
	const match = headers.find(header => header.name?.toLowerCase() === target);

	return match?.value || '';
};

const getHeaderBytes = (headers: chrome.webRequest.HttpHeader[] | undefined, headerName: string): number => {
	const value = Number.parseInt(getHeaderValue(headers, headerName), 10);

	return Number.isFinite(value) && value > 0 ? value : 0;
};

const getContentRangeBytes = (headers: chrome.webRequest.HttpHeader[] | undefined): number => {
	const raw = getHeaderValue(headers, 'content-range');

	if (!raw) {
		return 0;
	}

	const match = /bytes\s+(\d+)-(\d+)\//i.exec(raw);
	const startRaw = match?.[1];
	const endRaw = match?.[2];

	if (!startRaw || !endRaw) {
		return 0;
	}

	const start = Number.parseInt(startRaw, 10);
	const end = Number.parseInt(endRaw, 10);

	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		return 0;
	}

	return end - start + 1;
};

const isFormDataString = (value: chrome.webRequest.FormDataItem): value is string => typeof value === 'string';

const maybeEmitSpeed = () => {
	const now = Date.now();
	const elapsed = now - speedStats.lastSampleTime;

	if (elapsed < SPEED_SAMPLE_MS) {
		return;
	}

	const downloadDelta = speedStats.downloadBytes - speedStats.lastDownloadBytes;
	const uploadDelta = speedStats.uploadBytes - speedStats.lastUploadBytes;
	const downloadPerSecond = (downloadDelta * 1000) / Math.max(1, elapsed);
	const uploadPerSecond = (uploadDelta * 1000) / Math.max(1, elapsed);

	speedStats.lastSampleTime = now;
	speedStats.lastDownloadBytes = speedStats.downloadBytes;
	speedStats.lastUploadBytes = speedStats.uploadBytes;
	triggerPromise(connectionSpeedItem.setValue({downloadPerSecond, uploadPerSecond}));
};

const recordDownloadBytes = (details: OnCompletedDetails): void => {
	if (details.tabId < 0 || details.fromCache) {
		return;
	}

	let bytes = getHeaderBytes(details.responseHeaders, 'content-length');

	if (!bytes) {
		bytes = getContentRangeBytes(details.responseHeaders);
	}

	if (bytes > 0) {
		speedStats.downloadBytes += bytes;
		maybeEmitSpeed();
	}
};

const recordUploadBytes: (
	details: OnBeforeRequestDetails,
) => chrome.webRequest.BlockingResponse | undefined = (details) => {
	if (details.tabId < 0) {
		return undefined;
	}

	let bytes = 0;
	const body = details.requestBody;

	if (body?.raw?.length) {
		body.raw.forEach(item => {
			if (item.bytes) {
				bytes += item.bytes.byteLength;
			}
		});
	} else if (body?.formData) {
		Object.values(body.formData).forEach(values => {
			values.forEach(value => {
				if (isFormDataString(value)) {
					bytes += speedTextEncoder ? speedTextEncoder.encode(value).length : value.length;
				} else {
					bytes += value.byteLength;
				}
			});
		});
	}

	if (bytes > 0) {
		speedStats.uploadBytes += bytes;
		maybeEmitSpeed();
	}

	return undefined;
};

const attachSpeedListeners = (webRequest: typeof chrome.webRequest) => {
	if (speedListenersAdded) {
		return;
	}

	speedListenersAdded = true;
	const filter: chrome.webRequest.RequestFilter = {
		urls: ['http://*/*', 'https://*/*'],
	};

	webRequest.onCompleted?.addListener(recordDownloadBytes, filter, ['responseHeaders']);
	webRequest.onBeforeRequest?.addListener(recordUploadBytes, filter, ['requestBody']);
};

export const initConnectionSpeed = (): void => {
	const webRequest = (browser as any as typeof chrome).webRequest;

	if (!webRequest) {
		return;
	}

	attachSpeedListeners(webRequest);
	resetSpeedStats();
	triggerPromise(connectionSpeedItem.setValue({downloadPerSecond: 0, uploadPerSecond: 0}));
};
