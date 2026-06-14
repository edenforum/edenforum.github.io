<script lang="ts">
	import { onMount } from 'svelte';

	// This whole page is gated on Vite's DEV flag. In a production build
	// `import.meta.env.DEV` is statically `false`, so everything below is
	// dead-code-eliminated and the page renders nothing useful. The API it talks
	// to (the dev-only Vite middleware) also doesn't exist in production.
	const dev = import.meta.env.DEV;

	type Message = { username: string; icon: string; href: string; text: string };
	type Listing = { slug: string; label: string };

	// --- new post form --------------------------------------------------------
	let pSlug = $state('');
	let pTitle = $state('');
	let pAuthor = $state('');
	let pDate = $state('');
	let pComments = $state('0');
	let pMusic = $state('');
	let pHidden = $state(false);
	let messages = $state<Message[]>([
		{ username: '', icon: '', href: '', text: '' },
	]);

	// --- new user form --------------------------------------------------------
	let uSlug = $state('');
	let uUsername = $state('');
	let uIcon = $state('/icons/pfp.png');
	let uJoinDate = $state('');
	let uBio = $state('');

	// --- existing pages -------------------------------------------------------
	let posts = $state<Listing[]>([]);
	let users = $state<Listing[]>([]);
	let status = $state('');
	let error = $state('');

	function flash(ok: string, err = '') {
		status = ok;
		error = err;
	}

	async function refresh() {
		try {
			const r = await fetch('/__admin/list');
			const data = await r.json();
			posts = data.posts ?? [];
			users = data.users ?? [];
		} catch (e) {
			error = `could not reach the dev API: ${e}`;
		}
	}

	// auto-fill a slug from a title/name as the user types (until they edit it)
	let pSlugTouched = $state(false);
	let uSlugTouched = $state(false);
	function slugify(s: string) {
		return s
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}
	$effect(() => {
		if (!pSlugTouched) {
			pSlug = slugify(pTitle);
		}
	});
	$effect(() => {
		if (!uSlugTouched) {
			uSlug = slugify(uUsername);
		}
	});

	function addMessage() {
		messages.push({ username: '', icon: '', href: '', text: '' });
	}
	function removeMessage(i: number) {
		messages.splice(i, 1);
		if (messages.length === 0) {
			addMessage();
		}
	}

	async function createPost() {
		flash('');
		const body = {
			slug: pSlug,
			title: pTitle,
			author: pAuthor,
			date: pDate,
			comments: pComments,
			music: pMusic || undefined,
			hidden: pHidden,
			messages: messages
				.filter((m) => m.username || m.text)
				.map((m) => ({
					username: m.username,
					icon: m.icon || undefined,
					href: m.href || undefined,
					text: m.text,
				})),
		};
		try {
			const r = await fetch('/__admin/create-post', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
			});
			const data = await r.json();
			if (!r.ok) {
				return flash('', data.error ?? 'failed');
			}
			flash(`created ${data.path}`);
			// reset the form for the next post
			pSlug = pTitle = pAuthor = pDate = '';
			pComments = '0';
			pMusic = '';
			pHidden = false;
			pSlugTouched = false;
			messages = [{ username: '', icon: '', href: '', text: '' }];
			await refresh();
		} catch (e) {
			flash('', String(e));
		}
	}

	async function createUser() {
		flash('');
		try {
			const r = await fetch('/__admin/create-user', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					slug: uSlug,
					username: uUsername,
					iconURL: uIcon,
					joinDate: uJoinDate,
					bio: uBio,
				}),
			});
			const data = await r.json();
			if (!r.ok) {
				return flash('', data.error ?? 'failed');
			}
			flash(`created ${data.path}`);
			uSlug = uUsername = uJoinDate = uBio = '';
			uIcon = '/icons/pfp.png';
			uSlugTouched = false;
			await refresh();
		} catch (e) {
			flash('', String(e));
		}
	}

	async function del(type: 'post' | 'user', slug: string) {
		if (!confirm(`delete ${type} "${slug}"? this removes the source file.`)) {
			return;
		}
		flash('');
		try {
			const r = await fetch('/__admin/delete', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type, slug }),
			});
			const data = await r.json();
			if (!r.ok) {
				return flash('', data.error ?? 'failed');
			}
			flash(`deleted ${type}/${slug}`);
			await refresh();
		} catch (e) {
			flash('', String(e));
		}
	}

	onMount(() => {
		if (dev) {
			refresh();
		}
	});
</script>

<svelte:head>
	<title>edenforum — admin</title>
</svelte:head>

{#if !dev}
	<p class="note">the editing tools are only available while running locally.</p>
{:else}
	<h1>edenforum authoring</h1>
	<p class="hint">
		dev-only tools. each action writes a real <code>+page.svelte</code> file —
		the new page appears instantly via hot reload.
	</p>

	{#if status}<p class="ok">{status}</p>{/if}
	{#if error}<p class="err">{error}</p>{/if}

	<div class="cols">
		<!-- ========================= NEW POST ========================= -->
		<form
			class="card"
			onsubmit={(e) => {
				e.preventDefault();
				createPost();
			}}
		>
			<h2>new post</h2>

			<label>title<input bind:value={pTitle} required /></label>
			<label>
				slug
				<input
					bind:value={pSlug}
					oninput={() => (pSlugTouched = true)}
					placeholder="my-post"
					required
				/>
			</label>
			<small>→ /post/{pSlug || '…'}</small>

			<label>author<input bind:value={pAuthor} /></label>
			<label>
				date
				<input bind:value={pDate} placeholder="10/20/2024 | 13:37" />
			</label>
			<label>comments<input bind:value={pComments} /></label>
			<label>
				music (optional)
				<input bind:value={pMusic} placeholder="/sounds/detective.mp3" />
			</label>
			<label class="row">
				<input type="checkbox" bind:checked={pHidden} />
				hidden (don't list on the home page)
			</label>

			<h3>messages</h3>
			{#each messages as msg, i (i)}
				<fieldset>
					<legend>#{i + 1}</legend>
					<label>
						username<input bind:value={msg.username} required />
					</label>
					<label>
						avatar icon (optional)
						<input
							bind:value={msg.icon}
							placeholder="/icons/pfp.png"
						/>
					</label>
					<label>
						profile link (optional)
						<input bind:value={msg.href} placeholder="/user/user1" />
					</label>
					<label>
						text<textarea bind:value={msg.text} rows="2"></textarea>
					</label>
					{#if messages.length > 1}
						<button
							type="button"
							class="ghost"
							onclick={() => removeMessage(i)}>remove</button
						>
					{/if}
				</fieldset>
			{/each}
			<button type="button" class="ghost" onclick={addMessage}>
				+ add message
			</button>

			<button type="submit" class="primary">create post</button>
		</form>

		<!-- ========================= NEW USER ========================= -->
		<form
			class="card"
			onsubmit={(e) => {
				e.preventDefault();
				createUser();
			}}
		>
			<h2>new user profile</h2>

			<label>username<input bind:value={uUsername} required /></label>
			<label>
				slug
				<input
					bind:value={uSlug}
					oninput={() => (uSlugTouched = true)}
					placeholder="user3"
					required
				/>
			</label>
			<small>→ /user/{uSlug || '…'}</small>

			<label>
				icon URL
				<input bind:value={uIcon} placeholder="/icons/pfp.png" />
			</label>
			<label>
				join date
				<input
					bind:value={uJoinDate}
					placeholder="01/01/1970 12:00 AM"
				/>
			</label>
			<label>bio<textarea bind:value={uBio} rows="3"></textarea></label>

			<button type="submit" class="primary">create profile</button>
		</form>
	</div>

	<!-- ========================= EXISTING ========================= -->
	<div class="cols">
		<div class="card">
			<h2>posts ({posts.length})</h2>
			<ul>
				{#each posts as p (p.slug)}
					<li>
						<a href="/post/{p.slug}">{p.label}</a>
						<span class="slug">/post/{p.slug}</span>
						<button class="ghost" onclick={() => del('post', p.slug)}>
							delete
						</button>
					</li>
				{/each}
			</ul>
		</div>
		<div class="card">
			<h2>users ({users.length})</h2>
			<ul>
				{#each users as u (u.slug)}
					<li>
						<a href="/user/{u.slug}">{u.label}</a>
						<span class="slug">/user/{u.slug}</span>
						<button class="ghost" onclick={() => del('user', u.slug)}>
							delete
						</button>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}

<style>
	h1 {
		color: var(--pink, #ff79ce);
	}
	.hint,
	.note {
		color: rgb(207, 121, 181);
	}
	.ok {
		color: #2e7d32;
		background: #d7ffd9;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
	}
	.err {
		color: #b00020;
		background: #ffd7dd;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
	}
	.cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		align-items: start;
	}
	@media (max-width: 48rem) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
	.card {
		background: #fedeff64;
		padding: 1rem;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.card h2,
	.card h3 {
		margin: 0.25rem 0;
		color: hsl(318, 47%, 50%);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		color: hsl(318, 47%, 45%);
		font-size: 0.9rem;
	}
	label.row {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
	}
	input,
	textarea {
		font: inherit;
		padding: 0.35rem 0.5rem;
		border: 1px solid #e0a8d0;
		border-radius: 4px;
		background: #fff;
	}
	small {
		color: #a06a92;
		font-family: monospace;
	}
	fieldset {
		border: 1px solid #e8c8f0;
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem 0.75rem;
	}
	legend {
		color: hsl(318, 47%, 55%);
		padding: 0 0.4rem;
	}
	button {
		cursor: pointer;
		font: inherit;
		padding: 0.4rem 0.75rem;
		border-radius: 4px;
		border: none;
	}
	button.primary {
		background: var(--blue, #6ea8d8);
		color: #fff;
		margin-top: 0.5rem;
	}
	button.ghost {
		background: none;
		border: 1px solid #d8a8cc;
		color: hsl(318, 47%, 50%);
		width: fit-content;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	li a {
		color: hsl(318, 47%, 45%);
	}
	.slug {
		font-family: monospace;
		font-size: 0.8rem;
		color: #a06a92;
		margin-right: auto;
	}
</style>
