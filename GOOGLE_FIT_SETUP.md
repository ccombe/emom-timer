# Google Fit Integration Setup Guide

To enable Google Fit integration for the EMOM Timer, you need to configure a Google Cloud Project and create OAuth 2.0 Credentials.

## Prerequisites

- A Google Account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **"New Project"**.
3. Name it "EMOM Timer" (or similar) and click **Create**.

## Step 2: Enable the Fitness API

1. In the sidebar, go to **APIs & Services > Library**.
2. Search for **"Fitness API"**.
3. Click on **Fitness API** and then click **Enable**.

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** User Type (unless you are in a Google Workspace organization) and click **Create**.
3. **App Information**:
   - App Name: `EMOM Timer`
   - User Support Email: Your email.
4. **Developer Contact Information**: Your email.
5. Click **Save and Continue**.
6. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Search for `fitness.activity.write` (or manually add `https://www.googleapis.com/auth/fitness.activity.write`).
   - Select it and click **Update**.
   - Click **Save and Continue**.
7. **Test Users**:
   - Since the app is in "Testing" mode, you MUST add the email addresses of any users (including yourself) who will try to log in.
   - Click **Add Users**, enter emails, and click **Add**.
   - Click **Save and Continue**.

## Step 4: Create Credentials

1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. **Application Type**: Select **Web application**.
4. **Name**: `EMOM Timer Web Client`.
5. **Authorized JavaScript origins**:
   - Add the URLs where your app will run.
   - Local Development: `http://localhost:3000` (or `http://127.0.0.1:3000`)
   - Production (GitHub Pages): `https://<your-username>.github.io`
   - **IMPORTANT**:
     - **No trailing slash**: `http://localhost:3000/` will fail. Use `http://localhost:3000`.
     - **Protocol required**: Must start with `http://` or `https://`.
6. Click **Create**.
7. **Copy Your Client ID**. (It will look like `123456789-abcdefg...apps.googleusercontent.com`).

> [!TIP]
> If `http://localhost:3000` is still rejected, try using `http://127.0.0.1:3000` instead, and ensure you access your app via that same URL in the browser.

## Step 5: Configure the Application

### Local Development

1. Create a file named `.env` in the root of your project (add this to `.gitignore`).
2. Add your Client ID:

   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id-here
   ```

3. Restart your development server (`pnpm run dev`).

### Production (GitHub Actions)

If you are deploying via GitHub Actions, you need to set this as a secret:

1. Go to your GitHub Repository > **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret**.
3. Name: `VITE_GOOGLE_CLIENT_ID`
4. Value: Paste your Client ID.
5. Ensure your build workflow passes this secret to the build command.

## Verification

1. Open the app.
2. Go to **Settings**.
3. Click **Connect Google Fit**.
4. A Google popup should appear asking for permission.
5. Once granted, the button should change to "Connected" and workouts will sync automatically on completion.
