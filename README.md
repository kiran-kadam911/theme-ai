# 🔍 Theme Stack Analyzer

A smart CLI tool to **analyze frontend themes** (like those in Drupal, Node, or design systems) and detect:

- ✅ Build tools (Webpack, Vite, Gulp, PostCSS, etc.)
- 🎨 Styling stacks (SCSS/SASS, Tailwind, Stylelint)
- ⚛️ Frameworks (React, Vue, Next.js, etc.)
- 📦 Outdated dependencies
- 🤖 AI-powered upgrade recommendations
- ⚙️ Suggested Node.js version based on your theme’s `package.json`

---

## ⚙️ Prerequisites

Before using this tool, make sure you have the following installed:

1. **Node.js v18.x or higher**

   Use `node -v` to check your version.  
   You can download it from [https://nodejs.org](https://nodejs.org) or use a version manager like nvm.

2. **npm** (comes with Node.js)

   Use `npm -v` to verify it's installed.

3. **OpenAI API Key**

---

## 📦 Install via npm

You can install this tool globally to use from anywhere:

```bash
npm install -g @kirank911/theme-ai
```

Or use it locally in a project:

```bash
npm install --save-dev @kirank911/theme-ai
```

---

## 🚀 Usage

If installed globally, run:

```bash
theme-ai
```

If installed locally, use npx:

```bash
npx theme-ai
```

Or run via npm script (if added in your package.json scripts section):

```bash
npm run analyze
```

Make sure you are inside the directory containing `package.json`.

---

## 🔐 Setup OpenAI API Key

To enable AI-based recommendations:

1. Create a `.env` file in your project root:

    ```bash
    touch .env
    ```

2. Add your API key:

    ```bash
    OPENAI_API_KEY=your-openai-key-here
    ```

You can get your key from [https://platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys).

---

## 📊 What It Detects

| Category      | Tools Detected                                                   |
| ------------- | ---------------------------------------------------------------- |
| Build Tools   | Webpack, Vite, Gulp, Grunt, PostCSS, Babel                       |
| Frameworks    | React, Vue, Next.js, Nuxt.js, Lit                                |
| Style Tools   | SCSS/SASS, Tailwind CSS, Stylelint                               |
| Linting       | ESLint, Stylelint                                                |
| TypeScript    | TypeScript via `tsconfig.json`                                   |
| Documentation | Storybook via `storybook/main.js`                                |
| Package State | Outdated packages via `npm outdated`                             |
| Node Version  | `engines.node` in `package.json`, or recommends `>=18.x` default |

---

## 🧠 Example Output

```
🔍 Analyzing theme...

🧱 Detected Stack:
- Webpack
- SCSS (Sass)
- React
- ESLint
- Tailwind CSS

📦 Detected Node version requirement: >=18.x (based on dependencies)

⬆️ Outdated packages detected:
- webpack: 5.60.0 → 5.88.1
- tailwindcss: 3.3.0 → 3.4.1

🤖 AI Suggestions:
- Update `webpack`, `tailwindcss` in your package.json
- Check for breaking changes in config files
- Rebuild your lock file: `rm -rf node_modules package-lock.json && npm install`
```
