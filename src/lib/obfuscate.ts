// Lightweight obfuscation for "secret" content that has to live in the client.
//
// NOT security. This only keeps plaintext out of the rendered DOM and the
// casual view-source / inspect-element glance. The key ships in this file (and
// the bundle), so anyone who reads the source can reverse it. Real secrecy
// needs a server.

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

// plain text -> encoded payload (use at authoring time)
export function enc(plain: string): string {
	const bytes = new TextEncoder().encode(plain);
	const out = new Uint8Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) {
		out[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length);
	}
	return toBase64(out);
}

// encoded payload -> plain text (returns '' if it isn't decodable)
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
