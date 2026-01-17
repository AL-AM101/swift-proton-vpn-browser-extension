const {
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');
const decompress = require('decompress');

const source = process.argv[2];
const dest = process.argv[3] || source;
const tempDir = '__temp';
const timeFile = 'commit-time.txt';

const ensureCommitTime = () => {
	if (!existsSync(timeFile)) {
		writeFileSync(timeFile, `${(Number(process.env.COMMIT_TIME) * 1000) || Date.now()}`);
	}

	const time = Number(readFileSync(timeFile)) || Date.now();

	return new Date(time);
};

const normalizeZipPath = (filePath) => filePath.replace(/\\/g, '/');

const createArchive = (files, date, destPath) => new Promise((resolve, reject) => {
	const output = createWriteStream(destPath);
	const archive = archiver('zip', {zlib: {level: 9}});

	output.on('close', resolve);
	output.on('error', reject);
	archive.on('error', reject);

	archive.pipe(output);
	files.forEach(filePath => {
		const fullPath = path.join(tempDir, filePath);
		archive.file(fullPath, {name: normalizeZipPath(filePath), date});
	});
	archive.finalize();
});

const repack = async () => {
	if (!source) {
		throw new Error('Missing source zip path.');
	}

	if (existsSync(tempDir)) {
		rmSync(tempDir, {recursive: true, force: true});
	}

	const files = await decompress(source, tempDir);
	const date = ensureCommitTime();
	const destPath = path.resolve(dest);

	if (existsSync(destPath)) {
		unlinkSync(destPath);
	}

	mkdirSync(path.dirname(destPath), {recursive: true});

	const filePaths = files
		.filter(file => file.type === 'file')
		.map(file => file.path)
		.sort();

	await createArchive(filePaths, date, destPath);
	rmSync(tempDir, {recursive: true, force: true});
};

repack().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
