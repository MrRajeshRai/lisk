const Application = require('./controller/application');
const constants = require('./controller/defaults/constants');
const version = require('./version');
const validator = require('./controller/helpers/validator');

/**
 * @namespace framework
 * @type {{constants, Application: (module.Application|*), version: string}}
 */
module.exports = {
	Application,
	constants,
	version,
	helpers: {
		validator,
	},
};
