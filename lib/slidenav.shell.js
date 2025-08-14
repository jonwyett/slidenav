// SlideNav 2.0 Shell - Main framework shell
// Manages browser window, iframe creation/destruction, page transitions, and browser history

class Shell {
    constructor(initialPageUrl = null, options = {}) {
        this.pageList = [];
        this.currentPageIndex = -1;
        this.debugMode = options.debug || false;
        this.inspector = null;
        
        // Set up postMessage listener
        this.setupMessageListener();
        
        // Set up history API listener
        this.setupHistoryListener();
        
        if (this.debugMode) {
            this.createInspector();
        }
        
        if (initialPageUrl) {
            this.addPage(initialPageUrl);
        }
    }
    
    addPage(url, options = {}) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        
        // Create container for iframe with animation
        const container = document.createElement('div');
        container.className = 'slidenav-page-container';
        container.appendChild(iframe);
        
        // Set up iframe load handler to send startup message
        iframe.onload = () => {
            this.sendStartupMessage(iframe, options);
        };
        
        document.body.appendChild(container);
        
        const pageData = {
            url: url,
            iframe: iframe,
            container: container,
            isDirty: false,
            options: options,
            isReady: false
        };
        
        this.pageList.push(pageData);
        this.currentPageIndex = this.pageList.length - 1;
        
        // Update browser history
        this.updateHistory(url, pageData);
        
        // Update inspector page stack
        this.updateInspectorPageStack();
        
        window.SlideNavLogger.debug('Page added to shell', { url, options });
    }
    
    sendStartupMessage(iframe, options) {
        const startupData = {
            type: 'shell:startup',
            payload: {
                ...options,
                shellVersion: '2.0',
                timestamp: new Date().toISOString()
            }
        };
        
        // Send startup message to iframe
        iframe.contentWindow.postMessage(startupData, '*');
        
        window.SlideNavLogger.debug('Startup message sent to page', startupData.payload);
        
        // Log to inspector
        if (this.inspector) {
            this.logToInspector('shell:startup', startupData.payload);
        }
    }
    
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Log all messages for debugging
            window.SlideNavLogger.debug('Message received', { 
                type: event.data.type, 
                payload: event.data.payload,
                origin: event.origin
            });
            
            // Log all messages to inspector in real-time
            if (this.inspector && event.data.type) {
                this.logToInspector(event.data.type, event.data.payload || {});
            }
            
            // Handle different message types
            switch (event.data.type) {
                case 'page:ready':
                    this.handlePageReady(event);
                    break;
                case 'page:requestBack':
                    this.handleRequestBack(event);
                    break;
                case 'page:setState':
                    this.handleSetState(event);
                    break;
                case 'page:addPage':
                    this.handleAddPageRequest(event);
                    break;
                default:
                    window.SlideNavLogger.warn('Unknown message type received', { type: event.data.type });
            }
        });
    }
    
    handlePageReady(event) {
        const pageData = event.data.payload;
        
        // Find the iframe that sent this message
        const currentPage = this.pageList[this.currentPageIndex];
        if (currentPage && !currentPage.isReady) {
            currentPage.isReady = true;
            
            window.SlideNavLogger.debug('Page ready signal received', { 
                pageTitle: pageData.pageTitle,
                currentIndex: this.currentPageIndex
            });
            
            // Trigger slide-in animation
            this.animatePageIn(currentPage);
            
            // Inspector logging is now handled in setupMessageListener
        }
    }
    
    animatePageIn(pageData) {
        const container = pageData.container;
        
        // Add the ready class to trigger CSS animation
        container.classList.add('ready');
        
        // Listen for animation completion
        container.addEventListener('transitionend', () => {
            window.SlideNavLogger.debug('Page animation completed', { url: pageData.url });
        }, { once: true });
        
        window.SlideNavLogger.debug('Page animation started', { url: pageData.url });
    }
    
    updateHistory(url, pageData) {
        const state = {
            pageIndex: this.currentPageIndex,
            url: url,
            timestamp: new Date().toISOString()
        };
        
        // Push new state to browser history
        history.pushState(state, '', `#${url}`);
        
        window.SlideNavLogger.debug('History updated', state);
    }
    
    setupHistoryListener() {
        window.addEventListener('popstate', (event) => {
            window.SlideNavLogger.debug('Popstate event received', { 
                state: event.state,
                currentIndex: this.currentPageIndex
            });
            
            if (event.state && event.state.pageIndex !== undefined) {
                this.navigateToPage(event.state.pageIndex);
            } else {
                // Handle initial page load or manual URL changes
                window.SlideNavLogger.warn('Popstate without valid state', { state: event.state });
            }
        });
    }
    
    navigateToPage(targetIndex) {
        if (targetIndex < 0 || targetIndex >= this.pageList.length) {
            window.SlideNavLogger.error('Invalid page index for navigation', { 
                targetIndex, 
                maxIndex: this.pageList.length - 1 
            });
            return;
        }
        
        // Hide current page
        if (this.currentPageIndex >= 0) {
            const currentPage = this.pageList[this.currentPageIndex];
            if (currentPage && currentPage.container) {
                currentPage.container.style.display = 'none';
            }
        }
        
        // Show target page
        const targetPage = this.pageList[targetIndex];
        if (targetPage && targetPage.container) {
            targetPage.container.style.display = 'block';
            this.currentPageIndex = targetIndex;
            
            // Update inspector page stack
            this.updateInspectorPageStack();
            
            window.SlideNavLogger.debug('Navigated to page', { 
                targetIndex, 
                url: targetPage.url 
            });
        }
    }
    
    handleRequestBack(event) {
        const options = event.data.payload || {};
        
        window.SlideNavLogger.debug('Back request received from page', options);
        
        // Check if current page is dirty
        const currentPage = this.pageList[this.currentPageIndex];
        if (currentPage && currentPage.isDirty) {
            // Send commit and back request instead of immediate navigation
            this.handleCommitAndBack(currentPage, options);
        } else {
            this.back(options);
        }
    }
    
    handleSetState(event) {
        const { state } = event.data.payload;
        const currentPage = this.pageList[this.currentPageIndex];
        
        if (currentPage) {
            const previousState = currentPage.isDirty;
            currentPage.isDirty = (state === 'dirty');
            
            window.SlideNavLogger.debug('Page state updated', { 
                pageIndex: this.currentPageIndex,
                url: currentPage.url,
                previousState: previousState ? 'dirty' : 'clean',
                newState: state
            });
            
            // Update inspector if it exists
            this.updateInspectorPageStack();
        }
    }
    
    handleCommitAndBack(currentPage, options) {
        // Send commit request to current page
        const commitData = {
            type: 'shell:commitAndBack',
            payload: {
                ...options,
                timestamp: new Date().toISOString()
            }
        };
        
        currentPage.iframe.contentWindow.postMessage(commitData, '*');
        
        window.SlideNavLogger.debug('Commit and back request sent to dirty page', commitData.payload);
        
        // Log to inspector
        if (this.inspector) {
            this.logToInspector('shell:commitAndBack', commitData.payload);
        }
    }
    
    handleAddPageRequest(event) {
        const { url, options } = event.data.payload;
        
        window.SlideNavLogger.debug('Add page request received', { url, options });
        
        if (url) {
            this.addPage(url, options || {});
        } else {
            window.SlideNavLogger.error('Add page request missing URL', event.data.payload);
        }
    }
    
    back(options = {}) {
        if (this.currentPageIndex <= 0) {
            window.SlideNavLogger.warn('Cannot go back - already at first page');
            return;
        }
        
        const targetIndex = this.currentPageIndex - 1;
        const targetPage = this.pageList[targetIndex];
        
        // Navigate back
        this.navigateToPage(targetIndex);
        
        // Send restore message to the target page
        this.sendRestoreMessage(targetPage.iframe, options);
        
        // Update browser history
        history.back();
        
        window.SlideNavLogger.debug('Back navigation completed', { 
            targetIndex, 
            targetUrl: targetPage.url,
            options 
        });
    }
    
    sendRestoreMessage(iframe, options) {
        const restoreData = {
            type: 'shell:restore',
            payload: {
                ...options,
                timestamp: new Date().toISOString()
            }
        };
        
        // Send restore message to iframe
        iframe.contentWindow.postMessage(restoreData, '*');
        
        window.SlideNavLogger.debug('Restore message sent to page', restoreData.payload);
        
        // Log to inspector
        if (this.inspector) {
            this.logToInspector('shell:restore', restoreData.payload);
        }
    }
    
    createInspector() {
        this.inspector = document.createElement('div');
        this.inspector.id = 'slidenav-inspector';
        this.inspector.innerHTML = `
            <div class="inspector-header">
                <span class="inspector-title">SlideNav Inspector</span>
                <button class="inspector-minimize">−</button>
            </div>
            <div class="inspector-content">
                <div class="inspector-panel">
                    <h4>Page Stack</h4>
                    <div class="inspector-stack" id="page-stack"></div>
                </div>
                <div class="inspector-panel">
                    <h4>Message Log</h4>
                    <div class="inspector-log" id="message-log"></div>
                </div>
            </div>
        `;
        
        // Styling
        const style = document.createElement('style');
        style.textContent = `
            .slidenav-page-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0;
                transform: translateX(100%);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            
            .slidenav-page-container.ready {
                opacity: 1;
                transform: translateX(0);
            }
            
            #slidenav-inspector {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 300px;
                max-height: 400px;
                background: #1e1e1e;
                color: #fff;
                border: 1px solid #444;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                z-index: 10000;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
            
            .inspector-header {
                background: #333;
                padding: 8px 12px;
                border-bottom: 1px solid #444;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .inspector-title {
                font-weight: bold;
                color: #fff;
            }
            
            .inspector-minimize {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                width: 20px;
                height: 20px;
            }
            
            .inspector-content {
                padding: 8px;
                max-height: 320px;
                overflow-y: auto;
            }
            
            .inspector-content.minimized {
                display: none;
            }
            
            .inspector-panel h4 {
                margin: 0 0 8px 0;
                color: #4CAF50;
                border-bottom: 1px solid #444;
                padding-bottom: 4px;
            }
            
            .inspector-stack {
                background: #000;
                padding: 8px;
                border-radius: 2px;
                min-height: 80px;
                max-height: 120px;
                overflow-y: auto;
                font-size: 11px;
                margin-bottom: 12px;
            }
            
            .inspector-log {
                background: #000;
                padding: 8px;
                border-radius: 2px;
                min-height: 100px;
                max-height: 150px;
                overflow-y: auto;
                font-size: 11px;
            }
            
            .page-stack-item {
                padding: 4px 6px;
                margin-bottom: 4px;
                background: #2a2a2a;
                border-radius: 3px;
                border-left: 3px solid #2196F3;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .page-stack-item.current {
                border-left-color: #4CAF50;
                background: #1a3a1a;
            }
            
            .page-stack-item.dirty {
                border-left-color: #FF5722;
            }
            
            .page-url {
                color: #e0e0e0;
                font-family: monospace;
                font-size: 10px;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .page-status {
                font-size: 9px;
                padding: 2px 4px;
                border-radius: 2px;
                margin-left: 8px;
            }
            
            .page-status.current {
                background: #4CAF50;
                color: white;
            }
            
            .page-status.dirty {
                background: #FF5722;
                color: white;
            }
            
            .page-status.clean {
                background: #2196F3;
                color: white;
            }
        `;
        document.head.appendChild(style);
        
        // Add dragging functionality
        this.makeDraggable(this.inspector);
        
        // Add minimize functionality
        const minimizeBtn = this.inspector.querySelector('.inspector-minimize');
        const content = this.inspector.querySelector('.inspector-content');
        minimizeBtn.addEventListener('click', () => {
            content.classList.toggle('minimized');
            minimizeBtn.textContent = content.classList.contains('minimized') ? '+' : '−';
        });
        
        document.body.appendChild(this.inspector);
        
        // Initialize page stack display
        this.updateInspectorPageStack();
        
        window.SlideNavLogger.debug('Inspector created and attached to DOM');
    }
    
    logToInspector(messageType, payload) {
        if (!this.inspector) return;
        
        const logPanel = this.inspector.querySelector('#message-log');
        if (logPanel) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.style.marginBottom = '6px';
            logEntry.style.padding = '4px 6px';
            logEntry.style.backgroundColor = '#2a2a2a';
            logEntry.style.borderRadius = '3px';
            logEntry.style.borderLeft = messageType.startsWith('shell:') ? '3px solid #FF9800' : '3px solid #4CAF50';
            
            const isOutgoing = messageType.startsWith('shell:');
            const direction = isOutgoing ? '→' : '←';
            const color = isOutgoing ? '#FF9800' : '#4CAF50';
            
            logEntry.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="color: ${color}; font-weight: bold;">${direction} ${messageType}</span>
                    <span style="color: #888; font-size: 10px;">${timestamp}</span>
                </div>
                <div style="margin-left: 16px; font-size: 10px; color: #ccc; font-family: monospace;">
                    ${JSON.stringify(payload, null, 2)}
                </div>
            `;
            
            logPanel.appendChild(logEntry);
            logPanel.scrollTop = logPanel.scrollHeight;
            
            // Limit log entries to prevent memory issues
            const entries = logPanel.children;
            if (entries.length > 50) {
                logPanel.removeChild(entries[0]);
            }
        }
    }
    
    updateInspectorPageStack() {
        if (!this.inspector) return;
        
        const stackPanel = this.inspector.querySelector('#page-stack');
        if (!stackPanel) return;
        
        // Clear existing content
        stackPanel.innerHTML = '';
        
        if (this.pageList.length === 0) {
            stackPanel.innerHTML = '<div style="color: #888; font-style: italic;">No pages loaded</div>';
            return;
        }
        
        // Create stack items
        this.pageList.forEach((page, index) => {
            const item = document.createElement('div');
            item.className = 'page-stack-item';
            
            // Add current page styling
            if (index === this.currentPageIndex) {
                item.classList.add('current');
            }
            
            // Add dirty page styling
            if (page.isDirty) {
                item.classList.add('dirty');
            }
            
            const url = page.url.length > 25 ? '...' + page.url.slice(-25) : page.url;
            
            // Determine status
            let statusText = 'clean';
            let statusClass = 'clean';
            
            if (index === this.currentPageIndex) {
                statusText = 'current';
                statusClass = 'current';
            } else if (page.isDirty) {
                statusText = 'dirty';
                statusClass = 'dirty';
            }
            
            item.innerHTML = `
                <span class="page-url">${url}</span>
                <span class="page-status ${statusClass}">${statusText}</span>
            `;
            
            stackPanel.appendChild(item);
        });
        
        // Scroll to show current page
        const currentItem = stackPanel.querySelector('.page-stack-item.current');
        if (currentItem) {
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        const header = element.querySelector('.inspector-header');
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(window.getComputedStyle(element).left, 10);
            startTop = parseInt(window.getComputedStyle(element).top, 10);
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            e.preventDefault();
        });
        
        function handleMouseMove(e) {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            element.style.left = (startLeft + dx) + 'px';
            element.style.top = (startTop + dy) + 'px';
        }
        
        function handleMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    }
}

// Global shell instance
window.SlideNav = { Shell };