const DefaultConfig = {
	type: 'object',
	properties: {
		fileLogLevel: {
			type: 'string',
			default: 'info',
			env: 'LISK_FILE_LOG_LEVEL',
			arg: '-l,--log',
		},
		logFileName: {
			type: 'string',
			default: 'logs/lisk.log',
			env: 'LISK_REDIS_HOST',
		},
		consoleLogLevel: {
			type: 'string',
			default: 'none',
			env: 'LISK_CONSOLE_LOG_LEVEL',
		},
	},
	required: ['fileLogLevel', 'logFileName', 'consoleLogLevel'],
};

module.exports = DefaultConfig;
