import type {Logical} from '../vpn/Logical';
import type {CountryList} from '../components/countryList';
import type {SwiftTargetType} from './swiftRules';

export type SwiftTargetResolution =
	| {targetId: string; targetLabel: string}
	| {error: 'empty-input' | 'server-not-found' | 'server-upgrade-required' | 'country-not-found'};

export const resolveSwiftTarget = (
	targetType: SwiftTargetType,
	input: string,
	logicals: Logical[],
	userTier: number,
	countries: CountryList,
): SwiftTargetResolution => {
	const trimmed = input.trim();

	if (!trimmed) {
		return {error: 'empty-input'};
	}

	if (targetType === 'server') {
		const normalized = trimmed.toLowerCase();
		const logical = logicals.find(item => `${item.ID}` === trimmed || item.Name.toLowerCase() === normalized);

		if (!logical) {
			return {error: 'server-not-found'};
		}

		if (logical.Tier > userTier) {
			return {error: 'server-upgrade-required'};
		}

		return {
			targetId: `${logical.ID}`,
			targetLabel: logical.Name,
		};
	}

	const normalized = trimmed.toLowerCase();
	const countryCode = Object.keys(countries).find(code => code.toLowerCase() === normalized)
		|| Object.keys(countries).find(code => {
			const country = countries[code];

			return country?.name?.toLowerCase() === normalized
				|| country?.englishName?.toLowerCase() === normalized;
		});

	if (!countryCode) {
		return {error: 'country-not-found'};
	}

	return {
		targetId: countryCode,
		targetLabel: countries[countryCode]?.name || countryCode,
	};
};
