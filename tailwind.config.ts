import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
	content: [
		'./app/**/*.{js,ts,jsx,tsx}',
		'./src/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                brand: {
                    navy: 'hsl(var(--brand-navy))',
                    teal: 'hsl(var(--brand-teal))',
                    sky: 'hsl(var(--brand-sky))',
                    iris: 'hsl(var(--brand-iris))',
                }
			},
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                dash: {
                    to: { strokeDashoffset: '1000' }
                },
                marquee: {
                    '0%': { transform: 'translateX(0%)' },
                    '100%': { transform: 'translateX(-50%)' }
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(5px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                // Slow, organic drift for background mesh-gradient blobs (see PatientHero) —
                // subtle position + scale wander, not a bounce, so it reads as "alive" rather
                // than distracting from the search CTA sitting on top of it.
                blobDrift: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(3%, 4%) scale(1.08)' },
                    '66%': { transform: 'translate(-3%, 2%) scale(0.95)' },
                },
                // Subtle animated sheen on the "Dekho" gradient wordmark (PatientHero) — the
                // gradient itself doesn't move, just where in it the text's fill window sits.
                gradientShift: {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
            },
            animation: {
                float: 'float 6s ease-in-out infinite',
                marquee: 'marquee 30s linear infinite',
                'gradient-shift': 'gradientShift 6s ease-in-out infinite',
                // Three durations sharing one keyframe so the hero's 3 blobs drift out of sync
                // with each other instead of visibly breathing in unison.
                'blob-drift': 'blobDrift 20s ease-in-out infinite',
                'blob-drift-slow': 'blobDrift 28s ease-in-out infinite',
                'blob-drift-slower': 'blobDrift 35s ease-in-out infinite',
            }
		},
	},
	// typography powers the `prose` classes used by the Health Wiki article body.
	plugins: [typography],
};

export default config;
