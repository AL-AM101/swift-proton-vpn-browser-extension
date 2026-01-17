import {storage} from '../tools/storage';

export type SwiftBlockedSite = {
	host: string;
	url: string;
	time: number;
	statusCode?: number;
	error?: string;
};

export const swiftBlockedSiteItem = storage.item<{value: SwiftBlockedSite | null}>('swift-blocked-site');
