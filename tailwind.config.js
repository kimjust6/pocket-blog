/** @type {import('tailwindcss').Config} */
export default {
    content: ['./pb_hooks/pages/**/*.{ejs,md}'],
    darkMode: 'class',
    theme: {
        extend: {},
    },
    daisyui: {
        themes: [
            {
                // "Mint Garden" green pastel light theme
                nord: {
                    'primary': '#3D8B5E',           // deep sage green
                    'primary-content': '#ffffff',
                    'secondary': '#8BC4A8',          // soft medium mint
                    'secondary-content': '#ffffff',
                    'accent': '#D4A85C',             // warm gold (earthy complement)
                    'accent-content': '#ffffff',
                    'neutral': '#2d4a36',
                    'neutral-content': '#ffffff',
                    'base-100': '#E2F2E7',           // fresh mint pastel — page bg
                    'base-200': '#C4E5CE',           // medium mint
                    'base-300': '#9ACCA4',           // deeper sage mint — cards, navbar, footer
                    'base-content': '#163824',       // dark forest green
                    'info': '#8BC4A8',
                    'info-content': '#ffffff',
                    'success': '#3D8B5E',
                    'success-content': '#ffffff',
                    'warning': '#D4A85C',
                    'warning-content': '#ffffff',
                    'error': '#c05c5c',
                    'error-content': '#ffffff',
                },
            },
            {
                // "Dusk Blue" — dark pastel blue (DaisyUI dark bases, pastel accents)
                dark: {
                    'color-scheme': 'dark',
                    'primary': '#7BA5D4',           // soft cornflower blue
                    'primary-content': '#0a1525',
                    'secondary': '#89B4DA',          // sky blue pastel
                    'secondary-content': '#0a1525',
                    'accent': '#A89BD4',             // soft lavender
                    'accent-content': '#0f0a25',
                    'neutral': '#2a3240',
                    'neutral-content': '#a6adbb',
                    'base-100': '#0f141c',           // deep navy — main bg
                    'base-200': '#0b0f16',           // darker navy
                    'base-300': '#070a11',           // near-black navy — cards, navbar
                    'base-content': '#b0bdd4',       // soft blue-grey text
                    'info': '#7BA5D4',
                    'info-content': '#0a1525',
                    'success': '#6abf8f',
                    'success-content': '#0a1f12',
                    'warning': '#c4a45e',
                    'warning-content': '#251800',
                    'error': '#d47878',
                    'error-content': '#250a0a',
                },
            },
        ],
        darkTheme: 'dark',
        base: true,
        styled: true,
        utils: true,
    },
    plugins: [require('@tailwindcss/typography'), require('daisyui')],
}
