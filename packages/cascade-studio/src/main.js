// CascadeStudio ES Module Entry Point
import { CascadeStudioApp } from './CascadeMain.js';

// Start the application when the DOM is ready
const app = new CascadeStudioApp();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.start());
} else {
    app.start();
}
