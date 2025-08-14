// SlideNav 2.0 Page Kit - SDK for pages
// Manages page lifecycle, state tracking, and communication with Shell

class PageKit {
    constructor() {
        this.isInitialized = false;
        this.options = {};
        this.callbacks = {};
        this.stateTracker = null;
        
        // Set up message listener for shell communication
        this.setupMessageListener();
    }
    
    init(options = {}) {
        this.options = options;
        this.callbacks = {
            onStartup: options.onStartup || (() => {}),
            onRestore: options.onRestore || (() => {})
        };
        
        // Initialize state tracker
        this.stateTracker = new StateTracker(this);
        
        this.isInitialized = true;
    }
    
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Only process messages from parent window
            if (event.source !== window.parent) return;
            
            switch (event.data.type) {
                case 'shell:startup':
                    this.handleStartupMessage(event.data.payload);
                    break;
                case 'shell:restore':
                    this.handleRestoreMessage(event.data.payload);
                    break;
                case 'shell:commitAndBack':
                    this.handleCommitAndBackMessage(event.data.payload);
                    break;
                default:
                    console.warn('Unknown message type received in PageKit:', event.data.type);
            }
        });
    }
    
    handleStartupMessage(payload) {
        console.log('PageKit received startup message:', payload);
        
        if (this.isInitialized && this.callbacks.onStartup) {
            try {
                this.callbacks.onStartup(payload);
            } catch (error) {
                console.error('Error in onStartup callback:', error);
            }
        }
    }
    
    handleRestoreMessage(payload) {
        console.log('PageKit received restore message:', payload);
        
        if (this.isInitialized && this.callbacks.onRestore) {
            try {
                this.callbacks.onRestore(payload);
            } catch (error) {
                console.error('Error in onRestore callback:', error);
            }
        }
    }
    
    handleCommitAndBackMessage(payload) {
        console.log('PageKit received commit and back message:', payload);
        
        // Trigger auto-save for all tracked elements
        if (this.stateTracker) {
            this.stateTracker.commitAll().then(() => {
                // After successful commit, proceed with back navigation
                this.requestBack(payload);
            }).catch((error) => {
                console.error('Commit failed, back navigation cancelled:', error);
            });
        } else {
            // No state tracker, just proceed with back navigation
            this.requestBack(payload);
        }
    }
    
    requestBack(options = {}) {
        if (!this.isInitialized) {
            throw new Error('PageKit must be initialized before requesting back navigation');
        }
        
        window.parent.postMessage({
            type: 'page:requestBack',
            payload: options
        }, '*');
        
        console.log('Back navigation requested with options:', options);
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
    
    track(element, dataSource) {
        if (!this.stateTracker) {
            throw new Error('StateTracker not initialized. Call init() first.');
        }
        
        return this.stateTracker.track(element, dataSource);
    }
    
    setState(state) {
        if (!this.isInitialized) {
            throw new Error('PageKit must be initialized before setting state');
        }
        
        window.parent.postMessage({
            type: 'page:setState',
            payload: { state: state }
        }, '*');
        
        console.log('Page state updated:', state);
    }
}

class StateTracker {
    constructor(pageKit) {
        this.pageKit = pageKit;
        this.trackedElements = new Map();
        this.isDirty = false;
    }
    
    track(element, dataSource) {
        if (!element || !dataSource) {
            throw new Error('Both element and dataSource are required for tracking');
        }
        
        // Validate dataSource has required methods
        if (typeof dataSource.updateField !== 'function') {
            throw new Error('dataSource must have an updateField method');
        }
        
        const elementId = this.generateElementId(element);
        
        // Set up blur event listener for auto-save
        element.addEventListener('blur', () => {
            this.handleFieldUpdate(element, dataSource, elementId);
        });
        
        // Set up input event listener for dirty state tracking
        element.addEventListener('input', () => {
            this.markDirty();
        });
        
        this.trackedElements.set(elementId, {
            element: element,
            dataSource: dataSource,
            originalValue: element.value || element.textContent || ''
        });
        
        console.log('Element tracked for state management:', elementId);
        
        return elementId;
    }
    
    generateElementId(element) {
        // Use existing ID or generate one based on element properties
        if (element.id) {
            return element.id;
        }
        
        const tagName = element.tagName.toLowerCase();
        const name = element.name || '';
        const className = element.className || '';
        
        return `${tagName}_${name}_${className}_${Date.now()}`.replace(/\s+/g, '_');
    }
    
    async handleFieldUpdate(element, dataSource, elementId) {
        const currentValue = element.value || element.textContent || '';
        const trackedData = this.trackedElements.get(elementId);
        
        if (trackedData && currentValue !== trackedData.originalValue) {
            try {
                await dataSource.updateField(element, currentValue);
                
                // Update original value after successful save
                trackedData.originalValue = currentValue;
                
                console.log('Field auto-saved:', { elementId, value: currentValue });
                
                // Check if all fields are now clean
                this.checkCleanState();
                
            } catch (error) {
                console.error('Auto-save failed for field:', elementId, error);
            }
        }
    }
    
    markDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            this.pageKit.setState('dirty');
        }
    }
    
    checkCleanState() {
        // Check if all tracked elements match their original values
        let hasChanges = false;
        
        for (const [elementId, trackedData] of this.trackedElements) {
            const currentValue = trackedData.element.value || trackedData.element.textContent || '';
            if (currentValue !== trackedData.originalValue) {
                hasChanges = true;
                break;
            }
        }
        
        if (!hasChanges && this.isDirty) {
            this.isDirty = false;
            this.pageKit.setState('clean');
        }
    }
    
    async commitAll() {
        const promises = [];
        
        for (const [elementId, trackedData] of this.trackedElements) {
            const currentValue = trackedData.element.value || trackedData.element.textContent || '';
            
            if (currentValue !== trackedData.originalValue) {
                promises.push(
                    trackedData.dataSource.updateField(trackedData.element, currentValue)
                        .then(() => {
                            trackedData.originalValue = currentValue;
                            console.log('Field committed:', { elementId, value: currentValue });
                        })
                );
            }
        }
        
        await Promise.all(promises);
        
        // Mark as clean after successful commit
        this.isDirty = false;
        this.pageKit.setState('clean');
        
        console.log('All tracked fields committed successfully');
    }
}

// Global page kit instance
window.SlideNavKit = new PageKit();