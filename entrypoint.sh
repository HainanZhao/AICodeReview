#!/bin/bash

# Start the backend server
npm --prefix ./backend run start &

# Start the frontend development server
npm run dev