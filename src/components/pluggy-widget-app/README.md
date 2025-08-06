# Pluggy Widget React App

This is a standalone React application for the Pluggy Connect widget integration.

## Quick Start

1. Install dependencies:
```bash
cd src/components/pluggy-widget-app
npm install
```

2. Set environment variables:
```bash
# Create .env file
REACT_APP_API_URL=https://whatsapp-integration-production-06bb.up.railway.app
```

3. Run the development server:
```bash
npm start
```

4. Build for production:
```bash
npm run build
```

## Deployment Options

### Option 1: Embed as iframe
After building, host the build folder and embed in your main app:
```html
<iframe src="https://your-widget-app.com" width="100%" height="600"></iframe>
```

### Option 2: Deploy to Vercel
```bash
npm i -g vercel
vercel
```

### Option 3: Integrate into existing React app
Copy the components into your existing React application.

## Usage

The widget automatically:
1. Creates connect tokens via your backend API
2. Displays the Pluggy Connect widget
3. Handles success/error callbacks
4. Syncs data with your backend

## Customization

Edit `src/App.js` to customize:
- Theme colors
- Language
- Products to request
- Callback behaviors