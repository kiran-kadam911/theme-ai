#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import chalk from 'chalk';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
let openai = null;

if (hasOpenAIKey) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  console.warn(chalk.yellow('⚠️ No OpenAI API key found. AI suggestions will be skipped.\n'));
}

function readPackageJson() {
  const filePath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(filePath)) {
    console.error('❌ package.json not found in current directory.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function recommendNodeVersion(pkg) {
  return pkg.engines?.node || '18.x (Recommended LTS)';
}

function scanForScssFiles(baseDir) {
  const result = [];
  const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'vendor'];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory() && !ignoredDirs.includes(file.name)) {
        walk(fullPath);
      } else if (file.name.endsWith('.scss')) {
        result.push(fullPath);
      }
    }
  }

  walk(baseDir);
  return result;
}

function detectStacksFromFiles() {
  const stack = new Set();
  const files = fs.readdirSync(__dirname);

  const stackMatchers = [
    { file: 'webpack.config.js', label: 'Webpack' },
    { file: 'vite.config.js', label: 'Vite' },
    { file: 'gulpfile.js', label: 'Gulp' },
    { file: 'Gruntfile.js', label: 'Grunt' },
    { file: 'postcss.config.js', label: 'PostCSS' },
    { file: 'tailwind.config.js', label: 'Tailwind CSS' },
    { file: '.babelrc', label: 'Babel' },
    { file: 'tsconfig.json', label: 'TypeScript' },
    { file: '.stylelintrc', label: 'Stylelint' },
    { file: '.eslintrc', label: 'ESLint' },
    { file: 'storybook/main.js', label: 'Storybook' },
  ];

  for (const { file, label } of stackMatchers) {
    if (fs.existsSync(path.join(__dirname, file))) {
      stack.add(label);
    }
  }

  // Detect SCSS
  const scssFiles = scanForScssFiles(__dirname);
  if (scssFiles.length > 0) {
    stack.add('SCSS (Sass)');
  }

  // Detect JS frameworks
  const lookForKeywords = [
    { keyword: 'react', label: 'React' },
    { keyword: 'vue', label: 'Vue' },
    { keyword: 'next', label: 'Next.js' },
    { keyword: 'nuxt', label: 'Nuxt.js' },
    { keyword: 'lit', label: 'Lit' },
  ];

  const sourceDirs = ['src', 'components', 'js', 'scripts'];
  for (const dir of sourceDirs) {
    const dirPath = path.join(__dirname, dir);
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
  console.log(chalk.blue.bold('🔍 Analyzing theme...'));

  const pkg = readPackageJson();
  const outdated = getOutdatedPackages();
  const recommendedNode = recommendNodeVersion(pkg);
  const stack = detectStacksFromFiles();

  console.log(chalk.green('\n🧱 Detected Stack:'));
  if (stack.length) {
    stack.forEach(item => console.log(`- ${item}`));
  } else {
    console.log('Could not identify any major tools or frameworks.');
  }

  console.log(chalk.green('\n📦 Detected Node version requirement:'), recommendedNode);

  if (Object.keys(outdated).length) {
    console.log(chalk.yellow('\n⬆️ Outdated packages detected:'));
    for (const [pkgName, { current, latest }] of Object.entries(outdated)) {
      console.log(`- ${pkgName}: ${current} → ${latest}`);
    }
  } else {
    console.log(chalk.green('✅ All packages are up to date.'));
  }

  const aiPrompt = `Given the following outdated packages:\n${JSON.stringify(outdated, null, 2)}\n\nSuggest which files to update/add/delete in a typical frontend theme (like in a Drupal or Node project), to apply these updates and follow best practices. Also, recommend the correct Node.js LTS version to use.`;

  const aiResponse = await askAI(aiPrompt);
  console.log(chalk.cyan('\n🤖 AI Suggestions:\n'));
  console.log(aiResponse);
}

runAnalysis();
