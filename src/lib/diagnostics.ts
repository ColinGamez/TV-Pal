/**
 * テレビパル™ System Diagnostics & Logging
 * Provides lightweight operational logging for the packaged receiver.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
}

class SystemDiagnostics {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 100;

  public log(level: LogLevel, module: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      module,
      message,
      data
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }

    // Also output to console in dev
    if (process.env.NODE_ENV !== 'production') {
      const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : level === 'SYSTEM' ? '\x1b[36m' : '\x1b[32m';
      console.log(`${color}[${level}] [${module}]\x1b[0m ${message}`, data || '');
    }
  }

  public getLogs() {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
  }

  public getSystemReport() {
    return {
      version: '2.1.0-rev.05',
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      memory: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1048576) + 'MB',
        total: Math.round((performance as any).memory.totalJSHeapSize / 1048576) + 'MB'
      } : 'N/A',
      uptime: Math.round(performance.now() / 1000) + 's',
      errors: this.logs.filter(l => l.level === 'ERROR').length
    };
  }
}

export const diagnostics = new SystemDiagnostics();
