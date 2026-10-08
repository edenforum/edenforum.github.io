// explorable scenes for the secret /home2 page, images live in static/home2
// hotspot x/y/w/h are percents of the image, x,y is the top left

export type Hotspot = {
	x: number;
	y: number;
	w: number;
	h: number;
	label?: string;
	to?: string;
	back?: boolean;
	href?: string;
	text?: string;
	sound?: string;
	code?: string;
};

export type Scene = {
	id: string;
	image: string;
	alt?: string;
	aspect?: number;
	ambient?: string;
	hotspots: Hotspot[];
};

export const scenes: Scene[] = [
	{
		id: 'scene-1',
		image: '/home2/scene-1.png',
		alt: 'room 1',
		aspect: 4 / 3,
		ambient: '/sounds/scene1.mp3',
		hotspots: [
			{ x: 45, y: 30, w: 10, h: 20, label: 'home', to: 'scene-2', sound: '/sounds/footsteps.mp3'},

		]
	},
	{
		id: 'scene-2',
		image: '/home2/scene-2.png',
		alt: 'room 2',
		aspect: 4 / 3,
		ambient: '/sounds/scene2.mp3',
		hotspots: [
			{ x: 0, y: 93, w: 100, h: 8, label: 'go back', to: 'scene-1', sound: '/sounds/footsteps.mp3'},
			{ x: 35, y: 29, w: 30, h: 60, label: 'the door', code: 'EwoTAA==', to: 'scene-3' },
		]
	},
	{
		id: 'scene-3',
		image: '/home2/scene-3.png',
		alt: 'room 3',
		aspect: 4 / 3,
		ambient: '/sounds/scene3.mp3',
		hotspots: [
			{ x: 0, y: 93, w: 100, h: 8, label: 'go back', to: 'scene-2'},
			{ x: 32, y: 22, w: 40, h: 50, label: 'the balcony', to: 'scene-4'},

		]
	},
		{
		id: 'scene-4',
		image: '/home2/scene-4.png',
		alt: 'room 4',
		aspect: 4 / 3,
		ambient: '/sounds/scene3.mp3',
		hotspots: [
			{ x: 35, y: 46, w: 17, h: 25, label: 'go back', to: 'scene-3'},
		]
	}
];

export function findScene(id: string) {
	return scenes.find((s) => s.id === id);
}

export function startScene() {
	return scenes[0];
}
