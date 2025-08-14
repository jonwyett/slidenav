// SlideNav 2.0 Page Kit - SDK for pages
// Manages page lifecycle, state tracking, and communication with Shell

class PageKit {
    constructor() {
        this.isInitialized = false;
        this.options = {};
        this.callbacks = {};
    }
    
    init(options = {}) {
        this.options = options;
        this.callbacks = {
            onStartup: options.onStartup || (() => {}),
            onRestore: options.onRestore || (() => {})
        };
        this.isInitialized = true;
    }
    
    signalReady() {
        if (!this.isInitialized) {
            throw new Error('PageKit must be initialized before signaling ready');
        }
        
        window.parent.postMessage({
            type: 'page:ready',
            payload: {
                pageTitle: document.title || 'Untitled Page'
            }
        }, '*');
    }
}

// Global page kit instance
window.SlideNavKit = new PageKit();