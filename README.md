<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e403537c-6155-4f46-aaf8-e69529f15b49

## Run Locally

**Prerequisites:** Node.js 24.22.1 or a newer 24.x release (see `.node-version`).


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Node.js security baseline

The minimum Node.js version includes the [October 21, 2026 security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
Upgrade your local Node.js installation before running development servers or tests; changing project configuration does not upgrade an existing system installation.
The project enables npm's `engine-strict` setting so dependency installation fails on unsupported Node.js versions.
Use `npm ci` to install the reviewed dependency versions, and `npm audit` to check both direct and transitive dependencies, including development tools.

This project deploys static files; Node.js is used for the build, local development server, and tests.
Vercel selects the latest available Node.js 24.x version from `engines.node` and manages minor and patch updates.
The build logs its actual Node.js version so the platform's patch level can be verified on the next deployment.
