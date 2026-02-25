export class Permissions {
	constructor(permissions, subject) {
		if (typeof permissions === 'string') {
			permissions = permissions.split(',');
		}
		this.permissions = permissions.slice();
		this.subject = subject;
	}

	static from(permissions, subject) {
		return new Permissions(permissions, subject);
	}

	for(subject) {
		return new Permissions(this.permissions, subject);
	}

	get isAdmin() {
		return this.permissions.includes(`${this.subject}:admin`);
	}

	allowHttpMethod(httpMethod) {
		if (this.isAdmin) return true;
		let checkPermission = `${this.subject}:`;
		switch (httpMethod) {
			case 'GET':
				checkPermission += 'read';
				break;
			case 'POST':
			case 'PUT':
				checkPermission += 'write';
				break;
			case 'DELETE':
				checkPermission += 'delete';
				break;
			default:
				throw new Error(`Unknown method: ${httpMethod}`);
		}
		return this.permissions.includes(checkPermission);
	}
}
