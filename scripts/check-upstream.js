const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const args = process.argv.slice(2);

const getArg = (name) => {
	const index = args.indexOf(name);
	if (index === -1) {
		return undefined;
	}
	return args[index + 1];
};

const hasFlag = (name) => args.includes(name);

const repo = getArg('--repo') || process.env.UPSTREAM_REPO || 'ProtonVPN/proton-vpn-browser-extension';
const branch = getArg('--branch') || process.env.UPSTREAM_BRANCH || 'main';
const reportPathArg = getArg('--report');
const failOnMismatch = hasFlag('--fail-on-mismatch');

const rootDir = path.resolve(__dirname, '..');
const localConfigPath = path.join(rootDir, 'config.js');
const localManifestPath = path.join(rootDir, 'source', 'manifest.json');

const upstreamConfigUrl = `https://raw.githubusercontent.com/${repo}/${branch}/config.js`;
const upstreamManifestUrl = `https://raw.githubusercontent.com/${repo}/${branch}/source/manifest.json`;

const fetchText = (url, redirects = 0) => new Promise((resolve, reject) => {
	const request = https.get(url, {headers: {'User-Agent': 'swift-proton-upstream-check'}}, (response) => {
		if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
			if (redirects >= 5) {
				reject(new Error(`Too many redirects fetching ${url}`));
				return;
			}

			resolve(fetchText(response.headers.location, redirects + 1));
			return;
		}

		if (response.statusCode !== 200) {
			reject(new Error(`Request failed for ${url}: ${response.statusCode} ${response.statusMessage}`));
			response.resume();
			return;
		}

		let data = '';
		response.setEncoding('utf8');
		response.on('data', (chunk) => {
			data += chunk;
		});
		response.on('end', () => resolve(data));
	});

	request.on('error', reject);
});

const parseConfig = (text) => {
	const appVersionMatch = text.match(/appVersion:\s*'([^']+)'/);
	const appIdMatch = text.match(/appId:\s*'([^']+)'/);

	if (!appVersionMatch) {
		throw new Error('Unable to find appVersion in config.js');
	}

	if (!appIdMatch) {
		throw new Error('Unable to find appId in config.js');
	}

	return {
		appVersion: appVersionMatch[1],
		appId: appIdMatch[1],
	};
};

const parseManifest = (text) => {
	const data = JSON.parse(text);
	if (!data.version) {
		throw new Error('Unable to find version in manifest.json');
	}
	return {version: data.version};
};

const setOutput = (name, value) => {
	if (!process.env.GITHUB_OUTPUT) {
		return;
	}
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};

const renderReport = ({
	repoName,
	repoBranch,
	upstream,
	local,
	mismatch,
	manifestMismatch,
}) => {
	const lines = [
		'# Upstream version check',
		``,
		`- Upstream repo: \`${repoName}@${repoBranch}\``,
		`- Upstream appVersion: \`${upstream.appVersion}\``,
		`- Local appVersion: \`${local.appVersion}\``,
		`- Upstream appId: \`${upstream.appId}\``,
		`- Local appId: \`${local.appId}\``,
		`- Upstream manifest version: \`${upstream.manifestVersion}\``,
		`- Local manifest version: \`${local.manifestVersion}\``,
		`- Status: ${mismatch ? 'Mismatch detected' : 'No blocking mismatches detected'}${manifestMismatch ? ' (manifest differs)' : ''}`,
		``,
		`Checked at: ${new Date().toISOString()}`,
	];

	return lines.join('\n');
};

const main = async () => {
	const [upstreamConfig, upstreamManifest] = await Promise.all([
		fetchText(upstreamConfigUrl),
		fetchText(upstreamManifestUrl),
	]);

	const upstreamConfigData = parseConfig(upstreamConfig);
	const upstreamManifestData = parseManifest(upstreamManifest);
	const localConfigData = parseConfig(fs.readFileSync(localConfigPath, 'utf8'));
	const localManifestData = parseManifest(fs.readFileSync(localManifestPath, 'utf8'));

	const mismatch = (
		upstreamConfigData.appVersion !== localConfigData.appVersion
		|| upstreamConfigData.appId !== localConfigData.appId
	);
	const manifestMismatch = upstreamManifestData.version !== localManifestData.version;

	const report = renderReport({
		repoName: repo,
		repoBranch: branch,
		upstream: {
			...upstreamConfigData,
			manifestVersion: upstreamManifestData.version,
		},
		local: {
			...localConfigData,
			manifestVersion: localManifestData.version,
		},
		mismatch,
		manifestMismatch,
	});

	if (reportPathArg) {
		const resolvedPath = path.resolve(reportPathArg);
		fs.writeFileSync(resolvedPath, `${report}\n`);
		setOutput('report_path', resolvedPath);
	}

	setOutput('mismatch', mismatch ? 'true' : 'false');
	setOutput('upstream_app_version', upstreamConfigData.appVersion);
	setOutput('local_app_version', localConfigData.appVersion);
	setOutput('upstream_app_id', upstreamConfigData.appId);
	setOutput('local_app_id', localConfigData.appId);
	setOutput('upstream_manifest_version', upstreamManifestData.version);
	setOutput('local_manifest_version', localManifestData.version);

	process.stdout.write(`${report}\n`);

	if (mismatch && (failOnMismatch || !process.env.GITHUB_ACTIONS)) {
		process.exitCode = 1;
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 2;
});
