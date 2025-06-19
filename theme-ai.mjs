#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import chalk from 'chalk';
import OpenAI from 'openai';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ncu = require('npm-check-updates');
import getPackageJson from 'package-json';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = process.cwd();

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const openai = hasOpenAIKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

if (!hasOpenAIKey) {
  console.warn(chalk.yellow('⚠️ No OpenAI API key found. AI suggestions will be skipped.\n'));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readPackageJson() {
  const filePath = path.join(projectRoot, 'package.json');
  const pkg = readJson(filePath);
  if (!pkg) {
    console.error('❌ package.json not found in current directory.');
    process.exit(1);
  }
  return pkg;
}

function getOutdatedPackages() {
  try {
    const output = execSync('npm outdated --json', { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (err) {
    if (err.stdout) return JSON.parse(err.stdout);
    return {};
  }
}

async function getRecommendedNodeVersionFromPackages(outdated) {
  const versions = [];
  for (const [dep, { latest }] of Object.entries(outdated)) {
    try {
      const metadata = await getPackageJson(dep, { version: latest });
      if (metadata.engines?.node) {
        versions.push(metadata.engines.node);
      }
    } catch {
      console.warn(chalk.gray(`⚠️ Could not fetch engine info for ${dep}`));
    }
  }

  if (!versions.length) return '>=18.0.0'; // fallback to default LTS

  const sorted = versions
    .filter(v => v.match(/^>=\d/))
    .sort((a, b) => {
      const aNum = parseFloat(a.replace(/[^\d.]/g, ''));
      const bNum = parseFloat(b.replace(/[^\d.]/g, ''));
      return bNum - aNum;
    });

  return sorted[0] || '>=18.0.0';
}

function scanForFiles(baseDir, ext) {
  const result = [];
  const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'vendor'];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory() && !ignoredDirs.includes(file.name)) {
        walk(fullPath);
      } else if (file.name.endsWith(ext)) {
        result.push(fullPath);
      }
    }
  }

  walk(baseDir);
  return result;
}

function detectStacksFromFiles() {
  const stack = new Set();
  const stackMatchers = [
    { file: 'webpack.config.js', label: 'Webpack' },
    { file: 'vite.config.js', label: 'Vite' },
    { file: 'gulpfile.js', label: 'Gulp' },
    { file: 'Gruntfile.js', label: 'Grunt' },
    { file: 'postcss.config.js', label: 'PostCSS' },
    { file: 'tailwind.config.js', label: 'Tailwind CSS' },
    { file: '.babelrc', label: 'Babel' },
    { file: 'babel.config.js', label: 'Babel' },
    { file: 'tsconfig.json', label: 'TypeScript' },
    { file: '.stylelintrc', label: 'Stylelint' },
    { file: '.eslintrc', label: 'ESLint' },
    { file: 'storybook/main.js', label: 'Storybook' },
  ];

  for (const { file, label } of stackMatchers) {
    if (fs.existsSync(path.join(projectRoot, file))) {
      stack.add(label);
    }
  }

  const pkg = readPackageJson();
  if (pkg.dependencies?.bootstrap || pkg.devDependencies?.bootstrap) {
    stack.add('Bootstrap');
  }

  if (scanForFiles(projectRoot, '.scss').length > 0) {
    stack.add('SCSS (Sass)');
  }

  const lookForKeywords = [
    { keyword: 'react', label: 'React' },
    { keyword: 'vue', label: 'Vue' },
    { keyword: 'next', label: 'Next.js' },
    { keyword: 'nuxt', label: 'Nuxt.js' },
    { keyword: 'lit', label: 'Lit' },
  ];

  const sourceDirs = ['src', 'components', 'js', 'scripts'];
  for (const dir of sourceDirs) {
    const dirPath = path.join(projectRoot, dir);
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.js')) {
        const content = fs.readFileSync(path.join(dirPath, file.name), 'utf8');
        for (const { keyword, label } of lookForKeywords) {
          if (content.includes(keyword)) {
            stack.add(label);
          }
        }
      }
    }
  }

  return [...stack];
}

function createUpdatedPackageJson(pkg, outdated, recommendedNode) {
  const updated = JSON.parse(JSON.stringify(pkg));
  for (const [dep, { latest }] of Object.entries(outdated)) {
    if (updated.dependencies?.[dep]) {
      updated.dependencies[dep] = latest;
    } else if (updated.devDependencies?.[dep]) {
      updated.devDependencies[dep] = latest;
    }
  }

  updated.engines = {
    ...(updated.engines || {}),
    node: recommendedNode
  };

  fs.writeFileSync(
    path.join(projectRoot, 'package-updated.json'),
    JSON.stringify(updated, null, 2),
    'utf8'
  );

  console.log(chalk.green('\n📦 Created package-updated.json with latest versions and engines.node ='), chalk.cyan(recommendedNode));
}

async function askAI(prompt) {
  if (!hasOpenAIKey) {
    return '⚠️ Skipping AI suggestions (no API key found).';
  }
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for developers.' },
        { role: 'user', content: prompt },
      ],
    });
    return response.choices[0].message.content.trim();
  } catch (err) {
    return `⚠️ Failed to fetch AI suggestions: ${err.message}`;
  }
}

async function runAnalysis() {
  console.log(chalk.blue.bold('\n🔍 Analyzing theme...'));

  const pkg = readPackageJson();
  const outdated = getOutdatedPackages();
  const stack = detectStacksFromFiles();
  const recommendedNode = await getRecommendedNodeVersionFromPackages(outdated);

  console.log(chalk.green('\n🧱 Detected Stack:'));
  stack.length ? stack.forEach(item => console.log(`- ${item}`)) : console.log('None detected.');

  console.log(chalk.green('\n📦 Recommended Node version based on packages:'), chalk.cyan(recommendedNode));

  if (Object.keys(outdated).length) {
    console.log(chalk.yellow('\n⬆️ Outdated packages detected:'));
    for (const [name, { current, latest }] of Object.entries(outdated)) {
      console.log(`- ${name}: ${current} → ${latest}`);
    }
    createUpdatedPackageJson(pkg, outdated, recommendedNode);
  } else {
    console.log(chalk.green('✅ All packages are up to date.'));
  }

  const aiPrompt = `Given these outdated packages:\n${JSON.stringify(outdated, null, 2)}\n\nSuggest which files or configs to update in a frontend project (Drupal theme, Node-based). Also recommend the best Node.js LTS version.`;

  const aiResponse = await askAI(aiPrompt);
  console.log(chalk.cyan('\n🤖 AI Suggestions:\n'));
  console.log(aiResponse);
}

runAnalysis();
