import {type CacheWrappedValue, Storage, storage} from '../tools/storage';
import {triggerPromise} from '../tools/triggerPromise';
import type {ProxyServer} from './ConnectionState';

export type LastConnectedServer = {
	id?: ProxyServer['id'];
	name?: ProxyServer['name'];
	entryCountry?: ProxyServer['entryCountry'];
	exitCountry?: ProxyServer['exitCountry'];
	exitCity?: ProxyServer['exitCity'];
	exitEnglishCity?: ProxyServer['exitEnglishCity'];
	secureCore?: ProxyServer['secureCore'];
	proxyHost?: ProxyServer['proxyHost'];
	proxyPort?: ProxyServer['proxyPort'];
	connectedAt: number;
};

type Item = CacheWrappedValue<LastConnectedServer>;

const lastConnectedServer = storage.item<Item>('last-connected-server', Storage.LOCAL);

export const setLastConnectedServer = (server?: ProxyServer): void => {
	// Only save when it's a real server object
	if (!server?.proxyHost) return;

	triggerPromise(lastConnectedServer.setValue({
		id: server.id,
		name: server.name,
		entryCountry: server.entryCountry,
		exitCountry: server.exitCountry,
		exitCity: server.exitCity,
		exitEnglishCity: server.exitEnglishCity,
		secureCore: server.secureCore,
		proxyHost: server.proxyHost,
		proxyPort: server.proxyPort,
		connectedAt: Date.now(),
	}));
};

export const getLastConnectedServer = async (): Promise<LastConnectedServer | null> =>
	(await lastConnectedServer.get())?.value || null;

export const forgetLastConnectedServer = () => triggerPromise(lastConnectedServer.remove());
