import logger from '../../logger.js';

/**
 * Logs DNAC API responses (success or error) at a global level.
 * @param {string} context - Where this log is being called from (e.g. controller name, function name)
 * @param {object} response - The full response object from DNAC (success or error)
 */
export function logDnacResponse(context, response) {
  logger.info(`[${context}] DNAC Response: ${JSON.stringify(response)}`);
}

export function logDnacError(context, error) {
  // Log the error object fully, including stack if available
  logger.error(`[${context}] DNAC Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
}
