function ComponentObjectError(object,key) {
	Error.apply(this);
	Error.captureStackTrace(this,ComponentObjectError);
	this.name = 'ComponentObjectError';
	this.message = 'Object of type ' + object.constructor.name + ' has no member ' + key + '.';
}
ComponentObjectError.prototype = Object.create(Error.prototype);
ComponentObjectError.prototype.constructor = ComponentObjectError;

export default ComponentObjectError;