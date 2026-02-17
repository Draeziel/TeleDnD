type LogMeta = Record<string, unknown>;

function write(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, meta?: LogMeta) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...(meta || {}),
    };

    const line = JSON.stringify(payload);

    if (level === 'ERROR') {
        console.error(line);
        return;
    }

    if (level === 'WARN') {
        console.warn(line);
        return;
    }

    console.log(line);
}

const logger = {
    info: (message: string, meta?: LogMeta) => {
        write('INFO', message, meta);
    },
    error: (message: string, meta?: LogMeta) => {
        write('ERROR', message, meta);
    },
    warn: (message: string, meta?: LogMeta) => {
        write('WARN', message, meta);
    },
    debug: (message: string, meta?: LogMeta) => {
        if (process.env.NODE_ENV === 'development') {
            write('DEBUG', message, meta);
        }
    },
};

export default logger;