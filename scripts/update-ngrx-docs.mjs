#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const skillDir = join(repoRoot, 'skills', 'ngrx-developer');
const referencesDir = join(skillDir, 'references');
const sourceFile = join(referencesDir, 'ngrx-source.json');
const guideDir = join(referencesDir, 'guide');
const skillFile = join(skillDir, 'SKILL.md');
const readmeFile = join(repoRoot, 'README.md');

const requiredGuideFiles = [
  'effects/index.md',
  'signals/signal-store/index.md',
  'store/index.md',
];

function parseArgs(args) {
  const options = { dryRun: false, force: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--force') {
      options.force = true;
    } else if (argument === '--version' || argument === '--commit') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }

      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.commit && !options.version) {
    throw new Error('--commit requires --version');
  }

  return options;
}

function assertStableVersion(version, label) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${label} must be a stable semantic version, received: ${version}`);
  }
}

function assertCommit(commit, label) {
  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error(`${label} must be a full Git commit SHA, received: ${commit}`);
  }
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return 0;
}

async function fetchPackageMetadata(packageName, version) {
  const packagePath = encodeURIComponent(packageName);
  const versionPath = version ? encodeURIComponent(version) : 'latest';
  const url = `https://registry.npmjs.org/${packagePath}/${versionPath}`;
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`npm registry returned ${response.status} for ${url}`);
  }

  return response.json();
}

async function downloadArchive(commit, destination) {
  const url = `https://codeload.github.com/ngrx/platform/tar.gz/${commit}`;
  const response = await fetch(url, {
    headers: { 'user-agent': 'ngrx-developer-docs-updater' },
    redirect: 'follow',
  });

  if (!response.ok || !response.body) {
    throw new Error(`GitHub returned ${response.status} for ${url}`);
  }

  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(destination)
  );
}

async function findExtractedRoot(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const roots = entries.filter(
    (entry) => entry.isDirectory() && entry.name.startsWith('platform-')
  );

  if (roots.length !== 1) {
    throw new Error(`Expected one extracted platform directory, found ${roots.length}`);
  }

  return join(directory, roots[0].name);
}

async function countMarkdownFiles(directory) {
  let count = 0;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      count += await countMarkdownFiles(path);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      count += 1;
    }
  }

  return count;
}

async function validateGuide(directory) {
  const directoryStats = await stat(directory).catch(() => null);
  if (!directoryStats?.isDirectory()) {
    throw new Error(`NgRx guide directory is missing: ${directory}`);
  }

  for (const relativePath of requiredGuideFiles) {
    const fileStats = await stat(join(directory, relativePath)).catch(() => null);
    if (!fileStats?.isFile()) {
      throw new Error(`Required NgRx guide file is missing: ${relativePath}`);
    }
  }

  const markdownFiles = await countMarkdownFiles(directory);
  if (markdownFiles < 100) {
    throw new Error(
      `Expected at least 100 Markdown guide files, found ${markdownFiles}`
    );
  }

  return markdownFiles;
}

function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) {
    throw new Error(`Could not find ${label} in repository metadata`);
  }

  return content.split(from).join(to);
}

async function prepareMetadataUpdates(currentSource, nextSource) {
  const [skill, readme] = await Promise.all([
    readFile(skillFile, 'utf8'),
    readFile(readmeFile, 'utf8'),
  ]);

  let nextSkill = replaceRequired(
    skill,
    `official NgRx ${currentSource.version} guide snapshot`,
    `official NgRx ${nextSource.version} guide snapshot`,
    'SKILL.md snapshot version'
  );
  nextSkill = replaceRequired(
    nextSkill,
    `package version ${currentSource.version}:`,
    `package version ${nextSource.version}:`,
    'SKILL.md provenance version'
  );
  nextSkill = replaceRequired(
    nextSkill,
    currentSource.commit,
    nextSource.commit,
    'SKILL.md source commit'
  );

  const nextReadme = replaceRequired(
    readme,
    `official NgRx ${currentSource.version} guide snapshot pinned to commit \`${currentSource.commit}\``,
    `official NgRx ${nextSource.version} guide snapshot pinned to commit \`${nextSource.commit}\``,
    'README snapshot provenance'
  );

  return { nextReadme, nextSkill };
}

async function replaceGuide(sourceGuide) {
  const stagedGuide = join(referencesDir, `.guide-next-${process.pid}`);
  const backupGuide = join(referencesDir, `.guide-backup-${process.pid}`);

  await rm(stagedGuide, { force: true, recursive: true });
  await rm(backupGuide, { force: true, recursive: true });
  await cp(sourceGuide, stagedGuide, { recursive: true });

  try {
    await rename(guideDir, backupGuide);
    await rename(stagedGuide, guideDir);
    await rm(backupGuide, { force: true, recursive: true });
  } catch (error) {
    const guideStats = await stat(guideDir).catch(() => null);
    const backupStats = await stat(backupGuide).catch(() => null);

    if (!guideStats && backupStats) {
      await rename(backupGuide, guideDir);
    }

    await rm(stagedGuide, { force: true, recursive: true });
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const currentSource = JSON.parse(await readFile(sourceFile, 'utf8'));

  assertStableVersion(currentSource.version, 'Pinned NgRx version');
  assertCommit(currentSource.commit, 'Pinned NgRx commit');

  const packageMetadata = await fetchPackageMetadata(
    currentSource.package,
    options.version
  );
  const nextSource = {
    ...currentSource,
    version: packageMetadata.version,
    commit: options.commit ?? packageMetadata.gitHead,
  };

  assertStableVersion(nextSource.version, 'Target NgRx version');
  assertCommit(nextSource.commit, 'Target NgRx commit');

  const versionComparison = compareVersions(
    nextSource.version,
    currentSource.version
  );

  if (!options.force && versionComparison === 0) {
    console.log(
      `NgRx documentation is current at ${currentSource.version} (${currentSource.commit}).`
    );
    return;
  }

  if (!options.force && versionComparison < 0) {
    throw new Error(
      `Refusing to downgrade NgRx from ${currentSource.version} to ${nextSource.version}; use --force to override`
    );
  }

  const metadataUpdates = await prepareMetadataUpdates(
    currentSource,
    nextSource
  );
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'ngrx-docs-'));

  try {
    const archive = join(temporaryDirectory, 'platform.tar.gz');
    await downloadArchive(nextSource.commit, archive);
    await execFileAsync('tar', ['-xzf', archive, '-C', temporaryDirectory]);

    const extractedRoot = await findExtractedRoot(temporaryDirectory);
    const sourceGuide = join(extractedRoot, currentSource.guidePath);
    const markdownFiles = await validateGuide(sourceGuide);

    if (options.dryRun) {
      console.log(
        `Dry run passed for NgRx ${nextSource.version} (${nextSource.commit}); found ${markdownFiles} guide files.`
      );
      return;
    }

    await replaceGuide(sourceGuide);
    await Promise.all([
      writeFile(skillFile, metadataUpdates.nextSkill),
      writeFile(readmeFile, metadataUpdates.nextReadme),
      writeFile(sourceFile, `${JSON.stringify(nextSource, null, 2)}\n`),
    ]);

    console.log(
      `Updated NgRx documentation to ${nextSource.version} (${nextSource.commit}); copied ${markdownFiles} guide files.`
    );
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
