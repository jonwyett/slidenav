// SlideNav 2.0 Logger - Shared utility for emitter-based logging
// Provides error, warning, and debug logging for all framework components

class Logger {
    constructor() {
        this.listeners = new Map();
    }
    
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }
    
    emit(eventType, data) {
        if (this.listeners.has(eventType)) {
            this.listeners.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Logger callback error:', error);
                }
            });
        }
    }
    
    error(message, data = null) {
        this.emit('error', { message, data, timestamp: new Date().toISOString() });
    }
    
    warn(message, data = null) {
        this.emit('warn', { message, data, timestamp: new Date().toISOString() });
    }
    
    debug(message, data = null) {
        this.emit('debug', { message, data, timestamp: new Date().toISOString() });
    }
}

// Global logger instance
window.SlideNavLogger = new Logger();