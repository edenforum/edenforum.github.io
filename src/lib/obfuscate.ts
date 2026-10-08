// obfuscation for "secret" content

const KEY = 'edenforum-s3cret';

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) {
		binary += String.fromCharCode(b);
	}
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// plain text -> encoded
export function enc(plain: string): string {
	const bytes = new TextEncoder().encode(plain);
	const out = new Uint8Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) {
		out[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length);
	}
	return toBase64(out);
}

// encoded -> plain text
export function dec(payload: string): string {
	try {
		const bytes = fromBase64(payload);
		const out = new Uint8Array(bytes.length);
		for (let i = 0; i < bytes.length; i++) {
			out[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length);
		}
		return new TextDecoder().decode(out);
	} catch {
		return '';
	}
}
