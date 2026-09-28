/**
 * Column search keys for the register's free-text column filters. Category/
 * Department/Status/Priority/Frequency moved to server-side dropdown filters
 * in the frontend-completion pass (see `ComplianceLibraryFiltersBar`) - this
 * type now only covers the columns still searched client-side against the
 * current page (Name/Description), matching what the backend's `search`
 * param already covers server-side for the rest.
 */
export type SearchKey = 'name' | 'description'
