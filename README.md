# Image Viewer

A simple image viewer that scans a directory and displays all images in a flat, filterable grid. Built with React and Express.

---

## Features

- Flat grid view of every image in a directory (recursive scan, newest first)
- Server-side search by file name or path
- Filter images by folder
- Adjustable grid density, dark/light theme, recent directories
- Infinite scroll with paginated loading
- Image details modal (dimensions, file size, type, last modified, copy path)
- Find similar images using perceptual hashing (dHash):
  - open any image to see its closest matches
  - upload an image from the sidebar to find look-alikes

---

## Installation

```bash
git clone https://github.com/ragoon99/image-viewer.git
cd image-viewer
npm install                  # server dependencies
cd client && npm install && cd ..
```

---

## Usage

Start both server and client with one command:

```bash
npm start
```

- App: http://localhost:5173
- API: http://localhost:3001

On Windows, run `start.cmd` or `start.ps1` instead.

To run them separately:

```bash
node server/index.js         # server
npm --prefix client run dev  # client
```

Point the app at any directory with `IMAGE_DIR` (default `./images`):

```bash
IMAGE_DIR=/path/to/pictures npm start
```
