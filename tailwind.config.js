/** @type {import('tailwindcss').Config} */
export default {
    content: ['./pb_hooks/pages/**/*.{ejs,md}'],
    theme: {
        extend: {},
    },
    daisyui: {
        themes: ['nord', 'dark'],
        darkTheme: 'dark',
        base: true, // applies background color and foreground color
        styled: true, // include daisyUI colors and design decisions
        utils: true, // adds responsive and modifier utility classes
    },
    plugins: [require('@tailwindcss/typography'), require('daisyui')],
}
