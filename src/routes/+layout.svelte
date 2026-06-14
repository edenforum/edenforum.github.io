<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import Player from '$lib/player.svelte';
	import Search from '$lib/search.svelte';
	import Lightswitch from '$lib/lightswitch.svelte';
	import { playerVolume, lightsOn } from '$lib/stores';
	import { runDialup } from '$lib/dialup';
	import './global.css';

	const { children = $bindable() } = $props();

	let knockCount = $state(0);
	const knocksNeeded = 5;
	let knocking = $state(false);

	$effect(() => {
		if (knockCount === knocksNeeded) {
			goto('/home2');
		}
	});

	// Dial-up image loading: stream every image in from top to bottom once the
	// page is actually visible (lights on), and again after each client-side
	// navigation so new pages get the same treatment. runDialup() is idempotent.
	$effect(() => {
		if ($lightsOn) {
			requestAnimationFrame(() => runDialup());
		}
	});

	afterNavigate(() => {
		if ($lightsOn) {
			requestAnimationFrame(() => runDialup());
		}
	});

	const startTime = new Date().toLocaleString();
	let time = $state(startTime),
		time2 = $state(startTime),
		time3 = $state(startTime);

	setInterval(() => {
		time = new Date().toLocaleString();

		setTimeout(() => {
			time2 = time;
		}, 150);

		setTimeout(() => {
			time3 = time;
		}, 300);
	}, 1000);

	// TODO: Sound
	async function knockHandler(ev: MouseEvent) {
		if ($page.url.pathname === '/') {
			ev.preventDefault();

			const knockSound = new Audio('/sounds/knock.mp3');
			knockSound.volume = Math.pow(0.01, 1 - $playerVolume) - 0.01;
			await knockSound.play();
			await new Promise((res) =>
				setTimeout(res, knockSound.duration * 1000)
			);

			knockCount++;
		}
	}
</script>

<svelte:head>
	<title>edenforum</title>
</svelte:head>

<nav>
	<a href="/">
		<img class="logo" src="/icons/edenforum.png" alt="edenforum logo" />
	</a>

	<ul>
		<li><Search /></li>
		<li><Player /></li>
		<li>
			<a
				href="/"
				class:canKnock={$page.url.pathname === '/'}
				class:knocking
				onclick={knockHandler}
				onmousedown={() =>
					$page.url.pathname === '/' && (knocking = true)}
				onmouseup={() => (knocking = false)}
				><img src="/icons/home.png" alt="home" /></a
			>
		</li>
	</ul>
</nav>

<main>
	<div class="time" style="opacity:0.25;transform:translateX(-2rem);">
		the date and time is: {time3}...
	</div>
	<div class="time" style="opacity:0.5;transform:translateX(-1rem);">
		the date and time is: {time2}...
	</div>
	<div class="time">
		the date and time is: {time}...
	</div>

	{@render children()}
</main>

{#if !$lightsOn && $page.url.pathname !== '/home2'}
	<Lightswitch />
{/if}

<style>
	main,
	nav {
		width: 100%;
		margin: 0 auto;
		max-width: 50rem;
	}

	nav {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		filter: drop-shadow(15px 15px 7px #a968996e);
		padding: 2rem 0;
	}

	/* pixel-perfect: render at exactly 1x the source (335x84) so nearest-neighbor
	   has no fractional scaling to blur or misalign */
	nav .logo {
		height: 84px;
		width: auto;
		image-rendering: pixelated;
	}

	main {
		filter: drop-shadow(15px 15px 7px #a968996e);
	}

	ul {
		display: flex;
		flex-direction: row;
		list-style: none;
		gap: 2rem;
	}

	ul li {
		display: flex;
		flex-direction: row;
		gap: 1rem;
		align-items: center;
		cursor: var(--cur-pointer);
		user-select: none;
	}

	ul li a.canKnock {
		cursor: var(--cur-knock-1);
	}

	ul li a.knocking {
		cursor: var(--cur-knock-2);
	}

	/* 32x32 source → exactly 1x, pixel-perfect nearest-neighbor */
	ul li img {
		height: 32px;
		width: 32px;
		image-rendering: pixelated;
	}

	.time {
		color: #ff79ce;
		padding-left: 1rem;
	}
</style>
