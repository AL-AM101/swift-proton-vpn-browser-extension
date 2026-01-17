import type {SwiftRule} from './swiftRules';

export type SwiftUrlParts = {
	host: string;
	path: string;
};

export const normalizeSwiftPath = (value?: string | null): string | undefined => {
	if (!value || typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();

	if (!trimmed || trimmed === '/') {
		return undefined;
	}

	return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export const parseSwiftUrlInput = (value: string): {host: string, path: string | undefined} | null => {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	try {
		const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
		const host = url.hostname.toLowerCase().replace(/^www\./, '');
		const path = normalizeSwiftPath(url.pathname);

		return {host, path};
	} catch (error) {
		return null;
	}
};

export const getSwiftUrlParts = (url: string): SwiftUrlParts | null => {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
		const path = parsed.pathname || '/';

		return {host, path};
	} catch (error) {
		return null;
	}
};

export const buildSwiftHostLabel = (host: string, path?: string): string => (
	path ? `${host}${path}` : host
);

export const matchSwiftRule = (parts: SwiftUrlParts, rule: SwiftRule): boolean => {
	const hostMatches = parts.host === rule.host
		|| (rule.includeSubdomains && parts.host.endsWith('.' + rule.host));

	if (!hostMatches) {
		return false;
	}

	if (!rule.path) {
		return true;
	}

	return parts.path.startsWith(rule.path);
};

export const selectSwiftRule = (rules: SwiftRule[], parts: SwiftUrlParts): {
	rule: SwiftRule | undefined;
	matchingRules: SwiftRule[];
} => {
	const matchingRules = rules.filter(rule => matchSwiftRule(parts, rule));

	return {rule: matchingRules[0], matchingRules};
};
