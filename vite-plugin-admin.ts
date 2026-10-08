import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dec, enc } from './src/lib/obfuscate';

// dev-only authoring tools.
// scaffolds real +page.svelte files under /__admin while running `npm run dev`.
// never ships in prod. delete with src/routes/admin before the final build.

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

interface Message {
	username: string;
	icon?: string;
	href?: string;
	text: string;
	hidden?: boolean;
}

interface PostBody {
	slug: string;
	title: string;
	author: string;
	date: string;
	comments: string;
	music?: string;
	hidden?: boolean;
	messages: Message[];
}

interface UserBody {
	slug: string;
	username: string;
	iconURL: string;
	joinDate: string;
	bio: string;
}

// escape for double-quoted attr
function escAttr(s: string): string {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;');
}

// escape element text
function escText(s: string): string {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// escape single-quoted js string
function escJs(s: string): string {
	return String(s ?? '')
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/\r?\n/g, ' ');
}

function renderPost(b: PostBody): string {
	const hasMusic = !!b.music;
	const musicImport = hasMusic
		? `\n\timport { playerTrack } from '$lib/stores';\n`
		: '';
	const musicLine = hasMusic
		? `\n\tplayerTrack.set('${escJs(b.music!)}');`
		: '';

	const messages = (b.messages ?? [])
		.filter((m) => m && (m.username || m.text))
		.map((m) => {
			const attrs = [`username="${escAttr(m.username)}"`];
			if (m.icon) {
				attrs.push(`userIcon="${escAttr(m.icon)}"`);
			}
			if (m.href) {
				attrs.push(`userHref="${escAttr(m.href)}"`);
			}
			if (m.hidden) {
				// keep the hidden text out of the DOM until it's revealed
				attrs.push('hidden');
				attrs.push(`secret="${escAttr(enc(m.text))}"`);
				return `<Post ${attrs.join(' ')} />`;
			}
			return `<Post ${attrs.join(' ')}>${escText(m.text)}</Post>`;
		})
		.join('\n');

	// hidden post titles are stored obfuscated (see src/lib/obfuscate)
	const title = b.hidden ? enc(b.title) : b.title;

	return `<script module lang="ts">
	import { viewPost, type Post as PostMeta } from '$lib/postMeta';
	import Post from '$lib/post.svelte';

	export const meta = {
		title: '${escJs(title)}',
		author: '${escJs(b.author)}',
		date: '${escJs(b.date)}',
		comments: '${escJs(b.comments)}',
		hidden: ${b.hidden ? 'true' : 'false'},
	} satisfies PostMeta;
</script>

<script lang="ts">${musicImport}
	viewPost(meta);${musicLine}
</script>

${messages}
`;
}

function renderUser(b: UserBody): string {
	return `<script lang="ts">
	import Profile from '$lib/profile.svelte';
	import Section from '$lib/section.svelte';
</script>

<Profile
	username="${escAttr(b.username)}"
	iconURL="${escAttr(b.iconURL || '/icons/pfp.png')}"
	joinDate="${escAttr(b.joinDate)}"
>
	<p>${escText(b.bio)}</p>
</Profile>

<Section>
	<p>this user has no pinned posts</p>
</Section>
`;
}

async function exists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

// list slugs + labels under a routes dir
async function listDir(
	dir: string,
	labelOf: (src: string) => string
): Promise<{ slug: string; label: string }[]> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const out: { slug: string; label: string }[] = [];
		for (const e of entries) {
			if (!e.isDirectory()) {
				continue;
			}
			const file = path.join(dir, e.name, '+page.svelte');
			if (!(await exists(file))) {
				continue;
			}
			let label = e.name;
			try {
				label = labelOf(await fs.readFile(file, 'utf8')) || e.name;
			} catch {
				/* keep slug */
			}
			out.push({ slug: e.name, label });
		}
		out.sort((a, b) => a.slug.localeCompare(b.slug));
		return out;
	} catch {
		return [];
	}
}

export function adminPlugin(): Plugin {
	return {
		name: 'edenforum-admin',
		apply: 'serve',
		configureServer(server) {
			const root = server.config.root;
			const postsDir = path.join(root, 'src/routes/post');
			const usersDir = path.join(root, 'src/routes/user');

			async function readBody(
				req: IncomingMessage
			): Promise<Record<string, unknown>> {
				const chunks: Buffer[] = [];
				for await (const c of req) {
					chunks.push(c as Buffer);
				}
				const raw = Buffer.concat(chunks).toString('utf8');
				return raw ? JSON.parse(raw) : {};
			}

			function json(res: ServerResponse, code: number, data: unknown) {
				res.statusCode = code;
				res.setHeader('content-type', 'application/json');
				res.end(JSON.stringify(data));
			}

			// connect strips '/__admin' prefix
			server.middlewares.use(
				'/__admin',
				async (req: IncomingMessage, res: ServerResponse, next) => {
					const url = (req.url || '').split('?')[0];
					try {
						if (req.method === 'GET' && url === '/list') {
							const posts = await listDir(postsDir, (s) => {
								const title =
									s.match(/title:\s*'((?:[^'\\]|\\.)*)'/)?.[1] ?? '';
								// hidden titles are stored obfuscated
								return /hidden:\s*true/.test(s) ? dec(title) : title;
							});
							const users = await listDir(
								usersDir,
								(s) =>
									s.match(
										/username="((?:[^"\\]|\\.)*)"/
									)?.[1] ?? ''
							);
							return json(res, 200, { posts, users });
						}

						if (req.method === 'POST' && url === '/create-post') {
							const b = (await readBody(req)) as unknown as PostBody;
							if (!SLUG_RE.test(b.slug || '')) {
								return json(res, 400, {
									error: 'slug must be lowercase letters, numbers and dashes',
								});
							}
							const dir = path.join(postsDir, b.slug);
							const file = path.join(dir, '+page.svelte');
							if (await exists(file)) {
								return json(res, 409, {
									error: `post "${b.slug}" already exists`,
								});
							}
							await fs.mkdir(dir, { recursive: true });
							await fs.writeFile(file, renderPost(b), 'utf8');
							return json(res, 200, {
								ok: true,
								path: `/post/${b.slug}`,
							});
						}

						if (req.method === 'POST' && url === '/create-user') {
							const b = (await readBody(req)) as unknown as UserBody;
							if (!SLUG_RE.test(b.slug || '')) {
								return json(res, 400, {
									error: 'slug must be lowercase letters, numbers and dashes',
								});
							}
							const dir = path.join(usersDir, b.slug);
							const file = path.join(dir, '+page.svelte');
							if (await exists(file)) {
								return json(res, 409, {
									error: `user "${b.slug}" already exists`,
								});
							}
							await fs.mkdir(dir, { recursive: true });
							await fs.writeFile(file, renderUser(b), 'utf8');
							return json(res, 200, {
								ok: true,
								path: `/user/${b.slug}`,
							});
						}

						if (req.method === 'POST' && url === '/delete') {
							const b = (await readBody(req)) as {
								type?: string;
								slug?: string;
							};
							if (!SLUG_RE.test(b.slug || '')) {
								return json(res, 400, { error: 'invalid slug' });
							}
							const base = b.type === 'user' ? usersDir : postsDir;
							const dir = path.join(base, b.slug!);
							// block path escapes
							if (
								dir !== path.join(base, b.slug!) ||
								!dir.startsWith(base + path.sep)
							) {
								return json(res, 400, { error: 'bad path' });
							}
							await fs.rm(dir, { recursive: true, force: true });
							return json(res, 200, { ok: true });
						}

						next();
					} catch (e) {
						json(res, 500, {
							error: String((e as Error)?.message ?? e),
						});
					}
				}
			);
		},
	};
}
