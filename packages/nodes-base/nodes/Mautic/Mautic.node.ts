import {
	IExecuteFunctions,
} from 'n8n-core';

import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

import {
	mauticApiRequest,
	mauticApiRequestAllItems,
	validateJSON,
} from './GenericFunctions';

import {
	contactFields,
	contactOperations,
} from './ContactDescription';

import {
	companyFields,
	companyOperations,
} from './CompanyDescription';

import {
	contactCompanyFields,
	contactCompanyOperations,
} from './ContactCompanyDescription';

import {
	snakeCase,
} from 'change-case';

export class Mautic implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mautic',
		name: 'mautic',
		icon: 'file:mautic.png',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Mautic API',
		defaults: {
			name: 'Mautic',
			color: '#52619b',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'mauticApi',
				required: true,
				displayOptions: {
					show: {
						authentication: [
							'credentials',
						],
					},
				},
			},
			{
				name: 'mauticOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: [
							'oAuth2',
						],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Credentials',
						value: 'credentials',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
				],
				default: 'credentials',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Company',
						value: 'company',
						description: 'Create or modify a company',
					},
					{
						name: 'Contact',
						value: 'contact',
						description: 'Create & modify contacts',
					},
					{
						name: 'Contact <> Company',
						value: 'contactCompany',
						description: 'Add/ remove contacts from a company',
					},
				],
				default: 'contact',
				description: 'Resource to consume.',
			},
			...companyOperations,
			...companyFields,
			...contactOperations,
			...contactFields,
			...contactCompanyOperations,
			...contactCompanyFields,
		],
	};

	methods = {
		loadOptions: {
			// Get all the available companies to display them to user so that he can
			// select them easily
			async getCompanies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const companies = await mauticApiRequestAllItems.call(this, 'companies', 'GET', '/companies');
				for (const company of companies) {
					returnData.push({
						name: company.fields.all.companyname,
						value: company.fields.all.companyname,
					});
				}
				return returnData;
			},
			// Get all the available tags to display them to user so that he can
			// select them easily
			async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const tags = await mauticApiRequestAllItems.call(this, 'tags', 'GET', '/tags');
				for (const tag of tags) {
					returnData.push({
						name: tag.tag,
						value: tag.tag,
					});
				}
				return returnData;
			},
			// Get all the available stages to display them to user so that he can
			// select them easily
			async getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const stages = await mauticApiRequestAllItems.call(this, 'stages', 'GET', '/stages');
				for (const stage of stages) {
					returnData.push({
						name: stage.name,
						value: stage.id,
					});
				}
				return returnData;
			},
			// Get all the available company fields to display them to user so that he can
			// select them easily
			async getCompanyFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const fields = await mauticApiRequestAllItems.call(this, 'fields', 'GET', '/fields/company');
				for (const field of fields) {
					returnData.push({
						name: field.label,
						value: field.alias,
					});
				}
				return returnData;
			},
			// Get all the available contact fields to display them to user so that he can
			// select them easily
			async getContactFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const fields = await mauticApiRequestAllItems.call(this, 'fields', 'GET', '/fields/contact');
				for (const field of fields) {
					returnData.push({
						name: field.label,
						value: field.alias,
					});
				}
				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = items.length as unknown as number;
		let qs: IDataObject;
		let responseData;

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < length; i++) {
			qs = {};

			if (resource === 'company') {
				//https://developer.mautic.org/#create-company
				if (operation === 'create') {
					const name = this.getNodeParameter('name', i) as string;
					const simple = this.getNodeParameter('simple', i) as boolean;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const body: IDataObject = {
						companyname: name,
					};
					Object.assign(body, additionalFields);
					responseData = await mauticApiRequest.call(this, 'POST', '/companies/new', body);
					responseData = responseData.company;
					if (simple === true) {
						responseData = responseData.fields.all;
					}
				}
				//https://developer.mautic.org/#edit-company
				if (operation === 'update') {
					const companyId = this.getNodeParameter('companyId', i) as string;
					const simple = this.getNodeParameter('simple', i) as boolean;
					const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
					const body: IDataObject = {};
					Object.assign(body, updateFields);
					if (body.name) {
						body.companyname = body.name;
						delete body.name;
					}
					responseData = await mauticApiRequest.call(this, 'PATCH', `/companies/${companyId}/edit`, body);
					responseData = responseData.company;
					if (simple === true) {
						responseData = responseData.fields.all;
					}
				}
				//https://developer.mautic.org/#get-company
				if (operation === 'get') {
					const companyId = this.getNodeParameter('companyId', i) as string;
					const simple = this.getNodeParameter('simple', i) as boolean;
					responseData = await mauticApiRequest.call(this, 'GET', `/companies/${companyId}`);
					responseData = responseData.company;
					if (simple === true) {
						responseData = responseData.fields.all;
					}
				}
				//https://developer.mautic.org/#list-contact-companies
				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const simple = this.getNodeParameter('simple', i) as boolean;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					qs = Object.assign(qs, additionalFields);
					if (returnAll === true) {
						responseData = await mauticApiRequestAllItems.call(this, 'companies', 'GET', '/companies', {}, qs);
					} else {
						qs.limit = this.getNodeParameter('limit', i) as number;
						qs.start = 0;
						responseData = await mauticApiRequest.call(this, 'GET', '/companies', {}, qs);
						if (responseData.errors) {
							throw new NodeApiError(this.getNode(), responseData);
						}
						responseData = responseData.companies;
						responseData = Object.values(responseData);
					}
					if (simple === true) {
						//@ts-ignore
						responseData = responseData.map(item => item.fields.all);
					}
				}
				//https://developer.mautic.org/#delete-company
				if (operation === 'delete') {
					const simple = this.getNodeParameter('simple', i) as boolean;
					const companyId = this.getNodeParameter('companyId', i) as string;
					responseData = await mauticApiRequest.call(this, 'DELETE', `/companies/${companyId}/delete`);
					responseData = responseData.company;
					if (simple === true) {
						responseData = responseData.fields.all;
					}
				}
			}

			if (resource === 'contact') {
				//https://developer.mautic.org/?php#create-contact
				if (operation === 'create') {
					const options = this.getNodeParameter('options', i) as IDataObject;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const jsonActive = this.getNodeParameter('jsonParameters', i) as boolean;
					let body: IDataObject = {};
					if (!jsonActive) {
						body.email = this.getNodeParameter('email', i) as string;
						body.firstname = this.getNodeParameter('firstName', i) as string;
						body.lastname = this.getNodeParameter('lastName', i) as string;
						body.company = this.getNodeParameter('company', i) as string;
						body.position = this.getNodeParameter('position', i) as string;
						body.title = this.getNodeParameter('title', i) as string;
					} else {
						const json = validateJSON(this.getNodeParameter('bodyJson', i) as string);
						if (json !== undefined) {
							body = { ...json };
						} else {
							throw new NodeOperationError(this.getNode(), 'Invalid JSON');
						}
					}
					if (additionalFields.ipAddress) {
						body.ipAddress = additionalFields.ipAddress as string;
					}
					if (additionalFields.lastActive) {
						body.ipAddress = additionalFields.lastActive as string;
					}
					if (additionalFields.ownerId) {
						body.ownerId = additionalFields.ownerId as string;
					}
					if (additionalFields.addressUi) {
						const addressValues = (additionalFields.addressUi as IDataObject).addressValues as IDataObject;
						if (addressValues) {
							body.address1 = addressValues.address1 as string;
							body.address2 = addressValues.address2 as string;
							body.city = addressValues.city as string;
							body.state = addressValues.state as string;
							body.country = addressValues.country as string;
							body.zipcode = addressValues.zipCode as string;
						}
					}
					if (additionalFields.socialMediaUi) {
						const socialMediaValues = (additionalFields.socialMediaUi as IDataObject).socialMediaValues as IDataObject;
						if (socialMediaValues) {
							body.facebook = socialMediaValues.facebook as string;
							body.foursquare = socialMediaValues.foursquare as string;
							body.instagram = socialMediaValues.instagram as string;
							body.linkedin = socialMediaValues.linkedIn as string;
							body.skype = socialMediaValues.skype as string;
							body.twitter = socialMediaValues.twitter as string;
						}
					}
					if (additionalFields.customFieldsUi) {
						const customFields = (additionalFields.customFieldsUi as IDataObject).customFieldValues as IDataObject[];
						if (customFields) {
							const data = customFields.reduce((obj, value) => Object.assign(obj, { [`${value.fieldId}`]: value.fieldValue }), {});
							Object.assign(body, data);
						}
					}
					if (additionalFields.b2bOrb2c) {
						body.b2b_or_b2c = additionalFields.b2bOrb2c as string;
					}
					if (additionalFields.crmId) {
						body.crm_id = additionalFields.crmId as string;
					}
					if (additionalFields.fax) {
						body.fax = additionalFields.fax as string;
					}
					if (additionalFields.hasPurchased) {
						body.haspurchased = additionalFields.hasPurchased as boolean;
					}
					if (additionalFields.mobile) {
						body.mobile = additionalFields.mobile as string;
					}
					if (additionalFields.phone) {
						body.phone = additionalFields.phone as string;
					}
					if (additionalFields.prospectOrCustomer) {
						body.prospect_or_customer = additionalFields.prospectOrCustomer as string;
					}
					if (additionalFields.sandbox) {
						body.sandbox = additionalFields.sandbox as boolean;
					}
					if (additionalFields.stage) {
						body.stage = additionalFields.stage as string;
					}
					if (additionalFields.tags) {
						body.tags = additionalFields.tags as string;
					}
					if (additionalFields.website) {
						body.website = additionalFields.website as string;
					}
					responseData = await mauticApiRequest.call(this, 'POST', '/contacts/new', body);
					responseData = [responseData.contact];
					if (options.rawData === false) {
						responseData = responseData.map(item => item.fields.all);
					}
				}
				//https://developer.mautic.org/?php#edit-contact
				if (operation === 'update') {
					const options = this.getNodeParameter('options', i) as IDataObject;
					const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
					const contactId = this.getNodeParameter('contactId', i) as string;
					let body: IDataObject = {};
					if (updateFields.email) {
						body.email = updateFields.email as string;
					}
					if (updateFields.firstName) {
						body.firstname = updateFields.firstName as string;
					}
					if (updateFields.lastName) {
						body.lastname = updateFields.lastName as string;
					}
					if (updateFields.company) {
						body.company = updateFields.company as string;
					}
					if (updateFields.position) {
						body.position = updateFields.position as string;
					}
					if (updateFields.title) {
						body.title = updateFields.title as string;
					}
					if (updateFields.bodyJson) {
						const json = validateJSON(updateFields.bodyJson as string);
						if (json !== undefined) {
							body = { ...json };
						} else {
							throw new NodeOperationError(this.getNode(), 'Invalid JSON');
						}
					}
					if (updateFields.ipAddress) {
						body.ipAddress = updateFields.ipAddress as string;
					}
					if (updateFields.lastActive) {
						body.ipAddress = updateFields.lastActive as string;
					}
					if (updateFields.ownerId) {
						body.ownerId = updateFields.ownerId as string;
					}
					if (updateFields.addressUi) {
						const addressValues = (updateFields.addressUi as IDataObject).addressValues as IDataObject;
						if (addressValues) {
							body.address1 = addressValues.address1 as string;
							body.address2 = addressValues.address2 as string;
							body.city = addressValues.city as string;
							body.state = addressValues.state as string;
							body.country = addressValues.country as string;
							body.zipcode = addressValues.zipCode as string;
						}
					}
					if (updateFields.socialMediaUi) {
						const socialMediaValues = (updateFields.socialMediaUi as IDataObject).socialMediaValues as IDataObject;
						if (socialMediaValues) {
							body.facebook = socialMediaValues.facebook as string;
							body.foursquare = socialMediaValues.foursquare as string;
							body.instagram = socialMediaValues.instagram as string;
							body.linkedin = socialMediaValues.linkedIn as string;
							body.skype = socialMediaValues.skype as string;
							body.twitter = socialMediaValues.twitter as string;
						}
					}
					if (updateFields.customFieldsUi) {
						const customFields = (updateFields.customFieldsUi as IDataObject).customFieldValues as IDataObject[];
						if (customFields) {
							const data = customFields.reduce((obj, value) => Object.assign(obj, { [`${value.fieldId}`]: value.fieldValue }), {});
							Object.assign(body, data);
						}
					}
					if (updateFields.b2bOrb2c) {
						body.b2b_or_b2c = updateFields.b2bOrb2c as string;
					}
					if (updateFields.crmId) {
						body.crm_id = updateFields.crmId as string;
					}
					if (updateFields.fax) {
						body.fax = updateFields.fax as string;
					}
					if (updateFields.hasPurchased) {
						body.haspurchased = updateFields.hasPurchased as boolean;
					}
					if (updateFields.mobile) {
						body.mobile = updateFields.mobile as string;
					}
					if (updateFields.phone) {
						body.phone = updateFields.phone as string;
					}
					if (updateFields.prospectOrCustomer) {
						body.prospect_or_customer = updateFields.prospectOrCustomer as string;
					}
					if (updateFields.sandbox) {
						body.sandbox = updateFields.sandbox as boolean;
					}
					if (updateFields.stage) {
						body.stage = updateFields.stage as string;
					}
					if (updateFields.tags) {
						body.tags = updateFields.tags as string;
					}
					if (updateFields.website) {
						body.website = updateFields.website as string;
					}
					responseData = await mauticApiRequest.call(this, 'PATCH', `/contacts/${contactId}/edit`, body);
					responseData = [responseData.contact];
					if (options.rawData === false) {
						responseData = responseData.map(item => item.fields.all);
					}
				}
				//https://developer.mautic.org/?php#get-contact
				if (operation === 'get') {
					const options = this.getNodeParameter('options', i) as IDataObject;
					const contactId = this.getNodeParameter('contactId', i) as string;
					responseData = await mauticApiRequest.call(this, 'GET', `/contacts/${contactId}`);
					responseData = [responseData.contact];
					if (options.rawData === false) {
						responseData = responseData.map(item => item.fields.all);
					}
				}
				//https://developer.mautic.org/?php#list-contacts
				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const options = this.getNodeParameter('options', i) as IDataObject;
					qs = Object.assign(qs, options);
					if (qs.orderBy) {
						// For some reason does camelCase get used in the returned data
						// but snake_case here. So convert it automatically to not confuse
						// the users.
						qs.orderBy = snakeCase(qs.orderBy as string);
					}

					if (returnAll === true) {
						responseData = await mauticApiRequestAllItems.call(this, 'contacts', 'GET', '/contacts', {}, qs);
					} else {
						qs.limit = this.getNodeParameter('limit', i) as number;
						qs.start = 0;
						responseData = await mauticApiRequest.call(this, 'GET', '/contacts', {}, qs);
						if (responseData.errors) {
							throw new NodeApiError(this.getNode(), responseData);
						}
						responseData = responseData.contacts;
						responseData = Object.values(responseData);
					}
					if (options.rawData === false) {
						//@ts-ignore
						responseData = responseData.map(item => item.fields.all);
					}
				}
				//https://developer.mautic.org/?php#delete-contact
				if (operation === 'delete') {
					const options = this.getNodeParameter('options', i) as IDataObject;
					const contactId = this.getNodeParameter('contactId', i) as string;
					responseData = await mauticApiRequest.call(this, 'DELETE', `/contacts/${contactId}/delete`);
					responseData = [responseData.contact];
					if (options.rawData === false) {
						responseData = responseData.map(item => item.fields.all);
					}
				}
			}

			if (resource === 'contactCompany') {
				//https://developer.mautic.org/#add-contact-to-a-company
				if (operation === 'add') {
					const contactId = this.getNodeParameter('contactId', i) as string;
					const companyId = this.getNodeParameter('companyId', i) as string;
					responseData = await mauticApiRequest.call(this, 'POST', `/companies/${companyId}/contact/${contactId}/add`, {});
					// responseData = responseData.company;
					// if (simple === true) {
					// 	responseData = responseData.fields.all;
					// }
				}
				//https://developer.mautic.org/#remove-contact-from-a-company
				if (operation === 'remove') {
					const contactId = this.getNodeParameter('contactId', i) as string;
					const companyId = this.getNodeParameter('companyId', i) as string;
					responseData = await mauticApiRequest.call(this, 'POST', `/companies/${companyId}/contact/${contactId}/remove`, {});
					// responseData = responseData.company;
					// if (simple === true) {
					// 	responseData = responseData.fields.all;
					// }
				}
			}

			if (Array.isArray(responseData)) {
				returnData.push.apply(returnData, responseData as IDataObject[]);
			} else {
				returnData.push(responseData as IDataObject);
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
