/**
 * Custom Lisk Framework Validator implemented on top of Ajv (https://github.com/epoberezkin/ajv)
 */

const Ajv = require('ajv');
const { SchemaValidationError } = require('../../../errors');
const formats = require('./formats');
const { env: envKeyword, arg: argKeyword } = require('./keywords');

const validator = new Ajv({
	allErrors: true,
	schemaId: 'auto',
	useDefaults: false,
	$data: true,
});

const validatorWithDefaults = new Ajv({
	allErrors: true,
	schemaId: 'auto',
	useDefaults: true,
	$data: true,
});

validatorWithDefaults.addKeyword('env', envKeyword);
validatorWithDefaults.addKeyword('arg', argKeyword);

Object.keys(formats).forEach(formatId => {
	validator.addFormat(formatId, formats[formatId]);
});

Object.keys(formats).forEach(formatId => {
	validatorWithDefaults.addFormat(formatId, formats[formatId]);
});

/**
 * Function helps with loading and validating schemas.
 *
 * @type {{loadSchema: module.exports.loadSchema, validate: (function(*=, *=): boolean)}}
 */
module.exports = {
	/**
	 * Load schema objects to cache and able to resolve the $ref
	 *
	 * @param {Object} schema - All schema objects that you want to cache before validating actual data
	 */
	loadSchema: schema => {
		Object.keys(schema).forEach(key => {
			validator.addSchema(schema[key], schema[key].id);
		});

		Object.keys(schema).forEach(key => {
			validatorWithDefaults.addSchema(schema[key], schema[key].id);
		});
	},

	/**
	 * Validate data against provided schema.
	 *
	 * @param {Object} schema - JSON Schema object
	 * @param {Object} data - Data object you want to validate
	 * @return {boolean}
	 * @throws Framework.errors.SchemaValidationError
	 */
	validate: (schema, data) => {
		if (!validator.validate(schema, data)) {
			throw new SchemaValidationError(validator.errors);
		}

		return true;
	},

	/**
	 * Validate data against provided schema as well populate the default values
	 *
	 * @param {Object} schema - JSON Schema object
	 * @param {Object} data - Data object you want to validate
	 * @return {Object} - Modified data with default values
	 * @throws Framework.errors.SchemaValidationError
	 */
	validateWithDefaults: (schema, data) => {
		const dataCopy = Object.assign({}, data);

		if (!validatorWithDefaults.validate(schema, dataCopy)) {
			throw new SchemaValidationError(validatorWithDefaults.errors);
		}

		return dataCopy;
	},

	formats: Object.freeze(formats),
};
