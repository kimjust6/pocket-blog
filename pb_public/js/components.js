(function () {
    'use strict';

    if (typeof Vue === 'undefined' || typeof VueRouter === 'undefined') return;

    const { ref, computed, watch } = Vue;
    const { useRouter } = VueRouter;

    function trackPostClick(post) {
        if (!post || typeof window.gtag !== 'function') return;
        window.gtag('event', 'click', {
            event_category: post.itemIsClimbing ? 'climbing_log' : 'blog_post',
            event_label: post.title || '',
        });
    }

    const ICON_DEFS = {
        menu: {
            viewBox: '0 0 24 24',
            fill: 'none',
            defaultClass: 'inline-block h-6 w-6 stroke-current',
            paths: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />',
        },
        sun: {
            viewBox: '0 0 24 24',
            defaultClass: 'h-5 w-5 fill-transparent stroke-accent group-hover:fill-accent group-hover:scale-110 transition-all duration-200',
            paths: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />',
        },
        moon: {
            viewBox: '0 0 24 24',
            defaultClass: 'h-5 w-5 fill-transparent stroke-accent group-hover:fill-accent group-hover:scale-110 transition-all duration-200',
            paths: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />',
        },
        back: {
            width: '16',
            height: '16',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            paths: '<path d="m12 19-7-7 7-7" /><path d="M19 12H5" />',
        },
        close: {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            defaultClass: 'h-4 w-4',
            paths: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />',
        },
        search: {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            defaultClass: 'h-4 w-4',
            paths: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />',
        },
        location: {
            viewBox: '0 0 20 20',
            fill: 'currentColor',
            defaultClass: 'h-3.5 w-3.5',
            paths: '<path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />',
        },
        mountain: {
            width: '16',
            height: '16',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            paths: '<path d="m8 3 4 8 5-5 5 15H2L8 3z" /><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" />',
        },
        code: {
            width: '16',
            height: '16',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            paths: '<polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />',
        },
        portfolio: {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            defaultClass: 'w-6 h-6 group-hover:scale-110 transition-transform duration-200',
            paths: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" /><path d="m10 9-2 2 2 2m4-4 2 2-2 2" />',
        },
        github: {
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            defaultClass: 'w-6 h-6 group-hover:scale-110 transition-transform duration-200',
            paths: '<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>',
        },
        instagram: {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            defaultClass: 'w-6 h-6 group-hover:scale-110 transition-transform duration-200',
            paths: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />',
        },
        bluesky: {
            viewBox: '0 0 16 16',
            fill: 'currentColor',
            defaultClass: 'w-6 h-6 group-hover:scale-110 transition-transform duration-200',
            paths: '<path d="M3.468 1.948C5.303 3.325 7.276 6.118 8 7.616c.725-1.498 2.698-4.29 4.532-5.668C13.855.955 16 .186 16 2.632c0 .489-.28 4.105-.444 4.692-.572 2.04-2.653 2.561-4.504 2.246 3.236.551 4.06 2.375 2.281 4.2-3.376 3.464-4.852-.87-5.23-1.98-.07-.204-.103-.3-.103-.218 0-.081-.033.014-.102.218-.379 1.11-1.855 5.444-5.231 1.98-1.778-1.825-.955-3.65 2.28-4.2-1.85.315-3.932-.205-4.503-2.246C.28 6.737 0 3.12 0 2.632 0 .186 2.145.955 3.468 1.948"/>',
        },
    };

    const AppIcon = {
        name: 'AppIcon',
        props: {
            name: { type: String, required: true },
            iconClass: { type: String, default: '' },
            svgId: { type: String, default: null },
        },
        setup(props) {
            const def = computed(() => ICON_DEFS[String(props.name || '').toLowerCase()] || null);
            const resolvedClass = computed(() => props.iconClass || def.value?.defaultClass || null);
            return { def, resolvedClass };
        },
        template: `
            <svg v-if="def"
                :id="svgId"
                xmlns="http://www.w3.org/2000/svg"
                :width="def.width || null"
                :height="def.height || null"
                :viewBox="def.viewBox"
                :fill="def.fill || null"
                :stroke="def.stroke || null"
                :stroke-width="def.strokeWidth || null"
                :stroke-linecap="def.strokeLinecap || null"
                :stroke-linejoin="def.strokeLinejoin || null"
                :class="resolvedClass"
                aria-hidden="true"
                v-html="def.paths" />
        `,
    };

    const PostBadgeList = {
        name: 'PostBadgeList',
        components: { AppIcon },
        props: {
            badges: { type: Array, default: () => [] },
            itemIsClimbing: { type: Boolean, default: false },
            sizeClass: { type: String, default: '' },
            wrapClass: { type: String, default: 'flex flex-wrap gap-2' },
            stopPropagation: { type: Boolean, default: false },
        },
        setup(props) {
            const router = useRouter();

            function badgeLocation(badge) {
                return {
                    path: props.itemIsClimbing ? '/climbing' : '/blog/posts',
                    query: { query: badge.query || badge.text || badge },
                };
            }

            function onBadgeClick(badge) {
                router.push(badgeLocation(badge));
            }

            return { badgeLocation, onBadgeClick };
        },
        template: `
            <div :class="wrapClass">
                <template v-for="(badge, idx) in badges" :key="idx + '-' + (badge.text || badge)">
                    <span v-if="stopPropagation"
                        @click.prevent.stop="onBadgeClick(badge)"
                        class="badge tag-pill"
                        :class="sizeClass">
                        <app-icon v-if="badge.isLocation" name="location"
                            icon-class="h-3.5 w-3.5 mr-1 inline-block transition-transform duration-200" />
                        {{ badge.text || badge }}
                    </span>
                    <router-link v-else :to="badgeLocation(badge)" class="no-underline">
                        <span class="badge tag-pill group" :class="sizeClass">
                            <app-icon v-if="badge.isLocation" name="location"
                                icon-class="h-3.5 w-3.5 mr-1 inline-block transition-transform duration-200" />
                            {{ badge.text || badge }}
                        </span>
                    </router-link>
                </template>
            </div>
        `,
    };

    const PostGridCard = {
        name: 'PostGridCard',
        components: { AppIcon, PostBadgeList },
        props: {
            blog: { type: Object, required: true },
            isLcp: { type: Boolean, default: false },
        },
        setup() {
            const router = useRouter();
            function navigateToQuery(itemIsClimbing, query) {
                const path = itemIsClimbing ? '/climbing' : '/blog/posts';
                router.push({ path, query: { query } });
            }
            return { trackPostClick, navigateToQuery };
        },
        template: `
            <router-link :to="blog.link" class="no-underline group" @click="trackPostClick(blog)">
                <div class="card glass-card shadow-xl blog-card-transition overflow-hidden rounded-xl"
                    :style="'--blog-card-id: blog-card-' + blog.id">
                    <figure v-if="blog.gridImageUrl" class="h-auto md:h-48 overflow-hidden m-0 rounded-t-lg relative">
                        <img :src="blog.gridImageUrl" :alt="blog.title"
                            class="w-full h-auto md:h-48 object-cover blog-image-transition rounded-t-lg"
                            :style="'--blog-image-id: blog-image-' + blog.id"
                            width="350" height="192" decoding="async"
                            :fetchpriority="isLcp ? 'high' : null"
                            :loading="isLcp ? null : 'lazy'" />
                        <div v-if="blog.location"
                            @click.prevent.stop="navigateToQuery(blog.itemIsClimbing, blog.location)"
                            class="location-pill">
                            <app-icon name="location" />
                            {{ blog.location }}
                        </div>
                    </figure>
                    <div class="card-body blog-body-transition p-6">
                        <h2 class="card-title text-xl font-bold text-secondary my-0 blog-title-transition"
                            :style="'--blog-title-id: blog-title-' + blog.id">
                            {{ blog.title }}
                        </h2>
                        <post-badge-list
                            :badges="blog.badges || []"
                            :item-is-climbing="!!blog.itemIsClimbing"
                            size-class="badge-sm h-auto"
                            :stop-propagation="true"
                        />
                        <p class="text-sm text-base-content line-clamp-3">{{ blog.previewText }}</p>
                        <span class="text-xs text-base-content/60 mt-2">{{ blog.formattedDate }}</span>
                    </div>
                </div>
            </router-link>
        `,
    };

    const HeroSection = {
        name: 'HeroSection',
        components: { AppIcon },
        props: {
            siteName: { type: String, default: 'The Justin Blog' },
            socials: { type: Array, default: () => [] },
        },
        template: `
            <div class="hero bg-base-100 not-prose bg-cover bg-center -mt-16">
                <div class="hero-content pt-24 lg:pt-36 text-center text-base-content">
                    <div class="max-w-4xl bg-base-100/60 backdrop-blur-lg md:p-8 rounded-xl">
                        <router-link to="/" class="no-underline" aria-label="Go to Homepage">
                            <h1 class="text-5xl font-bold text-accent">
                                {{ siteName }}
                            </h1>
                        </router-link>
                        <nav class="py-6 lg:py-12" aria-label="Social links">
                            <ul class="flex flex-row flex-wrap justify-center gap-4">
                                <li v-for="social in socials" :key="social.name">
                                    <div class="tooltip tooltip-bottom" :data-tip="social.name">
                                        <a :href="social.url" target="_blank" rel="noopener noreferrer"
                                            class="w-12 h-12 flex items-center justify-center rounded-full border border-base-content/30 hover:border-secondary hover:text-secondary transition-all duration-200 group"
                                            :aria-label="social.name">
                                            <app-icon :name="social.name.toLowerCase()" />
                                            <span class="sr-only">
                                                {{ social.name }} (opens in a new tab)
                                            </span>
                                        </a>
                                    </div>
                                </li>
                            </ul>
                        </nav>
                        <div class="flex flex-col lg:flex-row items-stretch justify-center w-full gap-2 lg:gap-0">
                            <router-link to="/blog/posts" class="no-underline flex-1 flex flex-col w-full max-w-xl mx-auto group">
                                <div class="mockup-code text-left glass-card px-4 sm:px-12 py-8 text-primary flex-1 flex flex-col justify-center blog-card-transition">
                                    <div class="flex py-4 text-base transition-all text-base-content font-mono items-start">
                                        <span class="mr-4 select-none text-accent font-bold">$</span>
                                        <span class="text-wrap break-words">read about the lessons I have learned (from the mistakes I have made).</span>
                                    </div>
                                </div>
                            </router-link>

                            <div class="divider lg:divider-horizontal my-0 lg:mx-4"></div>

                            <router-link to="/climbing" class="no-underline flex-1 flex flex-col w-full max-w-xl mx-auto group">
                                <div class="card text-left glass-card px-4 sm:px-12 py-8 text-secondary flex-1 flex flex-col justify-center blog-card-transition">
                                    <div class="flex py-4 text-base transition-all text-base-content font-mono items-start">
                                        <span class="mr-4 select-none text-accent shrink-0 inline-flex items-center justify-center h-6">
                                            <app-icon name="mountain" icon-class="w-4 h-4 translate-y-1" />
                                        </span>
                                        <span class="text-wrap break-words">read about my climbing progression, projects, and (hopefully) sends</span>
                                    </div>
                                </div>
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>
        `,
    };

    const SearchBar = {
        name: 'SearchBar',
        components: { AppIcon },
        props: {
            modelValue: { type: String, default: '' },
            action: { type: String, required: true },
            placeholder: { type: String, default: 'Search...' },
            label: { type: String, default: 'Search' },
        },
        emits: ['update:modelValue', 'submit', 'clear'],
        setup(props, { emit, expose }) {
            const inputRef = ref(null);
            function focusInput(opts) {
                if (!inputRef.value) return;
                try {
                    inputRef.value.focus(opts);
                } catch (_) {
                    inputRef.value.focus();
                }
            }
            expose({ focusInput });

            return {
                inputRef,
                onInput(e) {
                    emit('update:modelValue', e.target.value);
                },
                onSubmit() {
                    emit('submit');
                },
                onClear() {
                    emit('clear');
                },
            };
        },
        template: `
            <form role="search" :action="action" method="get" @submit.prevent="onSubmit"
                class="my-6 flex justify-center w-full">
                <div class="relative w-full max-w-xl">
                    <label for="site-search-input" class="sr-only">{{ label }}</label>
                    <input type="text" inputmode="search" role="searchbox" name="query" id="site-search-input"
                        autocomplete="search" :value="modelValue" @input="onInput" ref="inputRef"
                        class="input input-bordered w-full rounded-full bg-base-100 border border-base-content/30 pl-5 pr-24 text-base focus:outline-none focus:ring-2 focus:ring-primary shadow-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
                        :placeholder="placeholder"
                        :aria-label="label"
                        @keydown.enter.prevent="onSubmit" />
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1" style="right: 0.75rem;">
                        <button v-show="modelValue" @click="onClear"
                            class="btn btn-ghost btn-xs btn-circle opacity-70 hover:opacity-100 text-base-content"
                            type="button" aria-label="Clear search">
                            <app-icon name="close" />
                        </button>
                        <button type="submit" @click.prevent="onSubmit"
                            class="btn btn-primary btn-sm btn-circle shrink-0" aria-label="Submit search">
                            <app-icon name="search" />
                        </button>
                    </div>
                </div>
            </form>
        `,
    };

    const PaginationNav = {
        name: 'PaginationNav',
        props: {
            currentPage: { type: Number, required: true },
            totalPages: { type: Number, required: true },
            pageLocation: { type: Function, required: true },
        },
        template: `
            <nav aria-label="Pagination" class="flex justify-center my-12">
                <div class="join">
                    <button v-if="currentPage <= 1" class="join-item btn btn-sm btn-disabled"
                        aria-label="Previous page" disabled aria-disabled="true">«</button>
                    <router-link v-else :to="pageLocation(currentPage - 1)" class="join-item btn btn-sm"
                        aria-label="Previous page">«</router-link>

                    <router-link v-for="i in totalPages" :key="i" :to="pageLocation(i)"
                        class="join-item btn btn-sm" :class="{ 'btn-active': currentPage === i }"
                        :aria-current="currentPage === i ? 'page' : null"
                        :aria-label="'Page ' + i">
                        {{ i }}
                    </router-link>

                    <button v-if="currentPage >= totalPages" class="join-item btn btn-sm btn-disabled"
                        aria-label="Next page" disabled aria-disabled="true">»</button>
                    <router-link v-else :to="pageLocation(currentPage + 1)" class="join-item btn btn-sm"
                        aria-label="Next page">»</router-link>
                </div>
            </nav>
        `,
    };

    const SiteNavbar = {
        name: 'SiteNavbar',
        components: { AppIcon },
        props: {
            navigation: { type: Array, default: () => [] },
            currentTheme: { type: String, default: 'dark' },
        },
        emits: ['toggle-theme'],
        template: `
            <nav class="navbar glass-surface w-full fixed top-0 left-0 right-0 z-40 navbar-persistent"
                aria-label="Main Navigation">
                <div class="flex-none lg:hidden">
                    <label for="my-drawer-3" aria-label="Open sidebar menu" class="btn btn-square btn-ghost">
                        <app-icon name="menu" />
                    </label>
                </div>
                <div class="menu menu-horizontal mx-2 flex-1 px-2">
                    <router-link to="/"
                        class="font-medium hover:text-secondary transition-colors duration-200 no-underline text-base-content"
                        :aria-current="$route.path === '/' ? 'page' : 'false'">Home</router-link>
                </div>
                <div class="hidden flex-none lg:flex items-center gap-6 px-2 text-sm">
                    <router-link v-for="item in navigation" :key="item.url" :to="item.url"
                        class="font-medium hover:text-secondary transition-colors duration-200 no-underline"
                        :class="$route.path === item.url ? 'text-accent' : 'text-base-content'">
                        {{ item.title }}
                    </router-link>
                </div>
                <div class="flex-none ml-2">
                    <button @click="$emit('toggle-theme')" type="button"
                        class="flex items-center justify-center group cursor-pointer bg-transparent p-2 rounded-xl border border-transparent hover:border-accent/50 transition-all duration-200"
                        aria-label="Toggle theme">
                        <app-icon name="sun" svg-id="theme-icon-sun" v-show="currentTheme === 'dark'" />
                        <app-icon name="moon" svg-id="theme-icon-moon" v-show="currentTheme === 'nord'" />
                    </button>
                </div>
            </nav>
        `,
    };

    const SiteSidebar = {
        name: 'SiteSidebar',
        props: {
            navigation: { type: Array, default: () => [] },
        },
        emits: ['close'],
        template: `
            <div class="drawer-side z-50">
                <label for="my-drawer-3" aria-label="Close sidebar navigation" class="drawer-overlay"></label>
                <nav aria-label="Mobile Navigation" class="min-h-full w-80 bg-base-200/80 backdrop-blur-md p-4">
                    <ul class="menu">
                        <li v-for="item in navigation" :key="item.url">
                            <router-link :to="item.url" @click="$emit('close')">
                                {{ item.title }}
                            </router-link>
                        </li>
                    </ul>
                </nav>
            </div>
        `,
    };

    const SiteFooter = {
        name: 'SiteFooter',
        props: {
            socials: { type: Array, default: () => [] },
            currentYear: { type: Number, required: true },
        },
        template: `
            <footer class="glass-surface border-t border-base-content/10">
                <div class="py-10 border-base-300 text-center text-sm text-base-content flex flex-col items-center justify-center px-14 gap-4">
                    <nav aria-label="Social media links">
                        <ul class="text-base-content text-sm flex gap-6 flex-row flex-wrap justify-center items-center">
                            <li v-for="social in socials" :key="social.name">
                                <a :href="social.url" target="_blank" rel="noopener noreferrer"
                                    class="font-medium text-base-content hover:text-secondary transition-colors duration-200 no-underline">
                                    {{ social.name }}
                                    <span class="sr-only">(opens in a new tab)</span>
                                </a>
                            </li>
                        </ul>
                    </nav>
                    <p class="opacity-60">&copy; {{ currentYear }} Justin K. All rights reserved.</p>
                </div>
            </footer>
        `,
    };

    const NotFoundView = {
        name: 'NotFoundView',
        props: {
            siteName: { type: String, default: 'The Justin Blog' },
            onEnter: { type: Function, default: null },
        },
        setup(props) {
            if (typeof props.onEnter === 'function') props.onEnter();
            document.title = props.siteName;
            return {};
        },
        template: `
            <section class="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center bg-base-200 px-6 py-16 text-center">
                <h1 class="mb-4 text-5xl font-bold text-accent">404 - Page Not Found</h1>
                <p class="mb-6 text-lg text-base-content">
                    Oops! The page you're looking for doesn't exist.
                </p>
                <router-link to="/" class="btn btn-accent">Go Back to Home</router-link>
            </section>
        `,
    };

    const StaticPageView = {
        name: 'StaticPageView',
        props: {
            text: { type: String, required: true },
            siteName: { type: String, default: 'The Justin Blog' },
            onEnter: { type: Function, default: null },
        },
        setup(props) {
            if (typeof props.onEnter === 'function') props.onEnter();
            watch(
                () => props.text,
                () => {
                    document.title = props.siteName;
                },
                { immediate: true }
            );
            return {};
        },
        template: `
            <div class="mx-auto max-w-4xl px-4 py-12">
                {{ text }}
            </div>
        `,
    };

    window.BlogComponents = {
        trackPostClick,
        AppIcon,
        PostBadgeList,
        PostGridCard,
        HeroSection,
        SearchBar,
        PaginationNav,
        SiteNavbar,
        SiteSidebar,
        SiteFooter,
        NotFoundView,
        StaticPageView,
    };
})();

