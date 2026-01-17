import type {CountryList} from '../../components/countryList';
import type {Logical} from '../../vpn/Logical';
import {resolveSwiftTarget} from '../swiftTargetResolver';

const makeLogical = (overrides: Partial<Logical> = {}): Logical => ({
	ID: 1,
	Domain: 'example.com',
	EntryCountry: 'AE',
	ExitCountry: 'AE',
	HostCountry: null,
	Features: 0,
	Location: {Lat: 0, Long: 0},
	Name: 'AE#1',
	Tier: 1,
	Visible: 1,
	Score: 0,
	Status: 1,
	...overrides,
});

const countries: CountryList = {
	AE: {
		name: 'United Arab Emirates',
		englishName: 'United Arab Emirates',
		needUpgrade: false,
	},
	FR: {
		name: 'France',
		englishName: 'France',
		needUpgrade: false,
	},
};

describe('swiftTargetResolver', () => {
	test('resolves server by name and id', () => {
		const logicals = [makeLogical()];
		expect(resolveSwiftTarget('server', 'AE#1', logicals, 1, countries)).toEqual({
			targetId: '1',
			targetLabel: 'AE#1',
		});
		expect(resolveSwiftTarget('server', '1', logicals, 1, countries)).toEqual({
			targetId: '1',
			targetLabel: 'AE#1',
		});
	});

	test('returns upgrade-required when tier too low', () => {
		const logicals = [makeLogical({Tier: 3})];
		expect(resolveSwiftTarget('server', 'AE#1', logicals, 1, countries)).toEqual({
			error: 'server-upgrade-required',
		});
	});

	test('resolves country by code and name', () => {
		expect(resolveSwiftTarget('country', 'AE', [], 1, countries)).toEqual({
			targetId: 'AE',
			targetLabel: 'United Arab Emirates',
		});
		expect(resolveSwiftTarget('country', 'france', [], 1, countries)).toEqual({
			targetId: 'FR',
			targetLabel: 'France',
		});
	});

	test('returns country-not-found for unknown input', () => {
		expect(resolveSwiftTarget('country', 'Narnia', [], 1, countries)).toEqual({
			error: 'country-not-found',
		});
	});
});
