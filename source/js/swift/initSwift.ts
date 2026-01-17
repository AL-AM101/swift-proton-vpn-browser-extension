'use background';
import type {SwiftRule} from './swiftRules';
import {
	swiftDisconnectOnUnmatchedItem,
	swiftEnabledItem,
	swiftRulesItem,
} from './swiftRules';
import {swiftDebugItem, type SwiftDebugEvent} from './swiftDebug';
import {swiftActiveRuleItem, type SwiftActiveRule} from './swiftActive';
import {
	buildSwiftHostLabel,
	getSwiftUrlParts,
	normalizeSwiftPath,
	selectSwiftRule,
} from './swiftRuleMatching';
import {storagePrefix} from '../tools/storage';
import {triggerPromise} from '../tools/triggerPromise';
import {
	connectLogical,
	disconnect,
	getCurrentState,
	isCurrentStateConnected,
	waitForReadyState,
} from '../state';
import {getSortedLogicals} from '../vpn/getLogicals';
import {lookupLogical} from '../vpn/lookupLogical';
import {pickServerInLogical} from '../vpn/pickServerInLogical';
import {getUser} from '../account/user/getUser';
import {getUserMaxTier} from '../account/user/getUserMaxTier';
import {filterLogicalsWithCurrentFeatures} from '../vpn/filterLogicalsWithCurrentFeatures';
import {requireBestLogical} from '../vpn/getLogical';
import {storedSecureCore} from '../vpn/storedSecureCore';
import {storedSplitTunneling} from '../vpn/storedSplitTunneling';
import {secureCoreEnabled} from '../config';
import {getSplitTunnelingConfig} from '../vpn/getSplitTunnelingConfig';
import {warn} from '../log/log';
import Tab = browser.tabs.Tab;

type SwiftTabChangeInfo = {
	url?: string;
	status?: string;
};


export const initSwift = () => {
	global.browser || ((global as any).browser = chrome);

	const swiftRulesStorageKey = storagePrefix + swiftRulesItem.key;
	const swiftEnabledStorageKey = storagePrefix + swiftEnabledItem.key;
	const swiftDisconnectStorageKey = storagePrefix + swiftDisconnectOnUnmatchedItem.key;
	let swiftRules: SwiftRule[] = [];
	let swiftRulesLoaded = false;
	let swiftRulesLoading: Promise<void> | null = null;
	let swiftEnabled = true;
	let swiftEnabledLoaded = false;
	let swiftEnabledLoading: Promise<void> | null = null;
	let swiftDisconnectOnUnmatched = false;
	let swiftDisconnectLoaded = false;
	let swiftDisconnectLoading: Promise<void> | null = null;
	let swiftActiveRule: SwiftActiveRule | null = null;
	const lastRuleByTab = new Map<number, string>();
	let lastDebugEventKey = '';

	const setSwiftDebug = (event: SwiftDebugEvent) => {
		const key = `${event.action}|${event.host || ''}|${event.ruleId || ''}|${event.detail || ''}`;

		if (key === lastDebugEventKey) {
			return;
		}

		lastDebugEventKey = key;
		triggerPromise(swiftDebugItem.set({value: event}));
	};

	const setSwiftActiveRule = (rule: SwiftRule) => {
		swiftActiveRule = {
			ruleId: rule.id,
			host: rule.host,
			path: rule.path,
			targetType: rule.targetType,
			targetId: rule.targetId,
			targetLabel: rule.targetLabel,
			time: Date.now(),
		};
		triggerPromise(swiftActiveRuleItem.set({value: swiftActiveRule}));
	};

	const clearSwiftActiveRule = () => {
		swiftActiveRule = null;
		triggerPromise(swiftActiveRuleItem.set({value: null}));
	};

	const loadSwiftRules = async () => {
		const storedRules = (await swiftRulesItem.get())?.value || [];
		swiftRules = storedRules.map(rule => ({
			...rule,
			path: normalizeSwiftPath(rule.path),
			enabled: rule.enabled !== false,
		}));
	};

	const loadSwiftEnabled = async () => {
		const stored = await swiftEnabledItem.get();

		if (typeof stored?.value === 'boolean') {
			swiftEnabled = stored.value;

			return;
		}

		swiftEnabled = true;
		triggerPromise(swiftEnabledItem.set({value: true}));
	};

	const loadSwiftDisconnectOnUnmatched = async () => {
		const stored = await swiftDisconnectOnUnmatchedItem.get();

		if (typeof stored?.value === 'boolean') {
			swiftDisconnectOnUnmatched = stored.value;

			return;
		}

		swiftDisconnectOnUnmatched = false;
		triggerPromise(swiftDisconnectOnUnmatchedItem.set({value: false}));
	};

	const ensureSwiftRulesLoaded = async () => {
		if (swiftRulesLoaded) {
			return;
		}

		if (!swiftRulesLoading) {
			swiftRulesLoading = loadSwiftRules().finally(() => {
				swiftRulesLoaded = true;
				swiftRulesLoading = null;
			});
		}

		await swiftRulesLoading;
	};

	const ensureSwiftEnabledLoaded = async () => {
		if (swiftEnabledLoaded) {
			return;
		}

		if (!swiftEnabledLoading) {
			swiftEnabledLoading = loadSwiftEnabled().finally(() => {
				swiftEnabledLoaded = true;
				swiftEnabledLoading = null;
			});
		}

		await swiftEnabledLoading;
	};

	const ensureSwiftDisconnectLoaded = async () => {
		if (swiftDisconnectLoaded) {
			return;
		}

		if (!swiftDisconnectLoading) {
			swiftDisconnectLoading = loadSwiftDisconnectOnUnmatched().finally(() => {
				swiftDisconnectLoaded = true;
				swiftDisconnectLoading = null;
			});
		}

		await swiftDisconnectLoading;
	};

	const applySwiftRule = async (rule: SwiftRule): Promise<{connected: boolean, reason: string}> => {
		await waitForReadyState();

		const state = getCurrentState()?.data;

		if (rule.targetType === 'server' && state?.server?.id === rule.targetId) {
			return {connected: false, reason: 'already-connected'};
		}

		if (rule.targetType === 'country' && state?.server?.exitCountry === rule.targetId) {
			return {connected: false, reason: 'already-connected'};
		}

		const user = await getUser(true);

		if (!user) {
			return {connected: false, reason: 'no-user'};
		}

		const userTier = getUserMaxTier(user);
		const logicals = await getSortedLogicals();
		const secureCore = secureCoreEnabled ? await storedSecureCore.getDefined({value: false}) : undefined;

		const logical = await (async () => {
			if (rule.targetType === 'server') {
				const nameMatch = rule.targetLabel?.toLowerCase();
				const byId = logicals.find(item => `${item.ID}` === rule.targetId);
				const byName = nameMatch
					? logicals.find(item => item.Name.toLowerCase() === nameMatch)
					: undefined;
				const lookedUp = (!byId && !byName && rule.targetLabel)
					? await lookupLogical(rule.targetLabel)
					: undefined;
				const candidates = [byId, byName, lookedUp].filter(Boolean) as typeof logicals;
				const filtered = filterLogicalsWithCurrentFeatures(candidates, userTier, secureCore)
					.filter(item => item.Tier <= userTier);

				return filtered[0];
			}

			const inCountry = logicals.filter(item => item.ExitCountry === rule.targetId);
			const filtered = filterLogicalsWithCurrentFeatures(inCountry, userTier, secureCore)
				.filter(item => item.Tier <= userTier);

			if (!filtered.length) {
				return undefined;
			}

			return requireBestLogical(filtered, userTier);
		})();

		if (!logical) {
			return {
				connected: false,
				reason: rule.targetType === 'server' ? 'server-not-available' : 'country-not-available',
			};
		}

		const server = pickServerInLogical(logical);

		if (!server) {
			return {connected: false, reason: 'no-server-up'};
		}

		const splitTunneling = await storedSplitTunneling.getDefined({value: []});
		await connectLogical(
			logical,
			server,
			getSplitTunnelingConfig(userTier, splitTunneling),
			{suppressNotification: true},
		);
		return {connected: true, reason: 'connected'};
	};

	const handleUrlForTab = async (tabId: number, url: string) => {
		if (!url || !/^https?:/i.test(url)) {
			return;
		}

		const parts = getSwiftUrlParts(url);

		if (!parts) {
			setSwiftDebug({
				time: Date.now(),
				action: 'error',
				detail: 'invalid-host',
			});
			return;
		}

		const {host, path} = parts;
		const hostLabel = buildSwiftHostLabel(host, path === '/' ? undefined : path);

		await ensureSwiftEnabledLoaded();

		if (!swiftEnabled) {
			setSwiftDebug({
				time: Date.now(),
				action: 'skip',
				host: hostLabel,
				detail: 'disabled',
			});

			return;
		}

		await ensureSwiftRulesLoaded();
		await ensureSwiftDisconnectLoaded();

		const activeRules = swiftRules.filter(rule => rule.enabled !== false);

		if (!activeRules.length) {
			setSwiftDebug({
				time: Date.now(),
				action: 'no-rules',
				host: hostLabel,
			});
			return;
		}

		const {rule, matchingRules} = selectSwiftRule(activeRules, parts);
		const ruleLabel = rule ? buildSwiftHostLabel(rule.host, rule.path) : undefined;

		if (!rule) {
			const currentState = getCurrentState()?.data;
			const isSwiftConnection = !!(swiftActiveRule && (swiftActiveRule.targetType === 'server'
				? currentState?.server?.id === swiftActiveRule.targetId
				: currentState?.server?.exitCountry === swiftActiveRule.targetId));

			if (swiftActiveRule && !isSwiftConnection) {
				clearSwiftActiveRule();
			}

			if (swiftDisconnectOnUnmatched && isCurrentStateConnected() && isSwiftConnection) {
				disconnect();
				clearSwiftActiveRule();
				setSwiftDebug({
					time: Date.now(),
					action: 'disconnect',
					host: hostLabel,
					detail: 'no-rule',
				});
			} else {
				setSwiftDebug({
					time: Date.now(),
					action: 'no-rule',
					host: hostLabel,
				});
			}
			lastRuleByTab.delete(tabId);

			return;
		}

		const state = getCurrentState()?.data;
		const alreadyConnected = rule.targetType === 'server'
			? state?.server?.id === rule.targetId
			: state?.server?.exitCountry === rule.targetId;

		if (lastRuleByTab.get(tabId) === rule.id && alreadyConnected) {
			return;
		}

		try {
			setSwiftDebug({
				time: Date.now(),
				action: 'match',
				host: hostLabel,
				ruleId: rule.id,
				ruleHost: ruleLabel,
				target: `${rule.targetType}:${rule.targetLabel}`,
				detail: matchingRules.length > 1 ? 'multiple-rules' : undefined,
			});

			const result = await applySwiftRule(rule);

			setSwiftDebug({
				time: Date.now(),
				action: result.connected ? 'connect' : 'skip',
				host: hostLabel,
				ruleId: rule.id,
				ruleHost: ruleLabel,
				target: `${rule.targetType}:${rule.targetLabel}`,
				detail: result.reason,
			});

			if (result.connected || result.reason === 'already-connected') {
				lastRuleByTab.set(tabId, rule.id);
				setSwiftActiveRule(rule);
			}
		} catch (error) {
			warn(error);
			setSwiftDebug({
				time: Date.now(),
				action: 'error',
				host,
				ruleId: rule.id,
				ruleHost: rule.host,
				target: `${rule.targetType}:${rule.targetLabel}`,
				detail: `${error}`,
			});
		}
	};

	const handleTabUpdate = async (tabId: number, changeInfo: SwiftTabChangeInfo, tab: Tab) => {
		const url = changeInfo.url || tab.url;

		if (url) {
			await handleUrlForTab(tabId, url);

			return;
		}

		if (changeInfo.status === 'complete') {
			const latest = await browser.tabs.get(tabId);

			if (latest?.url) {
				await handleUrlForTab(tabId, latest.url);
			}
		}
	};

	const checkActiveTabs = async () => {
		const tabs = await browser.tabs.query({active: true, lastFocusedWindow: true});

		for (const tab of tabs) {
			if (tab.id && tab.url) {
				await handleUrlForTab(tab.id, tab.url);
			}
		}
	};

	triggerPromise(ensureSwiftRulesLoaded());
	triggerPromise(ensureSwiftEnabledLoaded());
	triggerPromise(ensureSwiftDisconnectLoaded());
	triggerPromise((async () => {
		await ensureSwiftEnabledLoaded();
		await ensureSwiftRulesLoaded();
		await ensureSwiftDisconnectLoaded();

		if (!swiftEnabled || !swiftRules.length) {
			return;
		}

		await checkActiveTabs();
	})());

	chrome.storage.onChanged.addListener(async (changes, areaName) => {
		try {
			if (areaName !== 'local') {
				return;
			}

			if (changes[swiftRulesStorageKey]) {
				const nextValue = changes[swiftRulesStorageKey]?.newValue as {value: SwiftRule[]} | undefined;
				swiftRules = nextValue?.value || [];
				swiftRules = swiftRules.map(rule => ({
					...rule,
					path: normalizeSwiftPath(rule.path),
					enabled: rule.enabled !== false,
				}));
				swiftRulesLoaded = true;
				lastRuleByTab.clear();
				const active = (await swiftActiveRuleItem.get())?.value || null;
				if (active && !swiftRules.some(rule => rule.id === active.ruleId && rule.enabled !== false)) {
					clearSwiftActiveRule();
				}
				await checkActiveTabs();
			}

			if (changes[swiftEnabledStorageKey]) {
				const nextValue = changes[swiftEnabledStorageKey]?.newValue as {value: boolean} | undefined;
				swiftEnabled = nextValue?.value ?? true;
				swiftEnabledLoaded = true;
				lastRuleByTab.clear();

				if (swiftEnabled) {
					await checkActiveTabs();
				}
			}

			if (changes[swiftDisconnectStorageKey]) {
				const nextValue = changes[swiftDisconnectStorageKey]?.newValue as {value: boolean} | undefined;
				swiftDisconnectOnUnmatched = nextValue?.value ?? false;
				swiftDisconnectLoaded = true;

				if (swiftEnabled && swiftRules.length) {
					await checkActiveTabs();
				}
			}
		} catch (error) {
			warn(error);
		}
	});

	browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
		try {
			await handleTabUpdate(tabId, changeInfo, tab);
		} catch (error) {
			warn(error);
		}
	});

	browser.tabs.onActivated.addListener(async (activeInfo: {tabId: number}) => {
		try {
			const tab = await browser.tabs.get(activeInfo.tabId);

			if (tab?.url) {
				await handleUrlForTab(activeInfo.tabId, tab.url);
			}
		} catch (error) {
			warn(error);
		}
	});

	const handleWebRequest = (
		details: {url: string, tabId: number, type?: string},
	): chrome.webRequest.BlockingResponse | undefined => {
			if (details.tabId < 0) {
				return undefined;
			}

			if (details.type && details.type !== 'main_frame') {
				return undefined;
			}

			triggerPromise(handleUrlForTab(details.tabId, details.url));

			return undefined;
	};

	chrome.webRequest.onBeforeRequest.addListener(
		handleWebRequest,
		{urls: ['http://*/*', 'https://*/*'], types: ['main_frame']},
	);

	browser.tabs.onRemoved.addListener((tabId: number) => {
		lastRuleByTab.delete(tabId);
	});
};
