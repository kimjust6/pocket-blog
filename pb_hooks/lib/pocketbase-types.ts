/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	AdminSettings: "admin_settings",
	BlogPosts: "blog_posts",
	ClimbingPosts: "climbing_posts",
	Huggies: "huggies",
	Users: "users",
	ZendeskOrganizations: "zendesk_organizations",
	ZendeskTickets: "zendesk_tickets",
	ZendeskuserDiscorduser: "zendeskuser_discorduser",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type AdminSettingsRecord = {
	category?: string
	created: IsoAutoDateString
	id: string
	key: string
	updated: IsoAutoDateString
	value?: string
}

export type BlogPostsRecord = {
	content1?: HTMLString
	content2?: HTMLString
	coverImage?: FileNameString
	coverImageAlt?: string
	created: IsoAutoDateString
	id: string
	isDeleted?: boolean
	manualPublishDate?: IsoDateString
	tags?: string
	title?: string
	updated: IsoAutoDateString
	user?: RecordIdString
}

export const ClimbingPostsClimbTypeOptions = {
	"Bouldering": "Bouldering",
	"Sport": "Sport",
	"Top Rope": "Top Rope",
	"Trad": "Trad",
} as const
export type ClimbingPostsClimbTypeOptions = typeof ClimbingPostsClimbTypeOptions[keyof typeof ClimbingPostsClimbTypeOptions]

export const ClimbingPostsStyleOptions = {
	"Send": "Send",
	"Flash": "Flash",
	"Onsight": "Onsight",
	"Project": "Project",
	"Hangdog": "Hangdog",
} as const
export type ClimbingPostsStyleOptions = typeof ClimbingPostsStyleOptions[keyof typeof ClimbingPostsStyleOptions]
export type ClimbingPostsRecord = {
	climbType?: ClimbingPostsClimbTypeOptions
	content?: HTMLString
	coverImage?: FileNameString
	created: IsoAutoDateString
	date: IsoDateString
	grade?: string
	id: string
	isDeleted?: boolean
	location?: string
	style?: ClimbingPostsStyleOptions
	title: string
	updated: IsoAutoDateString
}

export type HuggiesRecord = {
	created: IsoAutoDateString
	description?: string
	hugOwer?: RecordIdString
	hugReceiver?: RecordIdString
	id: string
	numberOfHugs?: number
	updated: IsoAutoDateString
}

export type UsersRecord = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type ZendeskOrganizationsRecord = {
	created: IsoAutoDateString
	id: string
	organizationId?: string
	organizationName?: string
	shortHand?: string
	updated: IsoAutoDateString
}

export type ZendeskTicketsRecord<Tdata = unknown> = {
	created: IsoAutoDateString
	data?: null | Tdata
	id: string
	ticketId?: number
	ticketType?: string
	updated: IsoAutoDateString
	zendeskActorId?: number
	zendeskUserId?: number
}

export type ZendeskuserDiscorduserRecord = {
	created: IsoAutoDateString
	description?: string
	discord_id?: string
	id: string
	name?: string
	notification_options?: string
	updated: IsoAutoDateString
	zendesk_id?: string
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type AdminSettingsResponse<Texpand = unknown> = Required<AdminSettingsRecord> & BaseSystemFields<Texpand>
export type BlogPostsResponse<Texpand = unknown> = Required<BlogPostsRecord> & BaseSystemFields<Texpand>
export type ClimbingPostsResponse<Texpand = unknown> = Required<ClimbingPostsRecord> & BaseSystemFields<Texpand>
export type HuggiesResponse<Texpand = unknown> = Required<HuggiesRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type ZendeskOrganizationsResponse<Texpand = unknown> = Required<ZendeskOrganizationsRecord> & BaseSystemFields<Texpand>
export type ZendeskTicketsResponse<Tdata = unknown, Texpand = unknown> = Required<ZendeskTicketsRecord<Tdata>> & BaseSystemFields<Texpand>
export type ZendeskuserDiscorduserResponse<Texpand = unknown> = Required<ZendeskuserDiscorduserRecord> & BaseSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	admin_settings: AdminSettingsRecord
	blog_posts: BlogPostsRecord
	climbing_posts: ClimbingPostsRecord
	huggies: HuggiesRecord
	users: UsersRecord
	zendesk_organizations: ZendeskOrganizationsRecord
	zendesk_tickets: ZendeskTicketsRecord
	zendeskuser_discorduser: ZendeskuserDiscorduserRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	admin_settings: AdminSettingsResponse
	blog_posts: BlogPostsResponse
	climbing_posts: ClimbingPostsResponse
	huggies: HuggiesResponse
	users: UsersResponse
	zendesk_organizations: ZendeskOrganizationsResponse
	zendesk_tickets: ZendeskTicketsResponse
	zendeskuser_discorduser: ZendeskuserDiscorduserResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
