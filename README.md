# Vite Figma Plugin Template

A Figma plugin template built with React, TypeScript, and Vite.

## Included

- Vite + React + TypeScript setup
- Figma Plugin API typings
- ESLint & Prettier configuration

## Available Branches

- `main` - Base template
- `feature/tailwind` - Includes Tailwind CSS for styling

## Getting Started

1. Clone this repository

```bash
git clone https://github.com/yourusername/vite-figma-plugin.git
cd vite-figma-plugin
```

2. Install dependencies

```bash
npm install
```

3. Build the plugin

```bash
npm run build
```

## Project Structure

- `/src` - React components and main UI code
- `/lib` - Figma plugin code (code.ts)
- `/public` - Static assets
- `/dist` - Build output

## Scripts

- `npm run build` - Build the plugin for production
- `npm run lint` - Run ESLint

## Using Tailwind CSS

To use Tailwind CSS in your project:

1. Switch to the tailwind branch:

```bash
git checkout feature/tailwind
```

2. Install dependencies and rebuild the plugin.

## Development

The template is set up with two main parts:

1. The UI code in `/src` - This is where you build your React components
2. The plugin code in `/lib/code.ts` - This contains the Figma plugin API implementation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
