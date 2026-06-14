export function stripSuffix(str: string, suffix: string) {
	return str.substring(0, str.length - suffix.length);
}

export function stripPrefix(str: string, prefix: string) {
	return str.substring(prefix.length, str.length);
}

export function stripAffixes(str: string, prefix: string, suffix: string) {
	return stripSuffix(stripPrefix(str, prefix), suffix);
}
