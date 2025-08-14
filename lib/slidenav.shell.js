// SlideNav 2.0 Shell - Main framework shell
// Manages browser window, iframe creation/destruction, page transitions, and browser history

class Shell {
    constructor(initialPageUrl = null, options = {}) {
        this.pageList = [];
        this.currentPageIndex = -1;
        this.debugMode = options.debug || false;
        this.inspector = null;
        
        if (this.debugMode) {
            this.createInspector();
        }
        
        if (initialPageUrl) {
            this.addPage(initialPageUrl);
        }
    }
    
    addPage(url) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        
        document.body.appendChild(iframe);
        
        this.pageList.push({
            url: url,
            iframe: iframe,
            isDirty: false
        });
        
        this.currentPageIndex = this.pageList.length - 1;
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
                    <h4>Debug Console</h4>
                    <div class="inspector-log"></div>
                </div>
            </div>
        `;
        
        // Styling
        const style = document.createElement('style');
        style.textContent = `
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
            
            .inspector-log {
                background: #000;
                padding: 8px;
                border-radius: 2px;
                min-height: 100px;
                max-height: 200px;
                overflow-y: auto;
                font-size: 11px;
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
        
        window.SlideNavLogger.debug('Inspector created and attached to DOM');
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