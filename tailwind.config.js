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
                // "Glacier Mist" — blue pastel light theme
                nord: {
                    'primary': '#2D6392',           // rich ocean blue
                    'primary-content': '#ffffff',
                    'secondary': '#5B9ED4',          // sky blue — hover/interactive highlight
                    'secondary-content': '#ffffff',
                    'accent': '#D94F68',             // coral rose — warm focal point
                    'accent-content': '#ffffff',
                    'neutral': '#1C2938',
                    'neutral-content': '#ffffff',
                    'base-100': '#EBF2FA',           // fresh sky pastel — page bg
                    'base-200': '#D8E5F3',           // medium sky pastel
                    'base-300': '#ADC7E3',           // deeper mist blue — cards, navbar, footer
                    'base-content': '#13253A',       // dark slate navy
                    'info': '#4A8FC2',
                    'info-content': '#ffffff',
                    'success': '#358A60',
                    'success-content': '#ffffff',
                    'warning': '#C4923A',            // warm golden amber
                    'warning-content': '#ffffff',
                    'error': '#C05050',
                    'error-content': '#ffffff',
                },
            },
            {
                // "Midnight Studio" — deep navy dark theme
                dark: {
                    'color-scheme': 'dark',
                    'primary': '#5B9BD5',           // vivid electric blue — buttons, links
                    'primary-content': '#06111f',
                    'secondary': '#90C3E8',          // pale sky blue — lighter than primary, clear hover target
                    'secondary-content': '#071624',
                    'accent': '#E8A833',             // saffron-amber — warm focal point against cool bg
                    'accent-content': '#1a1000',
                    'neutral': '#1e2535',
                    'neutral-content': '#a6adbb',
                    'base-100': '#0f141c',           // deep navy — main bg
                    'base-200': '#0b0f16',           // darker navy
                    'base-300': '#070a11',           // near-black navy — cards, navbar
                    'base-content': '#b0bdd4',       // soft blue-grey text
                    'info': '#5B9BD5',
                    'info-content': '#06111f',
                    'success': '#5cb88a',
                    'success-content': '#061a0f',
                    'warning': '#E8A833',
                    'warning-content': '#1a1000',
                    'error': '#d46b6b',
                    'error-content': '#200808',
                },
            },
            {
                // "Mint Garden" green pastel light theme
                mintGarden: {
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
            }
        ],
        darkTheme: 'dark',
        base: true,
        styled: true,
        utils: true,
    },
    plugins: [require('@tailwindcss/typography'), require('daisyui')],
}
