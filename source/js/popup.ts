'use popup';
import type {Logical} from './vpn/Logical';
import {getLastConnectedServer} from './vpn/lastConnectedServer';
import {getLogicalById, getSortedLogicals, isLogicalUp, lookups} from './vpn/getLogicals';
import {readSession} from './account/readSession';
import {sendMessageToBackground} from './tools/sendMessageToBackground';
import {getInfoFromBackground} from './tools/getInfoFromBackground';
import {startSession} from './account/createSession';
import {
	c,
	fetchTranslations,
	getLanguage,
	getCountryName,
	getCountryNameOrCode,
	getHashSeed,
	getPreferredLanguage,
	getQuerySeed,
	getTranslation,
	setPreferredLanguage,
	translateArea,
} from './tools/translate';
import {escapeHtml} from './tools/escapeHtml';
import {type ApiError, isUnauthorizedError} from './api';
import {saveSession} from './account/saveSession';
import type {User} from './account/user/User';
import type {PmUser} from './account/user/PmUser';
import {getUserMaxTier} from './account/user/getUserMaxTier';
import {
	accountURL,
	autoConnectEnabled,
	manageAccountURL,
	secureCoreEnabled,
	secureCoreQuickButtonEnabled,
	simplifiedUi,
	splitTunnelingEnabled,
} from './config';
import {refreshLocationSlots} from './account/refreshLocationSlots';
import {getAllLogicals, getBestLogical, requireBestLogical, requireRandomLogical} from './vpn/getLogical';
import {getCities, mergeTranslations} from './vpn/getCities';
import {setUpSearch} from './search/setUpSearch';
import {countryList, type CountryList} from './components/countryList';
import {serverList} from './components/serverList';
import {configureServerGroups} from './components/configureServerGroups';
import {configureLookupSearch} from './components/configureLookupSearch';
import {storage, storagePrefix} from './tools/storage';
import {showNotifications} from './notifications/showNotifications';
import {watchBroadcastMessages} from './tools/answering';
import type {ChangeStateMessage} from './tools/broadcastMessage';
import {getErrorMessage} from './tools/getErrorMessage';
import type {ConnectionState, ErrorDump, ServerSummary} from './vpn/ConnectionState';
import {Feature} from './vpn/Feature';
import {getCountryFlag} from './tools/getCountryFlag';
import {each} from './tools/each';
import {logo} from './tools/logo';
import {type Choice, setLastChoice} from './vpn/lastChoice';
import {ucfirst} from './tools/ucfirst';
import {toggleButtons} from './components/toggleButtons';
import {triggerPromise} from './tools/triggerPromise';
import {BackgroundData, SettingChange, StateChange} from './messaging/MessageType';
import {showSigningView} from './components/signIn/showSigningView';
import {delay, timeoutAfter} from './tools/delay';
import {proxyPermission} from './vpn/proxyPermission';
import {
	getTelemetryOptIn,
	isTelemetryFeatureEnabled,
	telemetryOptIn,
} from './tools/telemetry';
import {leaveWindowForTab, openTab} from './tools/openTab';
import {getSearchResult} from './search/getSearchResult';
import {upsell} from './tools/upsell';
import {forgetAccount} from './account/forgetAccount';
import {hideIf} from './tools/hideIf';
import {getCurrentTab} from './tools/getCurrentTab';
import {storedPreventWebrtcLeak} from './webrtc/storedPreventWebrtcLeak';
import {preventLeak} from './webrtc/preventLeak';
import {setWebRTCState} from './webrtc/setWebRTCState';
import {WebRTCState} from './webrtc/state';
import {via} from './components/via';
import {configureSplitTunneling} from './components/configureSplitTunneling';
import {getSplitTunnelingConfig} from './vpn/getSplitTunnelingConfig';
import {storedSplitTunneling} from './vpn/storedSplitTunneling';
import {warn} from './log/log';
import {storedNotificationsEnabled} from './notifications/notificationsEnabled';
import {storedSecureCore} from './vpn/storedSecureCore';
import {storedAutoConnect} from './vpn/storedAutoConnect';
import {canAccessPaidServers} from './account/user/canAccessPaidServers';
import {RefreshTokenError} from './account/RefreshTokenError';
import {requireUser} from './account/requireUser';
import {getPmUserFromPopup} from './account/user/getPmUserFromPopup';
import {pickServerInLogical} from './vpn/pickServerInLogical';
import {milliSeconds} from './tools/milliSeconds';
import {appendUrlParams} from './tools/appendUrlParams';
import {crashReportOptIn, getCrashReportOptIn, handleError} from './tools/sentry';
import {connectEventHandler} from './tools/connectEventHandler';
import {getPrefillValues} from './tools/prefill';
import {toggleClass} from './tools/toggleClass';
import {ServerRotator} from './vpn/ServerRotator';
import {configureGoToButtons} from './components/goToButton';
import {updateAccessSentenceWithCounts} from './components/accessSentence';
import {configureLinks, setNewTabLinkTitle} from './components/links';
import {closeModal, configureModalButtons, showModal} from './components/modals/modals';
import {configureRatingModalButtons, maybeShowRatingModal} from './components/modals/ratingModal';
import {setReviewInfoStateOnConnectAction} from './vpn/reviewInfo';
import {filterLogicalsWithCurrentFeatures} from './vpn/filterLogicalsWithCurrentFeatures';
import {
	swiftDisconnectOnUnmatchedItem,
	swiftEnabledItem,
	swiftRulesItem,
	type SwiftRule,
	type SwiftTargetType,
} from './swift/swiftRules';
import {swiftDebugItem, type SwiftDebugEvent} from './swift/swiftDebug';
import {swiftHeartbeatItem, type SwiftHeartbeat} from './swift/swiftHeartbeat';
import {buildSwiftHostLabel, getSwiftUrlParts, normalizeSwiftPath, parseSwiftUrlInput, selectSwiftRule} from './swift/swiftRuleMatching';
import {swiftBlockedSiteItem, type SwiftBlockedSite} from './swift/swiftBlockedSite';
import {resolveSwiftTarget} from './swift/swiftTargetResolver';
import {connectionSpeedItem, type ConnectionSpeed} from './vpn/connectionSpeed';

const state = {
	connected: false,
	restarted: false,
};

let searchInput: HTMLInputElement | null = null;

type Theme = 'dark' | 'light' | 'auto';

const start = async () => {
	await fetchTranslations();
	const primaryLanguage = `${getLanguage() || ''}`.split(/[_-]/)[0];
	const isRtlLanguage = primaryLanguage === 'ar';
	document.body?.classList.toggle('lang-rtl', isRtlLanguage);

	const spinner = document.getElementById('spinner');
	const loggedView = document.getElementById('logged-view');

	if (!chrome.proxy) {
		showSigningView(document.getElementById('sign-in-view'), loggedView, spinner, false);

		return;
	}

	const proxySupported: boolean = await new Promise(resolve => {
		chrome.permissions.contains(proxyPermission, (ok) => {
			if (!ok) {
				showSigningView(document.getElementById('sign-in-view'), loggedView, spinner, false);
			}

			resolve(ok);
		});
	});

	hideIf({
		'.secure-core-action-block': !secureCoreEnabled,
		'.secure-core-container': !(secureCoreEnabled && secureCoreQuickButtonEnabled),
		'.split-tunneling-action-block': !splitTunnelingEnabled,
		'.auto-connect-action-block': !autoConnectEnabled,
	});

	let theme: Theme = 'dark';

	const setTheme = (theme: Theme) => {
		const themes = ['dark', 'light', 'auto'];

		themes.forEach(choice => {
			document.querySelectorAll<HTMLInputElement>('[name="theme"][value="' + choice + '"]').forEach(input => {
				input.checked = (choice === theme);
			});
		});

		if (!document.body.classList.contains(theme + '-theme')) {
			themes.forEach(choice => {
				document.body.classList[choice === theme ? 'add' : 'remove'](choice + '-theme');
			});
		}
	};

	const storedTheme = storage.item<{value: Theme}>('theme');
	storedTheme.get().then(themeCache => {
		theme = themeCache?.value || theme;
		setTheme(theme);
	});

	const languageSelect = document.getElementById('language-preference') as HTMLSelectElement | null;
	if (languageSelect) {
		const preferredLanguage = getPreferredLanguage();
		languageSelect.value = preferredLanguage || '';
		languageSelect.addEventListener('change', async () => {
			const nextLanguage = languageSelect.value || null;
			await setPreferredLanguage(nextLanguage);
			window.location.reload();
		});
	}

	const widthInput = document.getElementById('popup-width') as HTMLInputElement | null;
	const widthValue = document.getElementById('popup-width-value') as HTMLSpanElement | null;
	const storedPopupWidth = storage.item<{value: number}>('popup-width');

	const applyPopupWidth = (width: number) => {
		const min = widthInput ? Number(widthInput.min) || 300 : 300;
		const max = widthInput ? Number(widthInput.max) || 380 : 380;
		const base = Number.isFinite(width) ? width : 330;
		const clamped = Math.min(max, Math.max(min, base));

		document.documentElement.style.setProperty('--popup-width', `${clamped}px`);

		if (widthInput) {
			widthInput.value = `${clamped}`;
		}

		if (widthValue) {
			widthValue.textContent = `${clamped}px`;
		}
	};

	storedPopupWidth.get().then(widthCache => {
		if (typeof widthCache?.value === 'number') {
			applyPopupWidth(widthCache.value);
			return;
		}

		applyPopupWidth(widthInput ? Number(widthInput.value) : 330);
	});

	if (widthInput) {
		widthInput.addEventListener('input', () => {
			const nextWidth = Number(widthInput.value);
			applyPopupWidth(nextWidth);
			storedPopupWidth.set({value: nextWidth});
		});
	}

	const session = await readSession();

	if (!session.uid || !session.refreshToken) {
		try {
			if (!await startSession(session)) {
				return;
			}
		} catch (e) {
			warn(e);
		}
	}

	const modalErrorSlot = document.getElementById('modal-error') as HTMLDivElement;

	modalErrorSlot.querySelector('.close-button')?.addEventListener('click', () => {
		const id = modalErrorSlot.getAttribute('data-error-id');
		const restartOnClose = Number(modalErrorSlot.getAttribute('data-error-restart-on-close'));

		if (id) {
			triggerPromise(storage.setItem('closed-' + id, {value: 1}));
		}

		modalErrorSlot.style.display = 'none';

		if (restartOnClose) {
			showSigningView(document.getElementById('sign-in-view'), loggedView, spinner, proxySupported);
		}
	});

	const errorSlot = document.querySelector('.error-slot') as HTMLDivElement;

	let currentRegionState: {name: string, content: string} | undefined = undefined;

	const setRegionPage = (name: string, content: string) => {
		currentRegionState = {name, content};

		const nameSlot = document.querySelector<HTMLDivElement>('[data-page="region"] .page-title .name');
		const regionSlot = document.querySelector<HTMLDivElement>('[data-page="region"] .region-content');

		if (nameSlot) {
			nameSlot.innerHTML = name;
		}

		if (regionSlot && content) {
			regionSlot.innerHTML = content;
			configureButtons(regionSlot);
			configureGoToButtons(regionSlot, goTo);
			configureServerGroups(regionSlot);
			configureFavoriteButtons(regionSlot);
			syncFavoriteToggles(regionSlot);
			showConnectedItemMarker(regionSlot);
		}
	};

	const goToRegion = (name: string, content: string) => {
		if (currentRegionState) {
			backStates.push(currentRegionState);
		}

		setRegionPage(name, content);

		goTo('region');
	};

	const onClick = (element: HTMLElement, callback: (event: MouseEvent | KeyboardEvent) => void) => {
		element.addEventListener('click', callback);
		element.addEventListener('keydown', event => {
			if (element === document.activeElement && (event.key === 'Enter' || event.key === ' ')) {
				callback(event);
			}
		});
	};

	const excludeLogicalsFromCurrentCountry = (rawLogicals: Logical[], /** e.g. JP | US */exitCountry?: Logical["ExitCountry"]) =>
		rawLogicals.filter(logical => logical.ExitCountry !== exitCountry);

	const getLogicalFromButton = (button: HTMLButtonElement): {
		getLogical: () => Logical | null | undefined,
		choice: Omit<Choice, 'connected'>,
	} => {
		const id = button.getAttribute('data-id');

		if (id) {
			return {
				getLogical: () => getLogicalById(id),
				choice: {logicalId: id},
			};
		}

		const exitCountry = button.getAttribute('data-exitCountry') || '';

		if (exitCountry) {
			const logicals = getAllLogicals(countries[exitCountry]);
			const subGroup = button.getAttribute('data-subGroup') || '';
			const secureCoreFilter = button.hasAttribute('data-no-sc-filter') ? undefined : secureCore;

			if (subGroup) {
				switch (subGroup.toLowerCase()) {
					case 'other':
						return {
							getLogical: () => requireBestLogical(filterLogicalsWithCurrentFeatures(logicals.filter(
								logical => (logical.Features & Feature.TOR) === 0 && !logical.City && logical.Tier > 0,
							), userTier, secureCoreFilter), userTier, setError),
							choice: {
								exitCountry: exitCountry,
								filter: 'other',
							},
						};

					case 'tor':
						return {
							getLogical: () => requireBestLogical(filterLogicalsWithCurrentFeatures(logicals.filter(
								logical => logical.Features & Feature.TOR,
							), userTier, secureCoreFilter, true), userTier, setError),
							choice: {
								exitCountry: exitCountry,
								requiredFeatures: Feature.TOR,
							},
						};

					case 'free':
						return {
							getLogical: () => requireBestLogical(filterLogicalsWithCurrentFeatures(logicals.filter(
								logical => logical.Tier < 1,
							), userTier, secureCoreFilter), userTier, setError),
							choice: {
								exitCountry: exitCountry,
								tier: 0,
							},
						};

					default:
						return {
							getLogical: () => requireBestLogical(filterLogicalsWithCurrentFeatures(logicals.filter(
								logical => logical.City === subGroup,
							), userTier, secureCoreFilter), userTier, setError),
							choice: {
								exitCountry: exitCountry,
								city: subGroup,
							},
						};
				}
			}

			const entryCountry = button.getAttribute('data-entryCountry') || '';

			if (entryCountry) {
				return {
					getLogical: () => requireBestLogical(filterLogicalsWithCurrentFeatures(logicals.filter(
						logical => logical.EntryCountry === entryCountry,
					), userTier, secureCoreFilter), userTier, setError),
					choice: {
						exitCountry: exitCountry,
						entryCountry: entryCountry,
					},
				};
			}

			return {
				getLogical: () => requireBestLogical(
					filterLogicalsWithCurrentFeatures(logicals, userTier, secureCoreFilter),
					userTier,
					setError,
				),
				choice: {exitCountry: exitCountry},
			};
		}

		return {
			getLogical: () => null,
			choice: {},
		};
	};

	let pmUserCache: {user: PmUser | undefined} | null = null;

	const getPmUser = async () => {
		if (pmUserCache) {
			return pmUserCache.user;
		}

		const user = await getPmUserFromPopup();

		pmUserCache = {user};

		return user;
	};

	const appendUpgradeParams = async (url: string) => {
		const pmUser = await getPmUser();

		return appendUrlParams(url, {
			email: pmUser?.Email,
			// Preselect VPN Plus plan if the user has no plan
			// The user might have a plan without VPN entitlement
			// In such case we don't select a plan and let user choose
			plan: user?.Subscribed ? '' : 'vpn2024',
		});
	};

	const configureButtons = (area?: HTMLDivElement) => {
		(area || document).querySelectorAll<HTMLButtonElement>('.expand-button:not(.expand-button-configured)').forEach(button => {
			button.classList.add('expand-button-configured');

			let parent = button.parentNode as HTMLDivElement;
			const max = area || document.body;

			while (parent !== max && !parent?.classList?.contains('country-header') && !parent?.classList?.contains('server-type')) {
				parent = parent.parentNode as HTMLDivElement;
			}

			if (parent !== max) {
				button.addEventListener('mouseover', () => {
					parent.classList.add('hover');
				});

				button.addEventListener('mouseout', () => {
					parent.classList.remove('hover');
				});
			}

			onClick(button, async (event) => {
				event.stopPropagation();
				event.stopImmediatePropagation?.();
				event.preventDefault();

				const id = button.getAttribute('data-expand');
				const {choice} = getLogicalFromButton(button);
				const code = `${choice.exitCountry}`;
				const expandContent = (id && ((window as any).sectionBuilder?.[id]?.() || document.getElementById(id)?.innerHTML)) || '';

				goToRegion(
					`
						<div class="country-flag">
							${secureCore?.value ? via() : ''}
							${getCountryFlag(code)}
						</div>
						<div class="country-name" data-country-code="${code}">
							${button.getAttribute('data-subGroupName') || getCountryNameOrCode(code)}
						</div>
					`,
					expandContent,
				);
			});
		});

		const handleLeavingAction = (url: string, forget: boolean) => {
			leaveWindowForTab(window, url);

			if (forget) {
				forgetAccount();
			}
		};

		const triggerLinkButton = async (link: string, button: HTMLElement) => {
			if (link === '{manageAccountURL}') {
				link = manageAccountURL;
			}

			const forget = !!(button.classList.contains('upgrade-button') || Number(button.getAttribute('data-forget-account')));
			const href = appendUrlParams(
				link,
				await getPrefillValues(getQuerySeed(button.dataset), getPmUser),
				await getPrefillValues(getHashSeed(button.dataset), getPmUser),
			);

			if (Number(button.getAttribute('data-direct-upgrade'))) {
				handleLeavingAction(await appendUpgradeParams(href), forget);

				return;
			}

			if (Number(button.getAttribute('data-upgrade'))) {
				goTo('upgrade');
				const page = document.querySelector<HTMLDivElement>('[data-page="upgrade"]');

				if (page) {
					page.querySelectorAll('.open-upgrade-page').forEach(button => {
						button.setAttribute('data-href', href);
						button.setAttribute('data-direct-upgrade', '1');
					});
					configureButtons(page);
					const url = await appendUpgradeParams(href);
					page.querySelectorAll('.open-upgrade-page').forEach(button => {
						button.setAttribute('data-href', url);
						button.removeAttribute('data-direct-upgrade');
					});
					configureButtons(page);

					updateAccessSentenceWithCounts(page);
				}

				return;
			}

			handleLeavingAction(href, forget);
		};

		(area || document.getElementById('servers') || document).querySelectorAll<HTMLButtonElement>('.open-upgrade-page, button[data-href], button[data-id], button[data-exitCountry], .connect-clickable, .server:not(.in-maintenance)').forEach(button => {
			onClick(button, async (event) => {
				const target = event.target as HTMLElement | null;
				if (target?.closest?.('.favorite-toggle')) {
					return;
				}

				event.stopPropagation();
				event.stopImmediatePropagation?.();
				event.preventDefault();

				const href = button.getAttribute('data-href');

				if (href) {
					triggerPromise(triggerLinkButton(href, button));

					return;
				}

				const {getLogical, choice} = getLogicalFromButton(button);
				const logical = getLogical?.();

				if (!logical) {
					throw new Error('Misconfigured server. Cannot find the selected logical.');
				}

				setLastChoiceWithCurrentOptions({
					connected: true,
					...choice,
				});
				goTo('world');
				await connectToServer(logical);
			});
		});

		configureLinks(area || document, triggerLinkButton);
		configureGoToButtons(area || document, goTo);
	};

	const setError = (apiError: ApiError | Error | ErrorDump | undefined) => {
		handleError(apiError);

		const id = (apiError as ApiError)?._id;
		(async () => {
			return Object.assign(
				{blockingError: '', error: '', restartOnClose: false},
				apiError && !(id && (await storage.getItem<{value: number}>('closed-' + id))?.value)
					? getErrorMessage(apiError)
					: {}
			);
		})().then(({blockingError, error, restartOnClose}) => {
			modalErrorSlot.setAttribute('data-error-restart-on-close', restartOnClose ? '1' : '0');
			modalErrorSlot.style.display = blockingError ? 'flex' : 'none';

			if (id) {
				modalErrorSlot.setAttribute('data-error-id', id);
			}

			(modalErrorSlot.querySelector('.modal-error-slot') as HTMLDivElement).innerHTML = blockingError;
			errorSlot.innerHTML = error;
			errorSlot.querySelectorAll('.close-button').forEach(button => {
				button.addEventListener('click', () => {
					if (id) {
						triggerPromise(storage.setItem('closed-' + id, {value: 1}));
					}

					const block = button.parentNode as HTMLDivElement;
					block.parentNode?.removeChild(block);

					if (restartOnClose) {
						showSigningView(document.getElementById('sign-in-view'), loggedView, spinner, proxySupported);
					}
				});
			});
			configureButtons(errorSlot);
			configureButtons(modalErrorSlot);
		});
	};

	let user: User | undefined;

	try {
		user = await requireUser();
	} catch (e) {
		if (e instanceof RefreshTokenError ||
			(e as RefreshTokenError).logout ||
			(!state.restarted && isUnauthorizedError(e))
		) {
			state.restarted = true;
			await saveSession({});

			triggerPromise(start());

			return;
		}

		if (spinner) {
			spinner.style.display = 'none';
		}

		if (loggedView) {
			loggedView.style.display = 'block';
		}

		setError(e as ApiError);

		user = undefined;
	}

	if (!user) {
		return;
	}

	let logicals: Logical[] = [];
	const [
		logicalsInput,
		cities,
		secureCore,
		notificationsEnabled,
		autoConnect,
		preventWebrtcLeak,
		telemetryEnabled,
		telemetry,
		crashReportEnabled,
		splitTunneling,
	] = await Promise.all([
		getSortedLogicals(),
		getCities(session.uid),
		secureCoreEnabled
			? storedSecureCore.getDefined({value: false})
			: new Promise<{value: boolean}>((resolve) => {
				resolve({value: false});
			}),
		storedNotificationsEnabled.getDefined({value: true}),
		autoConnectEnabled
			? storedAutoConnect.getDefined({value: true})
			: new Promise<{value: boolean}>((resolve) => {
				resolve({value: false});
			}),
		storedPreventWebrtcLeak.getDefined({value: true}),
		isTelemetryFeatureEnabled(),
		getTelemetryOptIn(),
		getCrashReportOptIn(),
		storedSplitTunneling.getDefined({value: []}),
	]);
	logicals = logicalsInput;

	if (!telemetryEnabled) {
		document.querySelectorAll<HTMLDivElement>('.telemetry-block').forEach(block => {
			block.style.display = 'none';
		});
	}

	mergeTranslations(logicals, cities);

	window.addEventListener('languagechange', async () => {
		if (getPreferredLanguage()) {
			return;
		}

		const cities = await getCities((await readSession()).uid);
		mergeTranslations(logicals, cities);

		each(countries, (countryCode, countryItem) => {
			countryItem.name = getCountryNameOrCode(countryCode);
		});

		document.querySelectorAll<HTMLSpanElement>('.city-name').forEach(city => {
			const englishName = city.getAttribute('data-english-city-name');
			const countryCode = city.getAttribute('data-country-code');

			if (!englishName || !countryCode) {
				return;
			}

			city.innerHTML = escapeHtml(
				(cities[countryCode] || {})[englishName] || englishName,
			);
		});

		document.querySelectorAll<HTMLSpanElement>('.country-name').forEach(country => {
			const code = `${country.getAttribute('data-country-code')}`;
			country.innerHTML = escapeHtml(getCountryNameOrCode(code));
		});
	});

	const userTier = getUserMaxTier(user);

	/** `MaxTier 2` */
	const hasAccessToPaidServers = canAccessPaidServers(user);

	/** `MaxTier 0` */
	const isFreeTier = !hasAccessToPaidServers;

	const browserExtensionEnabled = user?.VPN?.BrowserExtension || false;
	const limitedUi = !browserExtensionEnabled;

	const connectionState = await (async () => {
		try {
			return await timeoutAfter(
				getInfoFromBackground(BackgroundData.STATE),
				milliSeconds.fromSeconds(5),
				'Unable to load state',
			);
		} catch (error) {
			warn(error, new Error().stack);

			return {error} as ConnectionState['data'];
		}
	})();
	state.connected = !!connectionState?.server;
	(limitedUi ? upsell(user?.VPN?.BrowserExtensionPlan || 'VPN Plus') : new Promise<ApiError | Error | ErrorDump | undefined>(resolve => {
		resolve(connectionState.error);
	})).then(error => {
		setError(error);
	});

	const countries: CountryList = {};
	const freeCountries = {} as Record<string, true>;

	logicals.forEach(logical => {
		// Don't bother paid users with free servers
		if (hasAccessToPaidServers && logical.Tier === 0) {
			return;
		}

		const country = logical.ExitCountry;

		if (logical.Tier <= 0) {
			freeCountries[country] = true;
		}

		logical.EntryCountryName = getCountryName(logical.EntryCountry, 'en');
		logical.Translations || (logical.Translations = {});
		logical.Translations.EntryCountryName = getCountryName(logical.EntryCountry);
		const isSecureCore = logical.Features & Feature.SECURE_CORE;
		const groupType = isSecureCore
			? 'secureCore'
			: (logical.City
				? 'city'
				: ((logical.Features & Feature.TOR)
					? 'tor'
					: (logical.Tier < 1 ? 'free' : 'other')
				)
			);
		const groupEnglishName = (!isSecureCore && logical.City) || ucfirst(groupType);
		const groupName = isSecureCore
			? c('Info').t`Secure Core`
			: (logical.Translations?.City
				|| logical.City
				|| ({
					tor: 'TOR',
					free: /* translator: it's for free servers that can be accessed without paid subscription */ c('Label').t`Free`,
				} as Record<typeof groupType, string>)[groupType]
				|| /* translator: server fallback type */ c('Label').t`Other`
			);

		const infos = countries[country] || (countries[country] = {
			englishName: getCountryNameOrCode(country, 'en'),
			name: getCountryNameOrCode(country),
			needUpgrade: true,
			groups: {},
		});
		infos.groups || (infos.groups = {});

		infos.needUpgrade = infos.needUpgrade && (userTier < logical.Tier);

		const group = infos.groups[groupEnglishName] || (infos.groups[groupEnglishName] = {
			type: groupType,
			englishName: groupEnglishName,
			name: groupName,
			needUpgrade: true,
			logicals: [],
		});
		group.needUpgrade = group.needUpgrade && (userTier < logical.Tier);
		(group.logicals || (group.logicals = [])).push(logical);
	});

	const servers = document.querySelector('#servers') as HTMLDivElement;

	if (!proxySupported) {
		return;
	}

	if (spinner) {
		spinner.style.display = 'none';
	}

	if (loggedView) {
		loggedView.style.display = 'block';
	}

	servers.classList[limitedUi ? 'add' : 'remove']('not-allowed-by-plan');

	const favoriteLogicalsItem = storage.item<{value: string[]}>('favorite-logicals');
	let favoriteLogicals = new Set<string>();

	const loadFavoriteLogicals = async () => {
		const stored = await favoriteLogicalsItem.get();
		favoriteLogicals = new Set((stored?.value || []).map(id => `${id}`));
	};

	const getFavoriteLogicals = () => {
		const favorites = logicals.filter(logical => favoriteLogicals.has(`${logical.ID}`));

		return filterLogicalsWithCurrentFeatures(favorites, userTier, secureCore);
	};

	const updateFavoriteToggle = (button: HTMLButtonElement) => {
		const id = button.getAttribute('data-favorite-id');

		if (!id) {
			return;
		}

		const isFavorite = favoriteLogicals.has(id);
		const label = isFavorite
			? c('Action').t`Remove from favorites`
			: c('Action').t`Add to favorites`;

		button.classList.toggle('is-favorite', isFavorite);
		button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
		button.setAttribute('title', label);
		button.setAttribute('aria-label', label);
	};

	const syncFavoriteToggles = (area?: ParentNode) => {
		(area || document).querySelectorAll<HTMLButtonElement>('.favorite-toggle').forEach(updateFavoriteToggle);
	};

	let refresh = () => {};

	const updateFavoriteConnectButton = (visible?: boolean) => {
		const favoriteConnectButton = document.querySelector('.favorite-connect-button') as HTMLButtonElement | null;

		if (!favoriteConnectButton) {
			return;
		}

		if (typeof visible === 'boolean') {
			favoriteConnectButton.style.display = visible ? 'block' : 'none';
		}

		favoriteConnectButton.disabled = getFavoriteLogicals().length === 0;
	};

	const toggleFavorite = (button: HTMLButtonElement) => {
		const id = button.getAttribute('data-favorite-id');

		if (!id) {
			return;
		}

		if (favoriteLogicals.has(id)) {
			favoriteLogicals.delete(id);
		} else {
			favoriteLogicals.add(id);
		}

		triggerPromise(favoriteLogicalsItem.set({value: Array.from(favoriteLogicals)}));
		updateFavoriteToggle(button);

		const isSearchActive = !!(searchInput && searchInput.value);
		const isInServersList = !!button.closest('#servers');

		if (isSearchActive) {
			syncFavoriteToggles(document);
		} else if (isInServersList) {
			refresh();
		} else {
			syncFavoriteToggles(button.closest('[data-page]') || document);
		}

		updateFavoriteConnectButton();
	};

	const configureFavoriteButtons = (area?: ParentNode) => {
		(area || document).querySelectorAll<HTMLButtonElement>('.favorite-toggle:not(.favorite-toggle-configured)').forEach(button => {
			button.classList.add('favorite-toggle-configured');
			updateFavoriteToggle(button);
		});
	};

	document.addEventListener('click', (event) => {
		const target = event.target as HTMLElement | null;
		const button = target?.closest?.('.favorite-toggle') as HTMLButtonElement | null;

		if (!button) {
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
		toggleFavorite(button);
	}, true);

	const getFavoritesGroupHtml = () => {
		const favorites = getFavoriteLogicals();

		if (!favorites.length) {
			return '';
		}

		const title = c('Label').t`Favorites`;
		const countLabel = favorites.length > 1 ? ` (${favorites.length})` : '';
		const secureCoreEnabled = userTier > 0 && secureCore.value;

		return `
			<div class="servers-group group-section favorites-group">${title}${countLabel}</div>
			<div class="servers-group favorites-list">
				<div class="server-items">${serverList(userTier, favorites, title, secureCoreEnabled)}</div>
			</div>
		`;
	};

	const setServersHtml = (html: string, search = '') => {
		if (servers.innerHTML !== html) {
			servers.innerHTML = html;
		}

		if (search === '') {
			configureFavoriteButtons(servers);
			syncFavoriteToggles(servers);

			return;
		}

		configureLookupSearch(servers, userTier, div => {
			configureButtons(div);
			configureServerGroups(div);
			configureFavoriteButtons(div);
		}, search);

		configureFavoriteButtons(servers);
		syncFavoriteToggles(servers);
	};

	refresh = () => {
		setServersHtml(getFavoritesGroupHtml() + countryList(countries, userTier, secureCore));
		configureServerGroups();
	};
	await loadFavoriteLogicals();
	refresh();

	let swiftRules: SwiftRule[] = [];
	let swiftEnabled = true;
	let swiftDisconnectOnUnmatched = false;
	let swiftMatchedRule: SwiftRule | null = null;
	let swiftConnectionInfo: HTMLDivElement | null = null;
	let swiftConnectionBadge: HTMLSpanElement | null = null;
	let swiftConnectionRule: HTMLSpanElement | null = null;
	let swiftOnlyBanner: HTMLDivElement | null = null;
	let swiftToast: HTMLDivElement | null = null;
	let swiftToastText: HTMLSpanElement | null = null;
	let swiftToastTimer: number | null = null;
	let lastSwiftToastKey = '';
	let swiftHeartbeat: SwiftHeartbeat | null = null;
	let swiftHeartbeatRow: HTMLDivElement | null = null;
	let swiftHeartbeatText: HTMLSpanElement | null = null;
	let connectionSpeedRow: HTMLSpanElement | null = null;
	let connectionSpeedDownload: HTMLSpanElement | null = null;
	let connectionSpeedUpload: HTMLSpanElement | null = null;
	let connectionSpeed: ConnectionSpeed = {downloadPerSecond: 0, uploadPerSecond: 0};
	let connectionSpeedLastTime = 0;
	let connectionSpeedTimer: number | null = null;
	let speedActive = false;
	let swiftBlockedPrompt: SwiftBlockedSite | null = null;
	let swiftBlockedBanner: HTMLDivElement | null = null;
	let swiftBlockedHost: HTMLDivElement | null = null;
	let swiftBlockedTargetsText: HTMLDivElement | null = null;
	let swiftBlockedAddServerButton: HTMLButtonElement | null = null;
	let swiftBlockedAddCountryButton: HTMLButtonElement | null = null;
	let swiftBlockedDismissButton: HTMLButtonElement | null = null;
	let swiftBlockedServerTarget: {targetId: string; targetLabel: string} | null = null;
	let swiftBlockedCountryTarget: {targetId: string; targetLabel: string} | null = null;
	let swiftBlockedPickerModal: HTMLDialogElement | null = null;
	let swiftBlockedPickerHost: HTMLDivElement | null = null;
	let swiftBlockedPickerSteps: HTMLDivElement | null = null;
	let swiftBlockedPickerBack: HTMLButtonElement | null = null;
	let swiftBlockedPickerClose: HTMLButtonElement | null = null;
	let swiftBlockedPickerCountryList: HTMLDivElement | null = null;
	let swiftBlockedPickerServerList: HTMLDivElement | null = null;
	let swiftBlockedPickerCountrySearch: HTMLInputElement | null = null;
	let swiftBlockedPickerServerSearch: HTMLInputElement | null = null;
	let swiftBlockedPickerServerHeading: HTMLDivElement | null = null;
	let swiftBlockedPickerCountryOnlyButton: HTMLButtonElement | null = null;
	let swiftBlockedPickerCountries: {code: string; name: string; logicals: Logical[]}[] = [];
	let swiftBlockedPickerServers: Logical[] = [];
	let swiftBlockedPickerSelectedCountry: {code: string; name: string} | null = null;

	const updateSwiftOnlyBanner = () => {
		if (!swiftOnlyBanner) {
			return;
		}

		swiftOnlyBanner.style.display = 'flex';
		updateSwiftHeartbeatUi();
	};

	const isSwiftRuleConnected = (
		server: ServerSummary | undefined,
		rule: {targetType: SwiftTargetType; targetId: string},
	): boolean => {
		if (!server) {
			return false;
		}

		if (rule.targetType === 'server') {
			return `${server.id || ''}` === `${rule.targetId}`;
		}

		return (server.exitCountry || '') === rule.targetId;
	};

	const formatSwiftRule = (rule: SwiftRule): string => {
		const targetLabel = rule.targetLabel || rule.targetId;
		const kindLabel = rule.targetType === 'country' ? c('Label').t`Country` : c('Label').t`Server`;
		const hostLabel = buildSwiftHostLabel(rule.host, rule.path);

		return `${hostLabel} - ${kindLabel}: ${targetLabel}`;
	};

	const updateSwiftConnectionInfo = (server?: ServerSummary, connecting = false) => {
		if (!swiftConnectionInfo) {
			return;
		}

		const currentServer = server || connectionState?.server;
		const show = !!(swiftEnabled && swiftMatchedRule && state.connected && !connecting && isSwiftRuleConnected(currentServer, swiftMatchedRule));

		swiftConnectionInfo.style.display = show ? 'flex' : 'none';

		if (swiftConnectionRule) {
			swiftConnectionRule.textContent = show && swiftMatchedRule ? formatSwiftRule(swiftMatchedRule) : '';
		}
		if (swiftConnectionBadge) {
			swiftConnectionBadge.textContent = c('Info').t`Connected by Swift`;
		}
	};

	const refreshSwiftMatchedRule = async () => {
		if (!swiftEnabled) {
			swiftMatchedRule = null;
			updateSwiftConnectionInfo();
			return;
		}

		const activeRules = swiftRules.filter(rule => rule.enabled !== false);

		if (!activeRules.length) {
			swiftMatchedRule = null;
			updateSwiftConnectionInfo();
			return;
		}

		try {
			const tab = await getCurrentTab();
			const url = tab?.url;

			if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
				swiftMatchedRule = null;
				updateSwiftConnectionInfo();
				return;
			}

			const parts = getSwiftUrlParts(url);
			const {rule} = parts ? selectSwiftRule(activeRules, parts) : {rule: undefined};

			swiftMatchedRule = rule || null;
		} catch (error) {
			swiftMatchedRule = null;
		}

		updateSwiftConnectionInfo();
	};

	const SWIFT_HEARTBEAT_STALE_MS = milliSeconds.fromMinutes(2);
	const SWIFT_HEARTBEAT_REFRESH_MS = milliSeconds.fromSeconds(30);
	const SWIFT_TOAST_VISIBLE_MS = milliSeconds.fromSeconds(4);
	const SWIFT_TOAST_STALE_MS = milliSeconds.fromSeconds(15);
	const CONNECTION_SPEED_STALE_MS = milliSeconds.fromSeconds(3);
	const CONNECTION_SPEED_REFRESH_MS = milliSeconds.fromSeconds(1);

	const updateSwiftHeartbeatUi = () => {
		if (!swiftHeartbeatRow) {
			return;
		}

		const lastTime = swiftHeartbeat?.time || 0;
		const heartbeatActive = Date.now() - lastTime <= SWIFT_HEARTBEAT_STALE_MS;
		const isActive = swiftEnabled && swiftDisconnectOnUnmatched && heartbeatActive;

		swiftHeartbeatRow.classList[isActive ? 'add' : 'remove']('active');
		if (swiftHeartbeatText) {
			swiftHeartbeatText.textContent = c('Info').t`Swift Background`;
		}
	};

	const formatSpeed = (bytesPerSecond: number): string => {
		if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
			return '0 B/s';
		}

		const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
		let value = bytesPerSecond;
		let unitIndex = 0;

		while (value >= 1024 && unitIndex < units.length - 1) {
			value /= 1024;
			unitIndex += 1;
		}

		const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
		return `${value.toFixed(precision)} ${units[unitIndex]}`;
	};

	const updateConnectionSpeedUi = (downloadPerSecond: number, uploadPerSecond: number) => {
		if (connectionSpeedDownload) {
			connectionSpeedDownload.textContent = formatSpeed(downloadPerSecond);
		}
		if (connectionSpeedUpload) {
			connectionSpeedUpload.textContent = formatSpeed(uploadPerSecond);
		}
	};

	const clearConnectionSpeedUi = () => {
		updateConnectionSpeedUi(0, 0);
	};

	const isConnectionSpeedStale = () => Date.now() - connectionSpeedLastTime > CONNECTION_SPEED_STALE_MS;

	const refreshConnectionSpeedUi = () => {
		if (isConnectionSpeedStale()) {
			updateConnectionSpeedUi(0, 0);
			return;
		}

		updateConnectionSpeedUi(connectionSpeed.downloadPerSecond, connectionSpeed.uploadPerSecond);
	};

	const applyConnectionSpeed = (payload?: {value?: ConnectionSpeed; time?: number} | null) => {
		const value = payload?.value;
		connectionSpeedLastTime = typeof payload?.time === 'number' ? payload.time : 0;

		if (typeof value?.downloadPerSecond === 'number' && typeof value?.uploadPerSecond === 'number') {
			connectionSpeed = value;
		} else {
			connectionSpeed = {downloadPerSecond: 0, uploadPerSecond: 0};
		}

		if (speedActive) {
			refreshConnectionSpeedUi();
		}
	};

	const loadConnectionSpeed = async () => {
		const stored = await connectionSpeedItem.get();
		applyConnectionSpeed(stored || null);
	};

	const startConnectionSpeedTimer = () => {
		if (connectionSpeedTimer !== null) {
			return;
		}

		connectionSpeedTimer = window.setInterval(() => {
			if (!speedActive) {
				return;
			}

			refreshConnectionSpeedUi();
		}, CONNECTION_SPEED_REFRESH_MS);
	};

	const stopConnectionSpeedTimer = () => {
		if (connectionSpeedTimer === null) {
			return;
		}

		window.clearInterval(connectionSpeedTimer);
		connectionSpeedTimer = null;
	};

	const setSpeedActive = (active: boolean) => {
		if (speedActive === active) {
			return;
		}

		speedActive = active;
		if (connectionSpeedRow) {
			connectionSpeedRow.classList[active ? 'add' : 'remove']('active');
		}

		if (active) {
			refreshConnectionSpeedUi();
			startConnectionSpeedTimer();
		} else {
			stopConnectionSpeedTimer();
			clearConnectionSpeedUi();
		}
	};

	const getSwiftRootHost = (host: string): string => {
		const trimmed = host.trim().toLowerCase();

		if (!trimmed || trimmed === 'localhost') {
			return trimmed;
		}

		if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
			return trimmed;
		}

		if (trimmed.includes(':')) {
			return trimmed;
		}

		const parts = trimmed.split('.').filter(Boolean);
		const count = parts.length;
		if (count <= 2) {
			return trimmed;
		}

		const last = parts[count - 1];
		const second = parts[count - 2];
		const third = parts[count - 3];

		if (!last || !second) {
			return trimmed;
		}
		const useThree = !!third && last.length === 2 && second.length <= 3;

		return useThree ? `${third}.${second}.${last}` : `${second}.${last}`;
	};

	const getSwiftBlockedParts = (prompt: SwiftBlockedSite) => {
		const parts = getSwiftUrlParts(prompt.url);
		const rawHost = parts?.host || prompt.host;

		if (!rawHost) {
			return null;
		}

		const host = getSwiftRootHost(rawHost);
		const match = parts || {host: rawHost, path: '/'};

		return {
			host,
			path: undefined,
			match,
		};
	};

	const updateSwiftBlockedTargets = async () => {
		swiftBlockedServerTarget = null;
		swiftBlockedCountryTarget = null;

		const currentServer = connectionState?.server;
		if (currentServer?.id) {
			swiftBlockedServerTarget = {
				targetId: `${currentServer.id}`,
				targetLabel: currentServer.name || `${currentServer.id}`,
			};
		}
		if (currentServer?.exitCountry) {
			swiftBlockedCountryTarget = {
				targetId: currentServer.exitCountry,
				targetLabel: getCountryNameOrCode(currentServer.exitCountry),
			};
		}

		if (!swiftBlockedServerTarget || !swiftBlockedCountryTarget) {
			const last = await getLastConnectedServer();

			if (!swiftBlockedServerTarget && last?.id) {
				swiftBlockedServerTarget = {
					targetId: `${last.id}`,
					targetLabel: last.name || `${last.id}`,
				};
			}
			if (!swiftBlockedCountryTarget && last?.exitCountry) {
				swiftBlockedCountryTarget = {
					targetId: last.exitCountry,
					targetLabel: getCountryNameOrCode(last.exitCountry),
				};
			}
		}

		if (!swiftBlockedServerTarget || !swiftBlockedCountryTarget) {
			const filteredLogicals = filterLogicalsWithCurrentFeatures(logicals, userTier, secureCore);
			const bestLogical = getBestLogical(filteredLogicals, userTier);

			if (bestLogical) {
				if (!swiftBlockedServerTarget) {
					swiftBlockedServerTarget = {
						targetId: `${bestLogical.ID}`,
						targetLabel: bestLogical.Name,
					};
				}
				if (!swiftBlockedCountryTarget) {
					swiftBlockedCountryTarget = {
						targetId: bestLogical.ExitCountry,
						targetLabel: getCountryNameOrCode(bestLogical.ExitCountry),
					};
				}
			}
		}
	};

	const formatSwiftServerLabel = (logical: Logical): string => {
		const exitCountry = logical.ExitCountry || '';
		const city = logical.Translations?.City || logical.City || '';
		const baseName = (logical.Name || '').replace(new RegExp('^' + exitCountry + '#'), '#');
		const label = `${city ? `${city} ` : ''}${baseName}`.trim();

		return label || logical.Name || exitCountry;
	};

	const getSwiftBlockedPickerLogicals = () => filterLogicalsWithCurrentFeatures(logicals, userTier, secureCore)
		.filter(logical => logical.Tier <= userTier && isLogicalUp(logical));

	const buildSwiftBlockedPickerData = () => {
		const countryMap: Record<string, Logical[]> = {};

		getSwiftBlockedPickerLogicals().forEach(logical => {
			const code = logical.ExitCountry;
			if (!code) {
				return;
			}

			if (!countryMap[code]) {
				countryMap[code] = [];
			}
			countryMap[code].push(logical);
		});

		swiftBlockedPickerCountries = Object.keys(countryMap).map(code => {
			const logicals = countryMap[code] || [];
			logicals.sort((a, b) => {
				const aScore = a.SearchScore || 0;
				const bScore = b.SearchScore || 0;

				if (aScore !== bScore) {
					return bScore - aScore;
				}

				return a.Name.localeCompare(b.Name);
			});

			return {
				code,
				name: getCountryNameOrCode(code),
				logicals,
			};
		}).sort((a, b) => a.name.localeCompare(b.name));
	};

	const setSwiftBlockedPickerStep = (step: 'country' | 'server') => {
		if (!swiftBlockedPickerSteps) {
			return;
		}

		swiftBlockedPickerSteps.setAttribute('data-step', step);
		if (swiftBlockedPickerBack) {
			swiftBlockedPickerBack.disabled = step === 'country';
		}
	};

	const renderSwiftBlockedPickerCountries = (searchText = '') => {
		if (!swiftBlockedPickerCountryList) {
			return;
		}

		const query = searchText.trim().toLowerCase();
		const matches = swiftBlockedPickerCountries.filter(entry => (
			!query
			|| entry.code.toLowerCase().includes(query)
			|| entry.name.toLowerCase().includes(query)
		));

		if (!matches.length) {
			swiftBlockedPickerCountryList.innerHTML = `<div class="swift-blocked-picker-empty">${c('Info').t`No countries found.`}</div>`;
			return;
		}

		swiftBlockedPickerCountryList.innerHTML = matches.map(entry => {
			const count = entry.logicals.length;
			const countLabel = count === 1 ? c('Label').t`Server` : c('Label').t`Servers`;

			return `
				<button type="button" class="swift-blocked-picker-item" data-country-code="${escapeHtml(entry.code)}">
					<span class="swift-blocked-picker-flag">${getCountryFlag(entry.code)}</span>
					<span class="swift-blocked-picker-name">${escapeHtml(entry.name)}</span>
					<span class="swift-blocked-picker-meta">${count} ${countLabel}</span>
					<span class="swift-blocked-picker-chevron">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<use xlink:href="img/icons.svg#expand-button"></use>
						</svg>
					</span>
				</button>
			`;
		}).join('');
	};

	const renderSwiftBlockedPickerServers = (searchText = '') => {
		if (!swiftBlockedPickerServerList) {
			return;
		}

		const query = searchText.trim().toLowerCase();
		const matches = swiftBlockedPickerServers.filter(logical => {
			if (!query) {
				return true;
			}

			const label = formatSwiftServerLabel(logical).toLowerCase();
			const name = (logical.Name || '').toLowerCase();

			return label.includes(query) || name.includes(query);
		});

		if (!matches.length) {
			swiftBlockedPickerServerList.innerHTML = `<div class="swift-blocked-picker-empty">${c('Info').t`No servers found.`}</div>`;
			return;
		}

		swiftBlockedPickerServerList.innerHTML = matches.map(logical => `
			<button type="button" class="swift-blocked-picker-item" data-server-id="${escapeHtml(`${logical.ID}`)}">
				<span class="swift-blocked-picker-name">${escapeHtml(formatSwiftServerLabel(logical))}</span>
			</button>
		`).join('');
	};

	const resetSwiftBlockedPicker = () => {
		swiftBlockedPickerSelectedCountry = null;
		swiftBlockedPickerServers = [];

		if (swiftBlockedPickerServerHeading) {
			swiftBlockedPickerServerHeading.textContent = '';
		}

		if (swiftBlockedPickerCountrySearch) {
			swiftBlockedPickerCountrySearch.value = '';
		}

		if (swiftBlockedPickerServerSearch) {
			swiftBlockedPickerServerSearch.value = '';
		}

		if (swiftBlockedPickerCountryOnlyButton) {
			swiftBlockedPickerCountryOnlyButton.disabled = true;
		}

		setSwiftBlockedPickerStep('country');
	};

	const openSwiftBlockedPicker = () => {
		if (!swiftBlockedPickerModal || !swiftBlockedPrompt) {
			return;
		}

		const parts = getSwiftBlockedParts(swiftBlockedPrompt);
		if (!parts) {
			clearSwiftBlockedPrompt();
			return;
		}

		buildSwiftBlockedPickerData();
		resetSwiftBlockedPicker();
		renderSwiftBlockedPickerCountries();

		if (swiftBlockedPickerHost) {
			swiftBlockedPickerHost.textContent = buildSwiftHostLabel(parts.host, parts.path);
		}

		showModal(swiftBlockedPickerModal);
		swiftBlockedPickerCountrySearch?.focus();
	};

	const closeSwiftBlockedPicker = () => {
		if (!swiftBlockedPickerModal) {
			return;
		}

		closeModal(swiftBlockedPickerModal);
	};

	const clearSwiftBlockedPrompt = () => {
		swiftBlockedPrompt = null;
		swiftBlockedBanner?.classList.remove('active');
		closeSwiftBlockedPicker();
		triggerPromise(swiftBlockedSiteItem.remove());
	};

	const renderSwiftBlockedPrompt = async () => {
		if (!swiftBlockedBanner || !swiftBlockedHost || !swiftBlockedPrompt) {
			swiftBlockedBanner?.classList.remove('active');
			closeSwiftBlockedPicker();
			return;
		}

		const parts = getSwiftBlockedParts(swiftBlockedPrompt);
		if (!parts) {
			clearSwiftBlockedPrompt();
			return;
		}

		if (swiftRules.length && selectSwiftRule(swiftRules, parts.match).rule) {
			clearSwiftBlockedPrompt();
			return;
		}

		await updateSwiftBlockedTargets();

		swiftBlockedHost.textContent = buildSwiftHostLabel(parts.host, parts.path);
		if (swiftBlockedPickerModal?.open && swiftBlockedPickerHost) {
			swiftBlockedPickerHost.textContent = buildSwiftHostLabel(parts.host, parts.path);
		}

		if (swiftBlockedTargetsText) {
			const serverText = swiftBlockedServerTarget
				? `${c('Label').t`Server`}: ${swiftBlockedServerTarget.targetLabel}`
				: '';
			const countryText = swiftBlockedCountryTarget
				? `${c('Label').t`Country`}: ${swiftBlockedCountryTarget.targetLabel}`
				: '';
			swiftBlockedTargetsText.textContent = [serverText, countryText].filter(Boolean).join(' · ');
		}

		if (swiftBlockedAddServerButton) {
			swiftBlockedAddServerButton.textContent = c('Action').t`Add server`;
			swiftBlockedAddServerButton.disabled = !swiftBlockedServerTarget;
			swiftBlockedAddServerButton.title = swiftBlockedServerTarget?.targetLabel || '';
		}

		if (swiftBlockedAddCountryButton) {
			swiftBlockedAddCountryButton.textContent = c('Action').t`Choose location`;
			swiftBlockedAddCountryButton.disabled = !swiftBlockedCountryTarget;
			swiftBlockedAddCountryButton.title = c('Action').t`Choose location`;
		}

		if (swiftBlockedDismissButton) {
			swiftBlockedDismissButton.textContent = c('Action').t`Dismiss`;
		}

		swiftBlockedBanner.classList.add('active');
	};

	const addSwiftBlockedRule = (
		targetType: SwiftTargetType,
		overrideTarget?: {targetId: string; targetLabel: string},
	) => {
		if (!swiftBlockedPrompt) {
			return;
		}

		const parts = getSwiftBlockedParts(swiftBlockedPrompt);
		if (!parts) {
			clearSwiftBlockedPrompt();
			return;
		}

		const target = overrideTarget || (targetType === 'server' ? swiftBlockedServerTarget : swiftBlockedCountryTarget);
		if (!target) {
			return;
		}

		const includeSubdomains = true;
		const existingIndex = swiftRules.findIndex(rule => (
			rule.host === parts.host
			&& (rule.path || '') === (parts.path || '')
			&& !!rule.includeSubdomains === includeSubdomains
		));
		const existingRule = existingIndex >= 0 ? swiftRules[existingIndex] : undefined;
		const newRule: SwiftRule = {
			id: existingRule?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			host: parts.host,
			path: parts.path,
			includeSubdomains,
			enabled: existingRule?.enabled !== false,
			targetType,
			targetId: target.targetId,
			targetLabel: target.targetLabel,
		};

		if (existingIndex >= 0) {
			swiftRules.splice(existingIndex, 1, newRule);
		} else {
			swiftRules.push(newRule);
		}

		triggerPromise(swiftRulesItem.set({value: swiftRules}));
		renderSwiftRules();
		updateSwiftAddState();
		clearSwiftBlockedPrompt();
	};

	const showSwiftToast = (event?: SwiftDebugEvent) => {
		if (!swiftToast || !swiftToastText || !event || event.action !== 'connect') {
			return;
		}

		if (Date.now() - event.time > SWIFT_TOAST_STALE_MS) {
			return;
		}

		const hostLabel = event.host || c('Info').t`(unknown host)`;
		const rawTarget = event.target || '';
		const targetLabel = rawTarget.replace(/^[^:]+:/, '').trim() || rawTarget;

		if (!targetLabel) {
			return;
		}

		const toastKey = `${event.time}|${hostLabel}|${targetLabel}`;

		if (toastKey === lastSwiftToastKey) {
			return;
		}

		lastSwiftToastKey = toastKey;
		swiftToastText.textContent = c('Info').t`Swift connected to ${targetLabel} for ${hostLabel}`;
		swiftToast.classList.add('active');

		if (swiftToastTimer) {
			window.clearTimeout(swiftToastTimer);
		}

		swiftToastTimer = window.setTimeout(() => {
			swiftToast?.classList.remove('active');
		}, SWIFT_TOAST_VISIBLE_MS);
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

	const loadSwiftHeartbeat = async () => {
		const stored = await swiftHeartbeatItem.get();
		swiftHeartbeat = stored?.value || null;
		updateSwiftHeartbeatUi();
	};


	const swiftPage = document.querySelector('[data-page="swift"]') as HTMLDivElement | null;
	const swiftUrlInput = swiftPage?.querySelector<HTMLInputElement>('.swift-url') || null;
	const swiftTargetInput = swiftPage?.querySelector<HTMLInputElement>('.swift-target') || null;
	const swiftAddButton = swiftPage?.querySelector<HTMLButtonElement>('.swift-add-button') || null;
	const swiftError = swiftPage?.querySelector<HTMLDivElement>('.swift-error') || null;
	const swiftList = swiftPage?.querySelector<HTMLDivElement>('.swift-list') || null;
	const swiftDebugInfo = swiftPage?.querySelector<HTMLDivElement>('.swift-debug-info') || null;
	const swiftStatus = swiftPage?.querySelector<HTMLDivElement>('.swift-status') || null;
	const swiftDisconnectStatus = swiftPage?.querySelector<HTMLDivElement>('.swift-disconnect-status') || null;
	const swiftSubdomainsToggle = swiftPage?.querySelector<HTMLInputElement>('.swift-subdomains-toggle') || null;
	const swiftServerDatalist = swiftPage?.querySelector<HTMLDataListElement>('#swift-target-servers') || null;
	const swiftCountryDatalist = swiftPage?.querySelector<HTMLDataListElement>('#swift-target-countries') || null;
	const swiftImportInput = swiftPage?.querySelector<HTMLInputElement>('.swift-import-input') || null;
	const swiftDebugStorageKey = storagePrefix + swiftDebugItem.key;
	const swiftEnabledStorageKey = storagePrefix + swiftEnabledItem.key;
	const swiftDisconnectStorageKey = storagePrefix + swiftDisconnectOnUnmatchedItem.key;
	const swiftHeartbeatStorageKey = storagePrefix + swiftHeartbeatItem.key;
	const swiftBlockedPromptStorageKey = storagePrefix + swiftBlockedSiteItem.key;
	const connectionSpeedStorageKey = storagePrefix + connectionSpeedItem.key;

	const getSwiftTargetType = (): SwiftTargetType => {
		const selected = swiftPage?.querySelector<HTMLInputElement>('input[name="swift-target-type"]:checked');

		return (selected?.value as SwiftTargetType) || 'server';
	};

	const setSwiftError = (message = '') => {
		if (swiftError) {
			swiftError.textContent = message;
		}
	};

	const updateSwiftCancelState = () => {
		if (!swiftPage) {
			return;
		}

		swiftPage.querySelectorAll<HTMLButtonElement>('[data-swift-action="cancel"]').forEach(button => {
			button.disabled = swiftRules.length === 0;
		});
	};

	const toggleSwiftForm = (open: boolean) => {
		if (!swiftPage) {
			return;
		}

		swiftPage.querySelectorAll<HTMLDivElement>('.swift-filter-add').forEach(element => {
			element.style.display = open ? 'none' : 'block';
		});

		swiftPage.querySelectorAll<HTMLDivElement>('.swift-filter-form').forEach(element => {
			element.style.display = open ? 'block' : 'none';
		});

		swiftPage.querySelectorAll<HTMLDivElement>('.swift-filters').forEach(element => {
			element.style.display = 'block';
		});

		updateSwiftCancelState();
	};

	const clearSwiftForm = () => {
		if (!swiftUrlInput || !swiftTargetInput) {
			return;
		}

		swiftUrlInput.value = '';
		swiftTargetInput.value = '';

		if (swiftSubdomainsToggle) {
			swiftSubdomainsToggle.checked = true;
		}

		setSwiftError('');
		updateSwiftAddState();
	};

	const updateSwiftEnabledUi = () => {
		if (!swiftPage) {
			return;
		}

		if (swiftStatus) {
			swiftStatus.textContent = '';
			swiftStatus.style.display = 'none';
		}

		swiftPage.querySelectorAll<HTMLButtonElement>('[data-swift-action="toggle"]').forEach(button => {
			button.classList[swiftEnabled ? 'add' : 'remove']('activated');
		});

		swiftPage.querySelectorAll<HTMLDivElement>('.swift-configuration').forEach(configurationBlock => {
			configurationBlock.style.display = swiftEnabled ? 'block' : 'none';
		});

		if (!swiftEnabled) {
			clearSwiftForm();
		}

		if (swiftEnabled) {
			toggleSwiftForm(false);
		}

		updateSwiftOnlyBanner();
		updateSwiftConnectionInfo();
	};

	const updateSwiftDisconnectUi = () => {
		if (!swiftPage) {
			return;
		}

		if (swiftDisconnectStatus) {
			swiftDisconnectStatus.textContent = '';
			swiftDisconnectStatus.style.display = 'none';
		}

		swiftPage.querySelectorAll<HTMLButtonElement>('[data-swift-action="toggle-disconnect"]').forEach(button => {
			button.classList[swiftDisconnectOnUnmatched ? 'add' : 'remove']('activated');
		});

		updateSwiftOnlyBanner();
		updateSwiftConnectionInfo();
	};

	const exportSwiftRules = () => {
		const payload = {
			version: 1,
			rules: swiftRules,
		};

		const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');

		link.href = url;
		link.download = 'swift-rules.json';
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	const parseSwiftRules = (raw: any): SwiftRule[] | null => {
		const list = Array.isArray(raw) ? raw : raw?.rules;

		if (!Array.isArray(list)) {
			return null;
		}

		const seenKeys = new Set<string>();
		const normalized: SwiftRule[] = [];
		let idSeed = Date.now();

		list.forEach(item => {
			if (!item || typeof item !== 'object') {
				return;
			}

			const parsedHost = typeof item.host === 'string' ? parseSwiftUrlInput(item.host) : null;
			const host = parsedHost?.host;
			const path = normalizeSwiftPath(typeof item.path === 'string' ? item.path : parsedHost?.path);
			const targetType = (typeof item.targetType === 'string' && item.targetType.toLowerCase() === 'country')
				? 'country'
				: 'server';
			const targetId = typeof item.targetId === 'string' ? item.targetId : null;
			const targetLabel = typeof item.targetLabel === 'string' ? item.targetLabel : null;
			const includeSubdomains = !!item.includeSubdomains;
			const key = host ? `${host}|${path || ''}|${includeSubdomains ? 'sub' : 'exact'}` : '';

			if (!host || !targetId || !targetLabel || !key || seenKeys.has(key)) {
				return;
			}

			seenKeys.add(key);
			idSeed += 1;

			normalized.push({
				id: typeof item.id === 'string' ? item.id : `${idSeed}-${Math.random().toString(16).slice(2)}`,
				host,
				path,
				includeSubdomains,
				enabled: item.enabled !== false,
				targetType,
				targetId,
				targetLabel,
			});
		});

		return normalized;
	};

	const importSwiftRules = async (file: File) => {
		try {
			const content = await file.text();
			const parsed = JSON.parse(content);
			const imported = parseSwiftRules(parsed);

			if (!imported || !imported.length) {
				setSwiftError(c('Error').t`No valid Swift rules found.`);
				return;
			}

			swiftRules = imported;
			triggerPromise(swiftRulesItem.set({value: swiftRules}));
			renderSwiftRules();
			setSwiftError('');
			updateSwiftAddState();
		} catch (error) {
			setSwiftError(c('Error').t`Failed to import rules.`);
		}
	};

	const useCurrentTabForSwift = async () => {
		if (!swiftUrlInput) {
			return;
		}

		const tab = await getCurrentTab();
		const parsed = tab?.url ? parseSwiftUrlInput(tab.url) : null;

		if (!parsed) {
			setSwiftError(c('Error').t`Unable to read the current tab.`);
			return;
		}

		swiftUrlInput.value = buildSwiftHostLabel(parsed.host, parsed.path);
		setSwiftError('');
		updateSwiftAddState();
	};

	const updateSwiftAddState = () => {
		if (!swiftAddButton || !swiftUrlInput || !swiftTargetInput) {
			return;
		}

		swiftAddButton.disabled = !swiftUrlInput.value.trim() || !swiftTargetInput.value.trim();
	};

	const updateSwiftTargetList = () => {
		if (!swiftTargetInput) {
			return;
		}

		swiftTargetInput.setAttribute(
			'list',
			getSwiftTargetType() === 'server' ? 'swift-target-servers' : 'swift-target-countries',
		);
	};

	const populateSwiftDatalists = () => {
		if (swiftServerDatalist) {
			swiftServerDatalist.innerHTML = logicals
				.filter(logical => logical.Tier <= userTier)
				.map(logical => `<option value="${escapeHtml(logical.Name)}"></option>`)
				.join('');
		}

		if (swiftCountryDatalist) {
			swiftCountryDatalist.innerHTML = Object.keys(countries)
				.sort()
				.map(code => {
					const name = countries[code]?.name || code;

					return [
						`<option value="${escapeHtml(code)}"></option>`,
						`<option value="${escapeHtml(name)}"></option>`,
					].join('');
				})
				.join('');
		}
	};

	const resolveSwiftTargetInput = (targetType: SwiftTargetType, input: string) => {
		const resolved = resolveSwiftTarget(targetType, input, logicals, userTier, countries);

		if ('error' in resolved) {
			const errorMap: Record<typeof resolved.error, string> = {
				'empty-input': c('Error').t`Enter a server or country.`,
				'server-not-found': c('Error').t`Server not found.`,
				'server-upgrade-required': c('Error').t`Upgrade required to use this server.`,
				'country-not-found': c('Error').t`Country not found.`,
			};

			return {error: errorMap[resolved.error]};
		}

		return resolved;
	};

	const renderSwiftRules = () => {
		if (!swiftList) {
			return;
		}

		if (!swiftRules.length) {
			swiftList.innerHTML = `<div class="fade-text">${c('Info').t`No Swift rules yet.`}</div>`;
			updateSwiftCancelState();

			return;
		}

		swiftList.innerHTML = swiftRules.map((rule, index) => {
			const isEnabled = rule.enabled !== false;
			const targetKind = rule.targetType === 'server'
				? c('Label').t`Server`
				: c('Label').t`Country`;
			const hostLabel = buildSwiftHostLabel(rule.host, rule.path);
			const subdomainLabel = rule.includeSubdomains
				? c('Label').t`Includes subdomains`
				: c('Label').t`Exact host`;
			const pathLabel = rule.path
				? `${c('Label').t`Path`}: ${escapeHtml(rule.path)}`
				: c('Label').t`Any path`;
			const scopeLabel = `${subdomainLabel} · ${pathLabel}`;
			const moveUpDisabled = index === 0;
			const moveDownDisabled = index === swiftRules.length - 1;
			const toggleLabel = isEnabled
				? c('Action').t`Disable rule`
				: c('Action').t`Enable rule`;
			const moveUpLabel = c('Action').t`Move up`;
			const moveDownLabel = c('Action').t`Move down`;
			const removeLabel = c('Action').t`Remove`;

			return `
				<div class="swift-rule${isEnabled ? '' : ' is-disabled'}">
					<button
						class="toggle swift-rule-toggle${isEnabled ? ' activated' : ''}"
						data-swift-toggle="${escapeHtml(rule.id)}"
						title="${toggleLabel}"
						aria-label="${toggleLabel}"
					></button>
					<div class="swift-rule-info">
						<div class="swift-rule-meta">
							<span class="swift-rule-priority">#${index + 1}</span>
							<div class="swift-rule-host">${escapeHtml(hostLabel)}</div>
						</div>
						<div class="swift-rule-target">${targetKind}: ${escapeHtml(rule.targetLabel)} · ${scopeLabel}</div>
					</div>
					<div class="swift-rule-actions">
						<button
							class="swift-move-button"
							data-swift-move="up"
							data-swift-id="${escapeHtml(rule.id)}"
							title="${moveUpLabel}"
							aria-label="${moveUpLabel}"
							${moveUpDisabled ? 'disabled' : ''}
						>
							<svg viewBox="0 0 24 24" class="swift-move-icon swift-move-up">
								<use xlink:href="img/icons.svg#expand-button"></use>
							</svg>
						</button>
						<button
							class="swift-move-button"
							data-swift-move="down"
							data-swift-id="${escapeHtml(rule.id)}"
							title="${moveDownLabel}"
							aria-label="${moveDownLabel}"
							${moveDownDisabled ? 'disabled' : ''}
						>
							<svg viewBox="0 0 24 24" class="swift-move-icon swift-move-down">
								<use xlink:href="img/icons.svg#expand-button"></use>
							</svg>
						</button>
						<button
							class="swift-remove-button"
							data-swift-remove="${escapeHtml(rule.id)}"
							title="${removeLabel}"
							aria-label="${removeLabel}"
						>
							<svg viewBox="0 0 24 24">
								<use xlink:href="img/icons.svg#delete"></use>
							</svg>
						</button>
					</div>
				</div>
			`;
		}).join('');

		swiftList.querySelectorAll<HTMLButtonElement>('[data-swift-toggle]').forEach(button => {
			onClick(button, (event) => {
				event.stopPropagation();
				event.preventDefault();

				const id = button.getAttribute('data-swift-toggle');

				if (!id) {
					return;
				}

				const rule = swiftRules.find(item => item.id === id);

				if (!rule) {
					return;
				}

				rule.enabled = !(rule.enabled !== false);
				triggerPromise(swiftRulesItem.set({value: swiftRules}));
				renderSwiftRules();
			});
		});

		swiftList.querySelectorAll<HTMLButtonElement>('[data-swift-remove]').forEach(button => {
			onClick(button, (event) => {
				event.stopPropagation();
				event.preventDefault();

				const id = button.getAttribute('data-swift-remove');

				if (!id) {
					return;
				}

				swiftRules = swiftRules.filter(rule => rule.id !== id);
				triggerPromise(swiftRulesItem.set({value: swiftRules}));
				renderSwiftRules();
			});
		});

		swiftList.querySelectorAll<HTMLButtonElement>('[data-swift-move]').forEach(button => {
			onClick(button, (event) => {
				event.stopPropagation();
				event.preventDefault();

				const id = button.getAttribute('data-swift-id');
				const direction = button.getAttribute('data-swift-move');

				if (!id || (direction !== 'up' && direction !== 'down')) {
					return;
				}

				const index = swiftRules.findIndex(rule => rule.id === id);

				if (index < 0) {
					return;
				}

				const nextIndex = direction === 'up' ? index - 1 : index + 1;

				if (nextIndex < 0 || nextIndex >= swiftRules.length) {
					return;
				}

				const [rule] = swiftRules.splice(index, 1);

				if (!rule) {
					return;
				}

				swiftRules.splice(nextIndex, 0, rule);
				triggerPromise(swiftRulesItem.set({value: swiftRules}));
				renderSwiftRules();
			});
		});

		updateSwiftCancelState();
	};

	const renderSwiftDebug = (event?: SwiftDebugEvent) => {
		if (!swiftDebugInfo) {
			return;
		}

		if (!event) {
			swiftDebugInfo.textContent = c('Info').t`No recent Swift activity.`;

			return;
		}

		const detailLabelMap: Record<string, string> = {
			'already-connected': c('Info').t`Already connected.`,
			'server-not-available': c('Error').t`Server not available.`,
			'country-not-available': c('Error').t`No servers available for this country.`,
			'no-server-up': c('Error').t`No servers are available right now.`,
			'no-user': c('Error').t`Sign in to connect.`,
			'invalid-host': c('Error').t`Invalid website.`,
			'disabled': c('Info').t`Swift is off.`,
			'no-rule': c('Info').t`No matching rule.`,
			'multiple-rules': c('Info').t`Multiple rules matched, using top priority.`,
		};
		const host = event.host || c('Info').t`(unknown host)`;
		const target = event.target ? ` -> ${event.target}` : '';
		const detailLabel = event.detail ? (detailLabelMap[event.detail] || event.detail) : '';
		const detail = detailLabel ? ` (${detailLabel})` : '';
		const time = new Date(event.time).toLocaleTimeString();

		swiftDebugInfo.textContent = `${time} - ${event.action} - ${host}${target}${detail}`;
	};

	const addSwiftRule = (): boolean => {
		if (!swiftUrlInput || !swiftTargetInput || !swiftAddButton) {
			return false;
		}

		setSwiftError('');

		const parsedHost = parseSwiftUrlInput(swiftUrlInput.value);
		const host = parsedHost?.host;
		const path = parsedHost?.path;
		const targetType = getSwiftTargetType();
		const includeSubdomains = !!swiftSubdomainsToggle?.checked;

		if (!host) {
			setSwiftError(c('Error').t`Enter a valid website.`);

			return false;
		}

		const resolved = resolveSwiftTargetInput(targetType, swiftTargetInput.value);

		if ('error' in resolved) {
			setSwiftError(resolved.error);

			return false;
		}

		const existingIndex = swiftRules.findIndex(rule => (
			rule.host === host
			&& (rule.path || '') === (path || '')
			&& !!rule.includeSubdomains === includeSubdomains
		));
		const existingRule = existingIndex >= 0 ? swiftRules[existingIndex] : undefined;
		const newRule: SwiftRule = {
			id: existingIndex >= 0 ? swiftRules[existingIndex]!.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			host,
			path,
			includeSubdomains,
			enabled: existingRule?.enabled !== false,
			targetType,
			targetId: resolved.targetId,
			targetLabel: resolved.targetLabel,
		};

		if (existingIndex >= 0) {
			swiftRules.splice(existingIndex, 1, newRule);
		} else {
			swiftRules.push(newRule);
		}

		triggerPromise(swiftRulesItem.set({value: swiftRules}));
		renderSwiftRules();
		updateSwiftAddState();
		triggerPromise(renderSwiftBlockedPrompt());

		return true;
	};

	if (swiftPage && swiftUrlInput && swiftTargetInput && swiftAddButton) {
		updateSwiftTargetList();

		swiftUrlInput.addEventListener('input', updateSwiftAddState);
		swiftTargetInput.addEventListener('input', updateSwiftAddState);
		swiftPage.querySelectorAll<HTMLInputElement>('input[name="swift-target-type"]').forEach(input => {
			input.addEventListener('change', () => {
				updateSwiftTargetList();
				updateSwiftAddState();
			});
		});

		swiftPage.querySelectorAll<HTMLButtonElement>('[data-swift-action]').forEach(button => {
			const action = button.getAttribute('data-swift-action');

			if (!action) {
				return;
			}

			onClick(button, (event) => {
				event.preventDefault();

				switch (action) {
					case 'toggle':
						swiftEnabled = !swiftEnabled;
						triggerPromise(swiftEnabledItem.set({value: swiftEnabled}));
						updateSwiftEnabledUi();
						break;
					case 'toggle-disconnect':
						swiftDisconnectOnUnmatched = !swiftDisconnectOnUnmatched;
						triggerPromise(swiftDisconnectOnUnmatchedItem.set({value: swiftDisconnectOnUnmatched}));
						updateSwiftDisconnectUi();
						break;
					case 'use-current-tab':
						triggerPromise(useCurrentTabForSwift());
						break;
					case 'export':
						exportSwiftRules();
						break;
					case 'import':
						swiftImportInput?.click();
						break;
					case 'add-website':
						if (!swiftEnabled) {
							swiftEnabled = true;
							triggerPromise(swiftEnabledItem.set({value: true}));
							updateSwiftEnabledUi();
						}

						toggleSwiftForm(true);
						swiftUrlInput.focus();
						updateSwiftAddState();
						break;
					case 'add':
						if (!swiftEnabled) {
							swiftEnabled = true;
							triggerPromise(swiftEnabledItem.set({value: true}));
							updateSwiftEnabledUi();
						}

						if (addSwiftRule()) {
							clearSwiftForm();
							toggleSwiftForm(false);
						}
						break;
					case 'cancel':
						if (!swiftRules.length) {
							return;
						}

						clearSwiftForm();
						toggleSwiftForm(false);
						break;
				}
			});
		});

		populateSwiftDatalists();
		await loadSwiftRules();
		await loadSwiftEnabled();
		await loadSwiftDisconnectOnUnmatched();
		await loadSwiftHeartbeat();
		await loadConnectionSpeed();
		await refreshSwiftMatchedRule();
		renderSwiftRules();
		updateSwiftEnabledUi();
		updateSwiftDisconnectUi();
		updateSwiftOnlyBanner();
		setInterval(updateSwiftHeartbeatUi, SWIFT_HEARTBEAT_REFRESH_MS);

		if (swiftImportInput) {
			swiftImportInput.addEventListener('change', async () => {
				const file = swiftImportInput.files?.[0];

				if (!file) {
					return;
				}

				await importSwiftRules(file);
				swiftImportInput.value = '';
			});
		}

		const debugEvent = (await swiftDebugItem.get())?.value;
		renderSwiftDebug(debugEvent);
		showSwiftToast(debugEvent);

		chrome.storage.onChanged.addListener((changes, areaName) => {
			if (areaName === 'local' || areaName === 'session') {
				if (changes[connectionSpeedStorageKey]) {
					const nextValue = changes[connectionSpeedStorageKey]?.newValue as {value: ConnectionSpeed; time?: number} | undefined;
					applyConnectionSpeed(nextValue || null);
				}
			}

			if (areaName !== 'local') {
				return;
			}

			if (changes[swiftDebugStorageKey]) {
				const nextValue = changes[swiftDebugStorageKey]?.newValue as {value: SwiftDebugEvent} | undefined;
				renderSwiftDebug(nextValue?.value);
				showSwiftToast(nextValue?.value);
			}

			if (changes[swiftEnabledStorageKey]) {
				const nextValue = changes[swiftEnabledStorageKey]?.newValue as {value: boolean} | undefined;
				swiftEnabled = nextValue?.value ?? true;
				updateSwiftEnabledUi();
				updateSwiftOnlyBanner();
				triggerPromise(refreshSwiftMatchedRule());
			}

			if (changes[swiftDisconnectStorageKey]) {
				const nextValue = changes[swiftDisconnectStorageKey]?.newValue as {value: boolean} | undefined;
				swiftDisconnectOnUnmatched = nextValue?.value ?? false;
				updateSwiftDisconnectUi();
				updateSwiftOnlyBanner();
				triggerPromise(refreshSwiftMatchedRule());
			}

			if (changes[swiftHeartbeatStorageKey]) {
				const nextValue = changes[swiftHeartbeatStorageKey]?.newValue as {value: SwiftHeartbeat} | undefined;
				swiftHeartbeat = nextValue?.value || null;
				updateSwiftHeartbeatUi();
			}

			if (changes[swiftBlockedPromptStorageKey]) {
				const nextValue = changes[swiftBlockedPromptStorageKey]?.newValue as {value: SwiftBlockedSite | null} | undefined;
				swiftBlockedPrompt = nextValue?.value || null;
				triggerPromise(renderSwiftBlockedPrompt());
			}
		});
	}

	const setLastChoiceWithCurrentOptions = (choice: Choice) => {
		const options = {
			excludedFeatures: 0,
			requiredFeatures: 0,
		};

		const features = {
			[Feature.SECURE_CORE]: secureCore?.value,
		};

		each(features, (feature, toggled) => {
			const key = toggled ? 'requiredFeatures' : 'excludedFeatures';
			options[key] = options[key] | Number(feature);
		});

		each(options, (key, value) => {
			if (!value) {
				delete options[key];
			}
		});

		setLastChoice({
			...options,
			...choice,
		});
	};

	// Load unique DOM elements

	const serverStatusSlot = document.querySelector('#status .connection-status') as HTMLDivElement;
	swiftConnectionInfo = document.querySelector<HTMLDivElement>('#status .swift-connection-info');
	swiftConnectionBadge = swiftConnectionInfo?.querySelector<HTMLSpanElement>('.swift-connection-badge') || null;
	swiftConnectionRule = swiftConnectionInfo?.querySelector<HTMLSpanElement>('.swift-connection-rule') || null;
	swiftOnlyBanner = document.querySelector<HTMLDivElement>('#status .swift-only-banner');
	swiftHeartbeatRow = swiftOnlyBanner;
	swiftHeartbeatText = swiftOnlyBanner?.querySelector<HTMLSpanElement>('.swift-background-text') || null;
	connectionSpeedRow = document.querySelector<HTMLSpanElement>('#status .connection-speed');
	connectionSpeedDownload = connectionSpeedRow?.querySelector<HTMLSpanElement>('.speed-download-value') || null;
	connectionSpeedUpload = connectionSpeedRow?.querySelector<HTMLSpanElement>('.speed-upload-value') || null;
	swiftBlockedBanner = document.querySelector<HTMLDivElement>('#status .swift-blocked-banner');
	swiftBlockedHost = swiftBlockedBanner?.querySelector<HTMLDivElement>('.swift-blocked-host') || null;
	swiftBlockedTargetsText = swiftBlockedBanner?.querySelector<HTMLDivElement>('.swift-blocked-targets') || null;
	swiftBlockedAddServerButton = swiftBlockedBanner?.querySelector<HTMLButtonElement>('.swift-blocked-add-server') || null;
	swiftBlockedAddCountryButton = swiftBlockedBanner?.querySelector<HTMLButtonElement>('.swift-blocked-add-country') || null;
	swiftBlockedDismissButton = swiftBlockedBanner?.querySelector<HTMLButtonElement>('.swift-blocked-dismiss') || null;
	swiftBlockedPickerModal = document.querySelector<HTMLDialogElement>('#swift-blocked-picker');
	swiftBlockedPickerHost = swiftBlockedPickerModal?.querySelector<HTMLDivElement>('.swift-blocked-picker-host') || null;
	swiftBlockedPickerSteps = swiftBlockedPickerModal?.querySelector<HTMLDivElement>('.swift-blocked-picker-steps') || null;
	swiftBlockedPickerBack = swiftBlockedPickerModal?.querySelector<HTMLButtonElement>('.swift-blocked-picker-back') || null;
	swiftBlockedPickerClose = swiftBlockedPickerModal?.querySelector<HTMLButtonElement>('.swift-blocked-picker-close') || null;
	swiftBlockedPickerCountryList = swiftBlockedPickerModal?.querySelector<HTMLDivElement>('.swift-blocked-country-list') || null;
	swiftBlockedPickerServerList = swiftBlockedPickerModal?.querySelector<HTMLDivElement>('.swift-blocked-server-list') || null;
	swiftBlockedPickerCountrySearch = swiftBlockedPickerModal?.querySelector<HTMLInputElement>('.swift-blocked-country-search') || null;
	swiftBlockedPickerServerSearch = swiftBlockedPickerModal?.querySelector<HTMLInputElement>('.swift-blocked-server-search') || null;
	swiftBlockedPickerServerHeading = swiftBlockedPickerModal?.querySelector<HTMLDivElement>('.swift-blocked-picker-server-heading') || null;
	swiftBlockedPickerCountryOnlyButton = swiftBlockedPickerModal?.querySelector<HTMLButtonElement>('.swift-blocked-picker-country-only') || null;
	swiftToast = document.querySelector<HTMLDivElement>('#status .swift-toast');
	swiftToastText = swiftToast?.querySelector<HTMLSpanElement>('.swift-toast-text') || null;
	const signOutButton = document.querySelector('button.sign-out-button') as HTMLDivElement;
	const switchButton = document.querySelector('button.switch-account-button') as HTMLDivElement;
	const menu = document.getElementById('menu') as HTMLDivElement;
	const quickConnectButton = document.querySelector('.quick-connect-button') as HTMLDivElement;
	const favoriteConnectButton = document.querySelector('.favorite-connect-button') as HTMLButtonElement | null;
	const disconnectButton = document.querySelector('#status button.disconnection-button') as HTMLDivElement;
	const reconnectButton = document.querySelector('#reconnect-button') as HTMLButtonElement | null;

	const freeCountriesListEl = document.getElementById('free-countries-list') as HTMLDivElement;
	const freeCountriesCountEl = document.getElementById('free-server-countries-count') as HTMLSpanElement;
	const freeCountryItemTemplate = document.getElementById('free-country-item-template') as HTMLTemplateElement;

	updateSwiftOnlyBanner();
	triggerPromise((async () => {
		swiftBlockedPrompt = (await swiftBlockedSiteItem.get())?.value || null;
		await renderSwiftBlockedPrompt();
	})());

	swiftBlockedAddServerButton?.addEventListener('click', () => {
		addSwiftBlockedRule('server');
	});

	swiftBlockedAddCountryButton?.addEventListener('click', () => {
		openSwiftBlockedPicker();
	});

	swiftBlockedDismissButton?.addEventListener('click', () => {
		clearSwiftBlockedPrompt();
	});

	if (swiftBlockedPickerBack) {
		swiftBlockedPickerBack.textContent = c('Action').t`Back`;
		swiftBlockedPickerBack.addEventListener('click', () => {
			setSwiftBlockedPickerStep('country');
			swiftBlockedPickerCountrySearch?.focus();
		});
	}

	if (swiftBlockedPickerClose) {
		swiftBlockedPickerClose.textContent = c('Action').t`Close`;
	}

	if (swiftBlockedPickerCountryOnlyButton) {
		swiftBlockedPickerCountryOnlyButton.textContent = c('Action').t`Use country only`;
		swiftBlockedPickerCountryOnlyButton.disabled = true;
		swiftBlockedPickerCountryOnlyButton.addEventListener('click', () => {
			if (!swiftBlockedPickerSelectedCountry) {
				return;
			}

			addSwiftBlockedRule('country', {
				targetId: swiftBlockedPickerSelectedCountry.code,
				targetLabel: swiftBlockedPickerSelectedCountry.name,
			});
			closeSwiftBlockedPicker();
		});
	}

	swiftBlockedPickerCountrySearch?.addEventListener('input', () => {
		renderSwiftBlockedPickerCountries(swiftBlockedPickerCountrySearch?.value || '');
	});

	swiftBlockedPickerServerSearch?.addEventListener('input', () => {
		renderSwiftBlockedPickerServers(swiftBlockedPickerServerSearch?.value || '');
	});

	swiftBlockedPickerCountryList?.addEventListener('click', (event) => {
		const button = (event.target as HTMLElement)?.closest<HTMLButtonElement>('.swift-blocked-picker-item');
		const code = button?.dataset['countryCode'];
		if (!code) {
			return;
		}

		const entry = swiftBlockedPickerCountries.find(country => country.code === code);
		if (!entry) {
			return;
		}

		swiftBlockedPickerSelectedCountry = {code: entry.code, name: entry.name};
		swiftBlockedPickerServers = entry.logicals.slice();
		if (swiftBlockedPickerServerHeading) {
			swiftBlockedPickerServerHeading.textContent = `${c('Label').t`Country`}: ${entry.name}`;
		}
		if (swiftBlockedPickerCountryOnlyButton) {
			swiftBlockedPickerCountryOnlyButton.disabled = false;
		}
		if (swiftBlockedPickerServerSearch) {
			swiftBlockedPickerServerSearch.value = '';
		}

		renderSwiftBlockedPickerServers();
		setSwiftBlockedPickerStep('server');
		swiftBlockedPickerServerSearch?.focus();
	});

	swiftBlockedPickerServerList?.addEventListener('click', (event) => {
		const button = (event.target as HTMLElement)?.closest<HTMLButtonElement>('.swift-blocked-picker-item');
		const id = button?.dataset['serverId'];
		if (!id) {
			return;
		}

		const logical = swiftBlockedPickerServers.find(server => `${server.ID}` === id);
		if (!logical) {
			return;
		}

		addSwiftBlockedRule('server', {
			targetId: `${logical.ID}`,
			targetLabel: formatSwiftServerLabel(logical),
		});
		closeSwiftBlockedPicker();
	});

	swiftBlockedPickerModal?.addEventListener('close', () => {
		resetSwiftBlockedPicker();
	});

	disconnectButton.innerHTML = c('Action').t`Disconnect`;
	if (reconnectButton) {
		reconnectButton.innerHTML = c('Action').t`Reconnect`;
	}
	if (favoriteConnectButton) {
		favoriteConnectButton.innerHTML = c('Action').t`Favorites`;
		updateFavoriteConnectButton(!limitedUi);
	}

	const disconnect = async (type: StateChange = StateChange.DISCONNECT) => {
		const previousServer = connectionState?.server;
		const previousLogical = previousServer?.id ? getLogicalById(previousServer.id) : undefined;

		state.connected = false;
		refreshConnectionStatus();
		setLastChoiceWithCurrentOptions({connected: false});

		connectEventHandler.disconnect(previousLogical, previousServer);

		await sendMessageToBackground(type);
	};

	disconnectButton.addEventListener('click', async () => {
		await disconnect();
	});

	const showConnectedItemMarker = (area?: HTMLElement, connected?: boolean) => {
		if (typeof connected === 'undefined') {
			connected = state.connected;
		}

		const exitCountry = connectionState?.server?.exitCountry;
		const exitEnglishCity = connectionState?.server?.exitEnglishCity;
		const id = connectionState?.server?.id;

		(area || document).querySelectorAll<HTMLDivElement>('.country-name').forEach(nameSlot => {
			const currentCode = nameSlot.getAttribute('data-country-code');

			nameSlot.classList[connected && currentCode && currentCode === exitCountry
				? 'add'
				: 'remove'
				]('connected-list-item');
		});

		(area || document).querySelectorAll<HTMLDivElement>('.group-button').forEach(groupSlot => {
			const subGroup = groupSlot.getAttribute('data-subGroup');
			const groupExitCountry = groupSlot.getAttribute('data-exitCountry');
			const match = connected && subGroup && groupExitCountry && subGroup === exitEnglishCity && groupExitCountry === exitCountry;

			groupSlot.querySelectorAll<HTMLDivElement>('.group-name').forEach(nameSlot => {
				nameSlot.classList[match ? 'add' : 'remove']('connected-list-item');
			});
		});

		(area || document).querySelectorAll<HTMLDivElement>('.server-name').forEach(nameSlot => {
			nameSlot.classList[connected && id && nameSlot.getAttribute('data-server-id') === id
				? 'add'
				: 'remove'
				]('connected-list-item');
		});
	};

	const showFreeQuickConnect = simplifiedUi && isFreeTier;

	const formatRelativeTime = (connectedAt: number) => {
		const seconds = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl) {
			const locale = getLanguage().replace(/_/g, '-');
			const formatter = new Intl.RelativeTimeFormat([locale], {numeric: 'auto'});

			if (seconds < 60) {
				return formatter.format(-seconds, 'second');
			}

			if (minutes < 60) {
				return formatter.format(-minutes, 'minute');
			}

			if (hours < 24) {
				return formatter.format(-hours, 'hour');
			}

			return formatter.format(-days, 'day');
		}

		if (seconds < 60) {
			return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
		}

		if (minutes < 60) {
			return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
		}

		if (hours < 24) {
			return `${hours} hour${hours === 1 ? '' : 's'} ago`;
		}

		return `${days} day${days === 1 ? '' : 's'} ago`;
	};

	const updateReconnectButtonContent = async () => {
		if (!reconnectButton) {
			return;
		}

		const last = await getLastConnectedServer();
		if (!last?.exitCountry) {
			reconnectButton.classList.remove('reconnect-card');
			reconnectButton.textContent = c('Action').t`Reconnect`;
			return;
		}

		const countryName = escapeHtml(getCountryNameOrCode(last.exitCountry));
		const serverNameRaw = last.exitCity || last.exitEnglishCity || last.name || '';
		const serverName = serverNameRaw ? escapeHtml(serverNameRaw) : '';
		const relative = last.connectedAt ? formatRelativeTime(last.connectedAt) : c('Info').t`Recently`;
		const subtitle = escapeHtml(c('Info').t`Last connected ${relative}`);

		reconnectButton.classList.add('reconnect-card');
		reconnectButton.innerHTML = `
			<div class="reconnect-card-content">
				<div class="reconnect-flag">${getCountryFlag(last.exitCountry)}</div>
				<div class="reconnect-details">
					<div class="reconnect-title">
						<span class="reconnect-country">${countryName}</span>
						${serverName ? `<span class="reconnect-server">${serverName}</span>` : ''}
					</div>
					<div class="reconnect-subtitle">${subtitle}</div>
				</div>
				<div class="reconnect-action">${c('Action').t`Reconnect`}</div>
			</div>
		`;
	};


	let connectionAttemptTime = 0;
	let connectingChecker: ReturnType<typeof setInterval> | undefined = undefined;

	const serverChangeRemainingTimeView = document.querySelector<HTMLDivElement>('[data-page="server-change-remaining-time"]')!;

	const serverRotator = isFreeTier
		? new ServerRotator(
			quickConnectButton,
			serverChangeRemainingTimeView,
			() => {
				goTo('server-change-remaining-time');
				configureButtons(serverChangeRemainingTimeView);
			},
		)
		: undefined;

	const refreshConnectionStatus = (server?: ServerSummary, connecting = false) => {
		server || (server = connectionState?.server);
		updateSwiftConnectionInfo(server, connecting);
		setSpeedActive(state.connected && !connecting);
		const exitCountry = server?.exitCountry || '';
		const entryCountry = server?.entryCountry || '';
		const secureCore = !!(entryCountry && entryCountry !== exitCountry);
		const exitCity = server?.exitCity || '';
		const name = exitCity + ' ' + (server?.name || '').replace(new RegExp('^' + exitCountry + '#'), '#');
		const countryName = getCountryNameOrCode(exitCountry);
		const serverName = name.trim();
		const serverLabel = serverName ? `${countryName} - ${serverName}` : countryName;
		const exitIp = server?.exitIp || '';
		const canDisconnectOrCancel = (state.connected || connecting);
		disconnectButton.style.display = canDisconnectOrCancel ? 'block' : 'none';
		quickConnectButton.style.display = canDisconnectOrCancel && hasAccessToPaidServers ? 'none' : 'block';
		quickConnectButton.innerHTML = canDisconnectOrCancel ? c('Action').t`Change server` : c('Action').t`Connect`;
		quickConnectButton.classList[canDisconnectOrCancel ? 'add' : 'remove']('weak');
		updateFavoriteConnectButton(!limitedUi && quickConnectButton.style.display !== 'none');
		if (reconnectButton) {
			reconnectButton.style.display = canDisconnectOrCancel ? 'none' : 'block';
		}
		document.querySelectorAll<HTMLDivElement>('.quick-connect-button-subtitle').forEach(quickConnectSubtitle => {
			if (hasAccessToPaidServers) {
				return;
			}

			quickConnectSubtitle.style.display = canDisconnectOrCancel ? 'none' : 'block';
		});
		document.querySelectorAll<HTMLDivElement>('.quick-connect-button-incentive').forEach(quickConnectIncentive => {
			quickConnectIncentive.style.display = canDisconnectOrCancel ? 'none' : 'block';
		});
		logo.switchTo(canDisconnectOrCancel ? 'protected' : 'unprotected');
		showConnectedItemMarker(servers, state.connected && !connecting);

		serverRotator?.refreshState(canDisconnectOrCancel);
		triggerPromise(updateReconnectButtonContent());

		if (connecting) {
			connectionAttemptTime = Date.now();
			connectingChecker = setInterval(() => {
				sendMessageToBackground(StateChange.CONNECTING, {connectionAttemptTime});
			}, 500);
			disconnectButton.classList.remove('danger-hover');
			disconnectButton.innerHTML = c('Action').t`Cancel`;
			serverStatusSlot.classList.remove('success', 'danger');
			serverStatusSlot.innerHTML = `
				<div class="status-title">
					<div class="lds-ring"><div></div><div></div><div></div><div></div></div>
					<div id="connecting-label" class="protection-status">${c('Info').t`Connecting...`}</div>
				</div>

				<div class="current-server-description">
					<div class="current-server-flag">${getCountryFlag(exitCountry)}</div>
					<div>
						<div class="current-server-country">${serverLabel}</div>
						<div class="exit-ip">${exitIp}</div>
					</div>
				</div>
			`;

			return;
		}

		connectionAttemptTime = 0;

		if (connectingChecker) {
			clearInterval(connectingChecker);
		}

		connectEventHandler.finishConnection(state.connected);

		disconnectButton.innerHTML = c('Action').t`Disconnect`;
		disconnectButton.classList.add('danger-hover');
		toggleClass(serverStatusSlot, state.connected, 'success', 'danger');

		const baseCountries = ['US', 'NL', 'JP'];
		const freeCountriesList = [
			...baseCountries.filter(country => freeCountries[country]),
			...Object.keys(freeCountries).filter(country => !baseCountries.includes(country)),
		];

		const getCountryFlagGroup = (countries: string[]): string => {
			return countries.map((country, index) => `
				<span class="country-in-group${country !== countries[0] ? ' folded' : ''}" style="z-index: ${3 - index}">${
					getCountryFlag(country)
				}</span>`).join('');
		};

		serverStatusSlot.innerHTML = state.connected
			? `
				<div class="status-title">
					<svg role="img" focusable="false" aria-hidden="true" class="protection-icon medium-icon" viewBox="0 0 24 24">
						<use xlink:href="img/icons.svg#protected"></use>
					</svg>
					<div id="protected-label" class="protection-status">${c('Label').t`Protected`}</div>
				</div>

				<div class="current-server-description">
					<div class="current-server-flag ${secureCore ? ' wide' : ''}">${
						(secureCore ? `${getCountryFlag(entryCountry)} &nbsp;${via()}&nbsp;` : '') +
						getCountryFlag(exitCountry)
					}</div>
					<div>
						<div class="current-server-country">${serverLabel}</div>
						<div class="exit-ip">${exitIp}</div>
					</div>
				</div>
			`
			: `
				<div class="status-title">
					<svg role="img" focusable="false" aria-hidden="true" class="protection-icon medium-icon" viewBox="0 0 24 24">
						<use xlink:href="img/icons.svg#unprotected"></use>
					</svg>
					<div id="unprotected-label" class="protection-status">${c('Label').t`Unprotected`}</div>
				</div>

				${'' /*<div class="incentive">${c('Label').t`Protect yourself online`}</div>*/}
				${showFreeQuickConnect && browserExtensionEnabled ? `
				<div class="current-server-description">
					<div class="lightning">
						<svg class="lightning-symbol" viewBox="0 0 10 14">
							<use xlink:href="img/icons.svg#lightning"></use>
						</svg>
					</div>
					<div class="fastest-server" data-go-to="about-free-connections">
						<div class="current-server-country">${c('Info').t`Fastest free server`}</div>
						<div class="current-server-name">
							<span class="auto-select-label">${c('Info').t`Auto-selected from`}</span>
							<span>
							${freeCountriesList.length <= 3
								? getCountryFlagGroup(freeCountriesList)
								: getCountryFlagGroup(freeCountriesList.slice(0, 3)) + ' +' + (freeCountriesList.length - 3)}
							</span>
						</div>
					</div>
				</div>
				` : ''}
			`;

		configureButtons(serverStatusSlot);

		if (isFreeTier && freeCountriesListEl && freeCountryItemTemplate && freeCountriesCountEl) {
			// Clear the list
			let node = freeCountryItemTemplate.nextSibling;
			while (node) {
				const next = (node as any).nextElementSibling;
				freeCountriesListEl.removeChild(node);
				node = next;
			}

			// Fill the list with free countries
			Object.keys(freeCountries).forEach(countryCode => {
				const clone = freeCountryItemTemplate.content.firstElementChild?.cloneNode(true) as HTMLElement;
				if (clone) {
					const flagImg = clone.querySelector('.country-flag-img') as HTMLImageElement;
					const nameDiv = clone.querySelector('.country-name') as HTMLDivElement;
					if (flagImg) {
						flagImg.src = `/img/flags/${countryCode.toLowerCase()}.svg`;
						flagImg.alt = countryCode;
					}
					if (nameDiv) {
						nameDiv.setAttribute('data-country-code', countryCode);
						nameDiv.textContent = getCountryNameOrCode(countryCode);
					}
					freeCountriesListEl.appendChild(clone);
				}
			});

			freeCountriesCountEl.textContent = Object.keys(freeCountries).length.toString();
		}

		triggerPromise(refreshLocationSlots(true));
	};

	triggerPromise(showNotifications());


	getInfoFromBackground(BackgroundData.PM_USER).then(pmUser => {
		pmUserCache = {user: pmUser};
		const name = escapeHtml(pmUser.DisplayName || pmUser.Name || pmUser.Email || '');

		document.querySelectorAll<HTMLDivElement>('.pm-user-name').forEach((userName) => {
			userName.innerHTML = name;
		});
	});

	const plan = escapeHtml(
		user.VPN.PlanTitle || /* translator: plan title for free users */ c('Label').t`Free`,
	);

	document.querySelectorAll<HTMLDivElement>('.pm-plan').forEach((planName) => {
		planName.innerHTML = plan;
	});

	document.querySelectorAll<HTMLDivElement>('[data-open-account-page]').forEach((button) => {
		setNewTabLinkTitle(button);
		button.addEventListener('click', async () => {
			const url = accountURL + button.getAttribute('data-open-account-page');

			await openTab(await appendUpgradeParams(url));
			forgetAccount();
		});
	});

	document.querySelectorAll<HTMLInputElement>('.theme-choice input').forEach(input => {
		input.addEventListener('change', async () => {
			if (input.checked) {
				const value = input.value as Theme;
				setTheme(value);
				await storedTheme.set({value});
			}
		});
	});

	const rateUsModal = document.querySelector<HTMLDialogElement>('#rate-us');

	const connectToServer = async (logical: Logical) => {
		connectEventHandler.connect(logical);

		const server = pickServerInLogical(logical);

		if (!server) {
			throw new Error('Misconfigured server. Cannot find an entry for this server.');
		}

		try {
			const willHaveToConnect = !state.connected;
			state.connected = true;
			refreshConnectionStatus({
				id: logical.ID,
				name: logical.Name,
				exitIp: server.ExitIP,
				entryCountry: logical.EntryCountry,
				exitCountry: logical.ExitCountry,
				exitCity: logical.Translations?.City || logical.City,
				exitEnglishCity: logical.City,
				secureCore: ((logical.Features & Feature.SECURE_CORE) !== 0),
			}, willHaveToConnect);
			await sendMessageToBackground(StateChange.CONNECT, {
				server,
				logical,
				user,
				splitTunneling: getSplitTunnelingConfig(userTier, splitTunneling),
			});

			if (logical.ID) {
				triggerPromise(lookups.transaction(cache => {
					const id = `${logical.ID}`;

					// If this ID was obtained by lookup, then update the time so it does not
					// get picked first when cleaning up old IDs
					if (cache.value[id]) {
						cache.value[id] = Date.now();
						cache.time = Date.now();
					}

					return cache;
				}, {
					value: {} as Record<string, number>,
					time: Date.now(),
				}));
			}

			await setReviewInfoStateOnConnectAction();
			maybeShowRatingModal(rateUsModal, user);
		} catch (e) {
			setError(e as Error);
		}
	};

	const connectToFavorite = async () => {
		errorSlot.innerHTML = '';

		const favorites = getFavoriteLogicals();

		if (!favorites.length) {
			setError(new Error(c('Error').t`Please add at least one favorite server.`));

			return;
		}

		const logical = requireRandomLogical(favorites, userTier, setError);

		setLastChoiceWithCurrentOptions({
			connected: true,
			logicalId: logical.ID,
		});
		goTo('world');
		await connectToServer(logical);
	};

	if (favoriteConnectButton) {
		onClick(favoriteConnectButton, (event) => {
			event.stopPropagation();
			event.preventDefault();
			triggerPromise(connectToFavorite());
		});
	}

	const reconnectToLastServer = async () => {
		if (!reconnectButton) {
			return;
		}

		reconnectButton.disabled = true;

		try {
			const last = await getLastConnectedServer();
			if (!last?.id) {
				return;
			}

			const logical = getLogicalById(last.id);
			if (!logical) {
				throw new Error('Unable to find the last connected server.');
			}

			setLastChoiceWithCurrentOptions({
				connected: true,
				logicalId: logical.ID,
			});
			goTo('world');
			await connectToServer(logical);
		} catch (e) {
			setError(e as Error);
		} finally {
			reconnectButton.disabled = false;
		}
	};

	if (reconnectButton) {
		onClick(reconnectButton, (event) => {
			event.stopPropagation();
			event.preventDefault();
			triggerPromise(reconnectToLastServer());
		});
	}

	const closeSession = async (action: StateChange) => {
		if (state.connected) {
			const mainArea = document.querySelector<HTMLDivElement>('.main-area');

			if (mainArea) {
				const confirmModal = document.createElement('div');
				confirmModal.classList.add('confirm-modal');
				confirmModal.innerHTML = `<div>
					${
						c('Confirm').t`Logging out of the application will disconnect the active VPN connection. Do you want to continue?`
					}
					<div class="user-buttons-bar">
						<button data-st-action="cancel" class="tertiary-button" data-trans data-context="Action">Cancel</button>
						<button data-st-action="ok" class="primary-button" data-trans data-context="Action">OK</button>
					</div>
				</div>`;
				mainArea.appendChild(confirmModal);

				confirmModal.querySelectorAll<HTMLButtonElement>('[data-st-action="cancel"]').forEach(button => {
					button.addEventListener('click', () => {
						mainArea.removeChild(confirmModal);
					});
				});
				confirmModal.querySelectorAll<HTMLButtonElement>('[data-st-action="ok"]').forEach(button => {
					button.addEventListener('click', async () => {
						confirmModal.querySelectorAll<HTMLButtonElement>('[data-st-action]').forEach(otherButton => {
							otherButton.disabled = true;
						});

						try {
							await disconnect(action);
						} catch (e) {
							warn(e);
						} finally {
							await delay(1);
							window.close();
							mainArea.removeChild(confirmModal);
						}
					});
				});

				return;
			}
		}

		await disconnect(action);
		await delay(1);
		window.close();
	};


	switchButton.style.display = 'flex';
	switchButton.title = c('Action').t`Switch account`;
	switchButton.addEventListener('click', async () => {
		await closeSession(StateChange.SWITCH_ACCOUNT);
	});
	signOutButton.style.display = 'flex';
	signOutButton.title = c('Action').t`Sign out`;
	signOutButton.addEventListener('click', async () => {
		await closeSession(StateChange.SIGN_OUT);
	});
	menu.style.display = 'block';
	quickConnectButton.innerHTML = limitedUi
		? c('Action').t`Upgrade`
		: (showFreeQuickConnect ? c('Action').t`Connect` : c('Action').t`Quick connect`);
	quickConnectButton.addEventListener('click', async () => {
		if (isFreeTier && state.connected) {
			if (await serverRotator!.isPending()) {
				serverRotator!.showModal();

				return;
			}

			errorSlot.innerHTML = '';

			const alienLogicals = excludeLogicalsFromCurrentCountry(logicals, connectionState?.server?.exitCountry);
			const filteredLogicals = filterLogicalsWithCurrentFeatures(alienLogicals, userTier, secureCore);
			const logical = requireRandomLogical(filteredLogicals, userTier, setError);
			setLastChoice({
				connected: true,
				pick: 'random',
			});

			await connectToServer(logical);

			await serverRotator!.startCountdown();

			return;
		}

		if (limitedUi) {
			await openTab(appendUrlParams(manageAccountURL, {email: (await getPmUser())?.Email}));
			forgetAccount();

			return;
		}

		errorSlot.innerHTML = '';
		const logical = requireBestLogical(filterLogicalsWithCurrentFeatures(logicals, userTier, secureCore), userTier, setError);
		setLastChoice({
			connected: true,
			pick: 'fastest',
		});

		await connectToServer(logical);
	});

	(document.querySelector('#status') as HTMLDivElement).style.display = 'block';
	refreshConnectionStatus();

	['aria-label', 'title'].forEach(attribute => {
		document.querySelectorAll('[' + attribute + ']').forEach(button => {
			button.setAttribute(attribute, getTranslation(
				button.getAttribute('data-context') || 'Info',
				([value]) => value,
				[button.getAttribute(attribute) as string],
			));
		});
	});

	translateArea(document);

	const backStates: ({name: string, content: string})[] = [];

	document.querySelectorAll('[data-page="region"] .page-title .back-button').forEach(button => {
		button.addEventListener('click', () => {
			const backState = backStates.pop();

			if (!backState) {
				goTo('world');

				return;
			}

			const {name, content} = backState;

			setRegionPage(name, content);
		});
	});

	function goTo(page: string): void {
		if (page !== 'region') {
			currentRegionState = undefined;

			if (backStates.length) {
				backStates.splice(0, backStates.length);
			}
		}

		const zone = (page && ({
			// parent for each sub-page
			region: 'world',
			'split-tunneling': 'features',
		})[page]) || page;

		document.querySelectorAll('[data-go-to]').forEach(b => {
			b.classList[b.getAttribute('data-go-to') === zone ? 'add' : 'remove']('active');
			b.removeAttribute('aria-current');
		});

		if (page) {
			document.querySelectorAll<HTMLDivElement>('[data-page]').forEach(pageBlock => {
				const isActivePage = pageBlock.getAttribute('data-page') === page;
				pageBlock.classList[isActivePage ? 'add' : 'remove']('selected-page');

				if (isActivePage) {
					configureButtons(pageBlock);
					configureGoToButtons(pageBlock, goTo);
				}
			});
		}

		document.querySelectorAll('.page-view, .page-view [data-page]').forEach(pageBlock => {
			pageBlock.scrollTop = 0;
		});

		if (loggedView) {
			loggedView.scrollTop = 0;
		}
	}

	configureGoToButtons(document, goTo);

	const centralView = document.querySelector<HTMLDivElement>('.central-view');

	if (centralView) {
		const minWidth = parseInt(window.getComputedStyle(centralView).minWidth);
		const maxWidth = screen.availWidth * 0.8;

		if (minWidth > maxWidth) {
			centralView.style.minWidth = Math.round(maxWidth) + 'px';
		}

		const minHeight = parseInt(window.getComputedStyle(centralView).minHeight);
		const maxHeight = screen.availHeight * 0.8;

		if (minHeight > maxHeight) {
			centralView.style.minHeight = Math.round(maxHeight) + 'px';
		}
	}

	searchInput = document.getElementById('search-input') as HTMLInputElement;
	const search = searchInput;

	if (search) {
		search.focus();
		search.onkeyup = e => {
			if (e.key === 'Enter' || e.keyCode === 13) {
				const firstButton = servers.querySelector<HTMLElement>('.server, .connect-option');

				if (firstButton) {
					firstButton.click();
				}
			}
		};
		let lastSearchStart = 0;
		refresh = setUpSearch(search, async searchText => {
			const searchStart = Date.now();
			lastSearchStart = searchStart;
			const searching = (searchText !== '');

			if (!servers.querySelector(':scope > .spinner')) {
				setServersHtml(`<div class="spinner">
					<div class="lds-ring"><div></div><div></div><div></div><div></div></div>
				</div>`);
			}

			// Wait a bit for consecutive letters typed
			await delay(searching ? 300 : 1);

			if (lastSearchStart !== searchStart) {
				return;
			}

			setServersHtml(
				searching
					? getSearchResult(countries, searchText, userTier, secureCore)
					: countryList(countries, userTier, secureCore) || `<p class="not-found">
						${c('Error').t`Unable to load the list`}<br />
						<small>${
							/* translator: maybe internet connection is unstable, wi-fi too far, or API domain got censored by the ISP or country */
							c('Error').t`Please check your connectivity`
						}</small>
					</p>`,
				searchText,
			);
			configureButtons();
			configureServerGroups();
			showConnectedItemMarker();
		});

		toggleButtons(storedSecureCore, secureCore, {refresh, upgradeNeeded: isFreeTier});
		toggleButtons(storedNotificationsEnabled, notificationsEnabled);
		toggleButtons(storedAutoConnect, autoConnect);
		toggleButtons(telemetryOptIn, telemetry);
		toggleButtons(crashReportOptIn as any, crashReportEnabled, {buttonSelector: '.crash-button'});
		toggleButtons(storedPreventWebrtcLeak, preventWebrtcLeak, {refresh: async (newValue) => {
			await (state.connected
				? preventLeak(newValue)
				: setWebRTCState(WebRTCState.CLEAR)
			);
		}});
		configureSplitTunneling(storedSplitTunneling, splitTunneling, document, async (updatedList) => {
			if (state.connected) {
				await sendMessageToBackground(
					SettingChange.BYPASS_LIST,
					getSplitTunnelingConfig(userTier, updatedList || splitTunneling),
				);
			}
		}, userTier <= 0);
	}

	configureButtons();
	configureFavoriteButtons(document);
	syncFavoriteToggles(document);
	configureModalButtons(document.querySelector<HTMLDivElement>('#modals')!);
	configureRatingModalButtons(rateUsModal);

	watchBroadcastMessages({
		logicalUpdate(logicalsInput: Logical[]) {
			if (logicalsInput?.length) {
				logicals = logicalsInput;
				populateSwiftDatalists();
				triggerPromise(renderSwiftBlockedPrompt());
			}
		},
		changeState(data: ChangeStateMessage['data']) {
			switch (data.state) {
				case 'connected':
					state.connected = true;
					connectionState.server = data.server;
					refreshConnectionStatus(data.server);
					setError(data.error);
					triggerPromise(renderSwiftBlockedPrompt());
					break;

				case 'connecting':
					state.connected = false;
					connectionState.server = data.server;
					refreshConnectionStatus(data.server, true);
					setError(data.error);
					triggerPromise(renderSwiftBlockedPrompt());
					break;

				case 'logged-out':
					showSigningView(document.getElementById('sign-in-view'), loggedView, spinner, proxySupported);
					break;

				case 'disconnected':
					state.connected = false;
					connectionState.server = undefined;
					refreshConnectionStatus(data.server);
					setError(data.error);
					triggerPromise(renderSwiftBlockedPrompt());
					break;
			}
		},
		error: setError,
	});

	if (chrome.tabs?.onActivated) {
		chrome.tabs.onActivated.addListener(() => {
			triggerPromise(refreshSwiftMatchedRule());
		});
	}

	if (chrome.tabs?.onUpdated) {
		chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
			if (!tab?.active) {
				return;
			}

			if (!changeInfo.url && changeInfo.status !== 'complete') {
				return;
			}

			triggerPromise(refreshSwiftMatchedRule());
		});
	}

	const settingsPageTitle = document.querySelector('*[data-page="settings"] .page-title');

	settingsPageTitle?.addEventListener('dblclick', event => {
		const settingPage = document.querySelector('*[data-page="settings"]');

		if (!settingPage) {
			return;
		}

		const keyEvent = event as any;

		if (keyEvent.ctrlKey && keyEvent.altKey) {
			settingPage.classList.toggle('debug-mode');
		}
	});

	const maxTierInput = document.getElementById('max-tier') as HTMLInputElement|null;
	maxTierInput?.addEventListener('input', async () => {
		const oldValue = (global as any).logicalMaxTier || 2;
		const newValue = Number(maxTierInput.value);

		if (oldValue === newValue) {
			return;
		}

		(global as any).logicalMaxTier = newValue;
		await start();
	});

	maybeShowRatingModal(rateUsModal, user);
};

triggerPromise(start());

window.addEventListener('message', (event: MessageEvent<string>) => {
	if (!event.origin.startsWith(accountURL)) {
		return;
	}

	if (event.data === 'endFork') {
		const accountFrame = document.getElementById('account-frame');

		if (accountFrame) {
			accountFrame.style.display = 'none';
		}

		document.querySelectorAll<HTMLDivElement>('.main-area').forEach(area => {
			area.style.display = 'block';
		});
	}
}, false);

window.addEventListener('unhandledrejection', handleError);
window.addEventListener('error', handleError);
