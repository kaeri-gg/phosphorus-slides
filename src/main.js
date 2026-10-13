import './styles/main.css';
import { PresentationApp } from './core/PresentationApp.js';

document.addEventListener('DOMContentLoaded', () => {
    const app = new PresentationApp();
    window.presentationApp = app;
    const urlParams = new URLSearchParams(window.location.search);
    const defaultFile = `${import.meta.env.BASE_URL}pitch.md`;
    const file = urlParams.get('file') || urlParams.get('p') || defaultFile;
    app.loadAsync(file);
});
